import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGateway, normalizeLogin} from '../auth-client.mjs';
const reply = (data, status = 200) => ({ok: status === 200, status, json: async () => data});
const user = uid => ({uid, getIdToken: async () => 'test-token'});
test('existing email and phone identifiers', () => {
    assert.equal(normalizeLogin('  staff@example.com '), 'staff@example.com');
    assert.equal(normalizeLogin('010-1234-5678'), '01012345678@sedu-auth.local');
    assert.throws(() => normalizeLogin('invalid'));
});
test('signed out and unverified accounts never make RPC calls', async () => {
    let calls = 0;
    const gateway = createGateway({getUser: () => user('a'), fetcher: async () => {calls++;}});
    assert.ok((await gateway.rpc('feecalc_list_records')).error);
    assert.equal(calls, 0);
});
test('authorized RPC uses bearer and gateway envelope without access code', async () => {
    const calls = [];
    const gateway = createGateway({getUser: () => user('a'), fetcher: async (url, init) => {
        calls.push({url, init}); return reply(url.endsWith('/session') ? {data: {uid: 'a', name: '직원'}, error: null} : {data: [], error: null});
    }});
    await gateway.authorize();
    assert.deepEqual(await gateway.rpc('feecalc_list_records', {p_limit: 120}), {data: [], error: null});
    assert.equal(calls[1].init.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(calls[1].init.body), {rpc: 'feecalc_list_records', params: {p_limit: 120}});
    assert.ok(!calls[1].url.includes('token'));
});
test('401 and 403 invalidate authorization and prevent subsequent RPC', async () => {
    for (const status of [401, 403]) {
        let denied = '', calls = 0;
        const gateway = createGateway({getUser: () => user('a'), onDenied: message => denied = message, fetcher: async url => {
            calls++; return reply(url.endsWith('/session') ? {data: {uid:'a'}} : {error:{}}, url.endsWith('/session') ? 200 : status);
        }});
        await gateway.authorize(); assert.ok((await gateway.rpc('feecalc_list_records')).error);
        assert.equal(gateway.actor, null); assert.ok(denied);
        await gateway.rpc('feecalc_list_records'); assert.equal(calls, 2);
    }
});
test('account transition rejects a delayed response', async () => {
    let active = user('a'), resolve;
    const gateway = createGateway({getUser: () => active, fetcher: async url => url.endsWith('/session') ? reply({data:{uid:'a'}}) : new Promise(r => resolve = r)});
    await gateway.authorize(); const pending = gateway.rpc('feecalc_get_record');
    await Promise.resolve(); active = user('b'); gateway.reset(); resolve(reply({data: {payload: 'secret'}}));
    const result = await pending; assert.equal(result.data, null); assert.equal(result.error.code, 'AUTH_CHANGED');
});
test('network error returns failure without changing authorized actor', async () => {
    const gateway = createGateway({getUser: () => user('a'), fetcher: async url => {
        if (url.endsWith('/session')) return reply({data:{uid:'a'}});
        throw new Error('offline');
    }});
    await gateway.authorize(); assert.ok((await gateway.rpc('feecalc_save_record')).error); assert.equal(gateway.actor.uid, 'a');
});
test('inline application compiles and contains no direct Supabase authentication', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    for (const [, attrs, script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) if (!attrs.includes('src=')) new vm.Script(script);
    assert.doesNotMatch(html, /SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|p_access_code|FEECALC_DEFAULT_ACCESS_CODE|serverAccessCode/);
    assert.match(html, /localStorage.removeItem\('feecalc_access_code'\)/);
});

