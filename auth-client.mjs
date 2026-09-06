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
            const message = response.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : response.status === 403 ? '이 계정에는 기록 접근 권한이 없습니다. 담당자에게 확인해 주세요.' : '기록 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            if ([401, 403].includes(response.status)) { actor = null; generation++; onDenied(message); }
            throw new Error(message);
        }
        const result = await response.json();
        if (expected !== generation || getUser()?.uid !== user.uid) throw stale();
        return result;
    }
    return {
        get actor() { return actor; },
        reset() { actor = null; generation++; },
        async authorize() {
            const expected = generation;
            const result = await request('/session', undefined, expected);
            actor = result.data;
            if (!actor || actor.uid !== getUser()?.uid) { actor = null; throw new Error('직원 권한을 확인하지 못했습니다. 다시 시도해 주세요.'); }
            return actor;
        },
        async rpc(rpc, params = {}) {
            if (!actor || actor.uid !== getUser()?.uid) return {data: null, error: {message: '서버 기록을 사용하려면 직원 계정으로 로그인해 주세요.'}};
            try { return await request('', {rpc, params}); }
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
export async function createStaffAuth(auth, sdk, onState, fetcher = fetch) {
    const gateway = createGateway({fetcher, getUser: () => auth.currentUser, onDenied: message => onState({state: 'denied', message, user: auth.currentUser})});
    await sdk.setPersistence(auth, sdk.browserSessionPersistence);
    async function check(user) {
        gateway.reset();
        onState({state: user ? 'pending' : 'signedOut', user, gateway});
        if (!user) return;
        try { const actor = await gateway.authorize(); onState({state: 'ready', actor, user, gateway}); }
        catch (error) { if (error.code !== 'AUTH_CHANGED') onState({state: 'error', user, message: error instanceof TypeError || error.name === 'TimeoutError' ? '직원 권한을 확인하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.' : error.message || '권한 확인에 실패했습니다. 다시 시도해 주세요.'}); }
    }
    sdk.onAuthStateChanged(auth, check);
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
