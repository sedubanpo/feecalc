const ENDPOINT = 'https://asia-northeast3-fir-lms-prod.cloudfunctions.net/feeCalculatorApi';
export function normalizeLogin(value) {
    const text = String(value || '').trim();
    if (text.includes('@')) return text;
    const digits = text.replace(/\D/g, '');
    if (!/^0\d{8,10}$/.test(digits)) throw new Error('이메일 또는 휴대전화 번호를 확인해 주세요.');
    return `${digits}@sedu-auth.local`;
}
export function createGateway({getUser, fetcher = fetch, onDenied = () => {}}) {
    let actor = null, generation = 0;
    // Share only concurrent reads inside this gateway/auth generation, never settled data.
    const pendingReads = new Map();
    const sharedReads = new Set(['feecalc_students', 'feecalc_student_memos',
        'feecalc_progress', 'feecalc_desk_payments', 'feecalc_intranet_opening']);
    const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
    function read(rpc, params, fresh) {
        if (fresh || !sharedReads.has(rpc)) return request('', {rpc, params});
        const key = JSON.stringify([generation, getUser()?.uid, rpc, stable(params)]);
        if (pendingReads.has(key)) return pendingReads.get(key);
        const task = request('', {rpc, params}).finally(() => {
            if (pendingReads.get(key) === task) pendingReads.delete(key);
        });
        pendingReads.set(key, task);
        return task;
    }
    const stale = () => Object.assign(new Error('로그인 상태가 바뀌었습니다. 다시 시도해 주세요.'), {code: 'AUTH_CHANGED'});
    async function request(path, body, expected = generation) {
        const user = getUser();
        if (!user) throw new Error('서버 기록을 사용하려면 직원 계정으로 로그인해 주세요.');
        const token = await user.getIdToken();
        if (expected !== generation || getUser()?.uid !== user.uid) throw stale();
        const response = await fetcher(ENDPOINT + path, {
            method: body ? 'POST' : 'GET',
            headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
            ...(body ? {body: JSON.stringify(body)} : {}),
            signal: AbortSignal.timeout(20000)
        });
        if (expected !== generation || getUser()?.uid !== user.uid) throw stale();
        if (!response.ok) {
            if (response.status === 403 && ['feecalc_progress','feecalc_intranet_opening','feecalc_monthly_history'].includes(body?.rpc)) {
                const result = await response.json().catch(() => ({}));
                // A separate Intranet scope does not revoke the calculator session.
                if (['PROGRESS_SCOPE_REQUIRED','FINANCIAL_SCOPE_REQUIRED'].includes(result.error?.code)) throw new Error(result.error.message);
            }
            if ([400, 409, 413].includes(response.status)) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error?.message || '입력값을 확인하고 다시 시도해 주세요.');
            }
            const message = response.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : response.status === 403 ? '이 계정에는 기록 접근 권한이 없습니다. 담당자에게 확인해 주세요.' : '기록 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            if ([401, 403].includes(response.status)) { actor = null; generation++; pendingReads.clear(); onDenied(message); }
            throw new Error(message);
        }
        const result = await response.json();
        if (expected !== generation || getUser()?.uid !== user.uid) throw stale();
        return result;
    }
    return {
        get actor() { return actor; },
        reset() { actor = null; generation++; pendingReads.clear(); },
        async teacherProfiles() {
            const user = getUser(), expected = generation;
            if (!actor || !user || actor.uid !== user.uid) throw stale();
            const token = await user.getIdToken();
            if (expected !== generation || getUser()?.uid !== user.uid) throw stale();
            const response = await fetcher('https://firestore.googleapis.com/v1/projects/fir-lms-prod/databases/(default)/documents:runQuery', {
                method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({structuredQuery: {
                    from: [{collectionId: 'sharedIconAssets'}],
                    select: {fields: ['displayName','imageUrl','downloadURL','lookupKey','status'].map(fieldPath=>({fieldPath}))},
                    where: {fieldFilter: {field: {fieldPath:'category'}, op:'EQUAL', value:{stringValue:'PERSON'}}}
                }}), signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) throw new Error('강사 사진을 불러오지 못했습니다.');
            const rows = await response.json();
            if (expected !== generation || getUser()?.uid !== user.uid) throw stale();
            return rows.flatMap(row=>{
                const f=row.document?.fields, value=k=>f?.[k]?.stringValue||'';
                return f && value('lookupKey').startsWith('user:') && value('status')!=='DELETED'
                    ? [{name:value('displayName'),url:value('imageUrl')||value('downloadURL')}] : [];
            });
        },
        async authorize() {
            const expected = generation;
            const result = await request('/session', undefined, expected);
            actor = result.data;
            if (!actor || actor.uid !== getUser()?.uid) { actor = null; throw new Error('직원 권한을 확인하지 못했습니다. 다시 시도해 주세요.'); }
            return actor;
        },
        async rpc(rpc, params = {}, {fresh = false} = {}) {
            if (!actor || actor.uid !== getUser()?.uid) return {data: null, error: {message: '서버 기록을 사용하려면 직원 계정으로 로그인해 주세요.'}};
            try { return structuredClone(await read(rpc, params, fresh)); }
            catch (error) {
                if (error.code !== 'AUTH_CHANGED' && (error instanceof TypeError || error.name === 'TimeoutError')) {
                    const write = /_(save|update|delete)_/.test(rpc);
                    error = new Error(write ? '서버 응답을 확인하지 못했습니다. 변경이 반영되었을 수 있으니 저장 기록을 먼저 확인한 뒤 다시 시도해 주세요. 입력 내용은 유지됩니다.' : '기록 서버에 연결하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.');
                }
                return {data: null, error};
            }
        }
    };
}
export async function initializeAuth(onState) {
    const [{initializeApp}, sdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js')
    ]);
    const auth = sdk.getAuth(initializeApp({apiKey: 'AIzaSyCFM21ZxgwIYwmjRPaAOp5bL9Kprqiyppg', authDomain: 'fir-lms-prod.firebaseapp.com', projectId: 'fir-lms-prod'}, 'feecalc'));
    return createStaffAuth(auth, sdk, onState);
}
export function createSessionVerifier(gateway, onState) {
    let pending = null;
    async function verify(user) {
        gateway.reset();
        onState({state: user ? 'pending' : 'signedOut', user, gateway});
        if (!user) return;
        try { const actor = await gateway.authorize(); onState({state: 'ready', actor, user, gateway}); }
        catch (error) { if (error.code !== 'AUTH_CHANGED') onState({state: 'error', user, message: error instanceof TypeError || error.name === 'TimeoutError' ? '직원 권한을 확인하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.' : error.message || '권한 확인에 실패했습니다. 다시 시도해 주세요.'}); }
    }
    return user => {
        // Firebase's observer and the SSO completion callback report the same sign-in.
        // Share the in-flight authorization only; later checks still revalidate grants.
        if (user && pending?.uid === user.uid) return pending.task;
        const item = {uid: user?.uid, task: null};
        pending = item;
        item.task = verify(user).finally(() => { if (pending === item) pending = null; });
        return item.task;
    };
}
export async function createStaffAuth(auth, sdk, onState, fetcher = fetch) {
    const gateway = createGateway({fetcher, getUser: () => auth.currentUser, onDenied: message => onState({state: 'denied', message, user: auth.currentUser})});
    await sdk.setPersistence(auth, sdk.browserSessionPersistence);
    const check = createSessionVerifier(gateway, onState);
    sdk.onAuthStateChanged(auth, check);
    const {installSso} = await import('./hub-client.mjs');
    await installSso({appId:'fees',brokerUrl:'https://asia-northeast3-fir-lms-prod.cloudfunctions.net/hubSsoApi',hubOrigins:['https://sedubanpo.github.io'],
      async signIn(token,uid){const c=await sdk.signInWithCustomToken(auth,token);if(c.user.uid!==uid)throw Error('Identity mismatch');await check(c.user);if(!gateway.actor)throw Error('Staff access denied');},
      signOut:()=>sdk.signOut(auth)
    });

    return {gateway, retry: () => check(auth.currentUser), logout: () => sdk.signOut(auth),
        async login(identifier, password) {
            try {
                await sdk.signInWithEmailAndPassword(auth, normalizeLogin(identifier), password);
                // Same-UID sign-in need not fire the auth observer; always recheck staff access.
                await check(auth.currentUser);
            }
            catch (error) {
                if (error.code === 'auth/network-request-failed') throw new Error('로그인 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
                if (error.code === 'auth/too-many-requests') throw new Error('로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
                throw new Error('로그인 정보를 확인해 주세요. 기존 직원 계정의 이메일 또는 휴대전화 번호와 비밀번호를 입력해 주세요.');
            }
        }
    };
}