test('same UID reauthentication explicitly checks session without observer event', async () => {
    const {createStaffAuth} = await import('../auth-client.mjs');
    const auth = {currentUser: user('a')};
    const states = [], calls = [];
    const sdk = {setPersistence: async () => {}, browserSessionPersistence: {}, onAuthStateChanged: () => {},
        signInWithEmailAndPassword: async () => ({user: auth.currentUser}), signOut: async () => {}};
    const controller = await createStaffAuth(auth, sdk, state => states.push(state.state), async url => {calls.push(url); return reply({data:{uid:'a'}});});
    await controller.login('staff@example.com', 'test-password');
    assert.deepEqual(states, ['pending', 'ready']); assert.equal(calls.length, 1);
});
test('write timeout communicates uncertain completion and asks to inspect records', async () => {
    const gateway = createGateway({getUser: () => user('a'), fetcher: async url => {
        if (url.endsWith('/session')) return reply({data:{uid:'a'}});
        throw Object.assign(new Error('timeout'), {name:'TimeoutError'});
    }});
    await gateway.authorize();
    const {error} = await gateway.rpc('feecalc_save_record');
    assert.match(error.message, /반영되었을 수/); assert.match(error.message, /저장 기록을 먼저 확인/);
});
function inlineFunction(name) {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const start = html.search(new RegExp(`(?:async )?function ${name}\\(`));
    const end = html.indexOf('\n        function ', start + 1);
    const asyncEnd = html.indexOf('\n        async function ', start + 1);
    return html.slice(start, Math.min(...[end, asyncEnd].filter(x => x > start)));
}
test('hidden memo clears actual private DOM text', () => {
    const nodes = Object.fromEntries(['studentMemoWidget','studentMemoWidgetName','studentMemoWidgetCount','studentMemoWidgetBody'].map(id => [id, {textContent:'private student',innerHTML:'private memo',classList:{toggle(){}}}]));
    vm.runInNewContext(inlineFunction('renderStudentMemoWidget') + ";renderStudentMemoWidget('', [])", {document:{getElementById:id => nodes[id]}});
    assert.equal(nodes.studentMemoWidgetName.textContent, ''); assert.equal(nodes.studentMemoWidgetBody.innerHTML, '');
});
test('delayed memo payload cannot repopulate cleared cache across auth change', async () => {
    let resolve;
    const context = {staffAuthEpoch:1, memoPayloadCache:{}, isServerConfigured:()=>true,
        getSupabaseClient:()=>({rpc:()=>new Promise(r=>resolve=r)}), mapRecordRow:x=>x};
    vm.createContext(context); vm.runInContext(inlineFunction('fetchServerRecordPayload'), context);
    const pending = context.fetchServerRecordPayload({recordId:'r'}); context.staffAuthEpoch++;
    resolve({data:{payload:{recordMemo:'private'}}});
    assert.equal(await pending, null); assert.deepEqual(context.memoPayloadCache, {});
});
test('different UID resets auth and reloads before history can initialize; same UID error preserves work', async () => {
    let reloads=0, resets=0;
    const nodes = new Map();
    const context = {accountSwitchPending:false, staffAuthEpoch:1, previousStaffUid:'a', staffAuthReady:true, serverSearchSequence:0, serverLoadSequence:0, memoWidgetToken:0, serverRecordSearchTimer:null,
        serverRecordHistory:[{recordId:'old'}],currentLoadedRecordId:'old', memoPayloadCache:{old:'private'},
        supabaseClient:{reset:()=>resets++}, clearTimeout(){}, renderServerRecordList(){},renderStudentMemoWidget(){}, setServerRecordStatus(){},
        document:{getElementById:id=>{if(!nodes.has(id)) nodes.set(id,{});return nodes.get(id);}},location:{reload:()=>reloads++}};
    vm.createContext(context); vm.runInContext(inlineFunction('handleStaffAuthState'),context);
    await context.handleStaffAuthState({state:'error',user:{uid:'a'},message:'retry'});
    assert.equal(reloads,0); assert.equal(nodes.get('staffLoginForm').hidden,false);
    await context.handleStaffAuthState({state:'pending',user:{uid:'b'}});
    assert.equal(reloads,1); assert.equal(resets,1); assert.equal(context.staffAuthReady,false); assert.equal(context.currentLoadedRecordId,'');
    assert.equal(context.serverRecordHistory.length,0); assert.deepEqual(context.memoPayloadCache,{});
});
test('delayed deletion does not mutate records of the next auth generation', async () => {
    let resolve;
    const context = {staffAuthEpoch:1, window:{confirm:()=>true},setServerRecordStatus(){},
        getSupabaseClient:()=>({rpc:()=>new Promise(r=>resolve=r)}),serverRecordHistory:[{recordId:'r'}],memoPayloadCache:{r:'new user cache'},currentLoadedRecordId:'r'};
    vm.createContext(context);vm.runInContext(inlineFunction('deleteServerRecord'),context);
    const pending = context.deleteServerRecord('r');context.staffAuthEpoch++;resolve({error:null});await pending;
    assert.equal(context.serverRecordHistory.length,1); assert.equal(context.memoPayloadCache.r,'new user cache');
});
test('delayed record load cannot apply data after auth invalidates load sequence', async () => {
    let resolve, applied=0;
    const context = {serverSavePending:false,serverLoadSequence:0,isServerConfigured:()=>true,setServerRecordStatus(){},
        getSupabaseClient:()=>({rpc:()=>new Promise(r=>resolve=r)}),memoPayloadCache:{},applyCalculatorState:()=>applied++};
    vm.createContext(context);vm.runInContext(inlineFunction('loadServerRecord'),context);
    const pending = context.loadServerRecord('r');context.serverLoadSequence++;resolve({data:{payload:{studentName:'private'}}});await pending;
    assert.equal(applied,0);assert.deepEqual(context.memoPayloadCache,{});
});
test('same UID denial/pending/ready retains loaded identity and settings; signed out clears identity', async () => {
    let settingsReads=0;
    const nodes = new Map();
    const context = {accountSwitchPending:false,staffAuthEpoch:1, previousStaffUid:'a',staffAuthReady:true,
        serverSearchSequence:0,serverLoadSequence:0,memoWidgetToken:0,serverRecordSearchTimer:null,
        serverRecordHistory:[],currentLoadedRecordId:'loaded-record',memoPayloadCache:{},supabaseClient:{},
        calculatorEditVersion:0,recordLinkOpened:false,URLSearchParams,window:{location:{search:''}},
        clearTimeout(){},renderServerRecordList(){},renderStudentMemoWidget(){},setServerRecordStatus(){},
        refreshServerRecordList:async()=>{},hydrateSharedSettingsFromServerConfig:async()=>{settingsReads++;return true;},
        document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}},location:{reload(){}}};
    vm.createContext(context);vm.runInContext(inlineFunction('handleStaffAuthState'),context);
    for (const state of ['denied','pending','ready']) {
        await context.handleStaffAuthState({state,user:{uid:'a'},actor:{uid:'a',name:'직원'}});
        assert.equal(context.currentLoadedRecordId,'loaded-record');
        assert.equal(context.staffAuthReady,state==='ready');
    }
    assert.equal(settingsReads,0);
    await context.handleStaffAuthState({state:'signedOut',user:null});assert.equal(context.currentLoadedRecordId,'');
});
