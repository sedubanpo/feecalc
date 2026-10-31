import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,createSessionVerifier} from '../auth-client.mjs';
test('observer and hub callback share pending session check; next check revalidates',async()=>{
 let calls=0,finish;const user={uid:'staff-a',getIdToken:async()=> 'fixture'};
 const gateway=createGateway({getUser:()=>user,fetcher:async()=>{calls++;return new Promise(r=>finish=()=>r({ok:true,json:async()=>({data:{uid:user.uid}})}));}});
 const states=[],check=createSessionVerifier(gateway,s=>states.push(s.state));
 const a=check(user),b=check(user);assert.equal(a,b);
 await Promise.resolve();await Promise.resolve();assert.equal(calls,1);finish();await a;
 assert.deepEqual(states,['pending','ready']);assert.equal(gateway.actor.uid,user.uid);
 const again=check(user);await Promise.resolve();await Promise.resolve();assert.equal(calls,2);finish();await again;
});
test('account change ignores late response and never reuses previous authorization',async()=>{
 let user={uid:'a',getIdToken:async()=> 'fixture-a'},release;
 const gateway=createGateway({getUser:()=>user,fetcher:async()=>new Promise(r=>release=r)});
 const states=[],check=createSessionVerifier(gateway,s=>states.push(s.state));
 const old=check(user);await Promise.resolve();await Promise.resolve();user=null;await check(null);
 release({ok:true,json:async()=>({data:{uid:'a'}})});await old;
 assert.equal(gateway.actor,null);assert.deepEqual(states,['pending','signedOut']);
});
