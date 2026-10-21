import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';
import {fixture,payment} from './fixture.mjs';
const dir=process.env.FEE_HISTORY_SERVER_DIR||path.resolve('../sedu-intranet/functions');
const {readFeeCalcMonthlyHistory,memoReader}=await import(pathToFileURL(path.join(dir,'feecalcMonthlyHistory.js')));
const {createFeeCalculatorHandler,validateFeeCalcRequest}=await import(pathToFileURL(path.join(dir,'feecalc.js')));
const hash=s=>createHash('sha256').update(s).digest('hex');
const lesson=(id,date,amount=100000,extra={})=>({id,studentId:'one',date,className:'수학-개별-검증',teacher:'검증',kind:'regular',start:'17:00',end:'19:00',sourceMinutes:120,billMinutes:120,payMinutes:120,rate:amount,rateUnit:'perClass',reviewed:true,warnings:[],note:'',...extra});
const records=(month,rows)=>({['intranetLegacyPeriods/'+hash('one|'+month)]:{studentId:'one',month,lessons:rows},'students/one':{name:'검증학생'}});
const read=(f,m='2026-10')=>readFeeCalcMonthlyHistory(f.db,'staff','one',m);
test('three months reconcile charge, payment, refund and carry without writes or duplicated reads',async()=>{
 const f=fixture({documents:records('2026-09',[lesson('a','2026-09-01'),lesson('b','2026-09-08')]),payments:[payment('p',{sourceDueMonth:'26-09',amount:-150000}),payment('r',{sourceDueMonth:'26-09',amount:20000})]});
 const r=await read(f),sep=r.months[1],oct=r.months[2];assert.equal(sep.charges,200000);assert.equal(sep.paid,130000);assert.equal(sep.closing,70000);assert.equal(oct.opening,70000);assert.equal(oct.closing,70000);assert.equal(r.months[0].opening,null);assert.equal(f.reads.filter(p=>p==='students').length,1);assert.ok(!f.reads.some(p=>p.startsWith('intranetBalanceSnapshots/')));
});
test('saved opening and paid adjustments remain explicit, fractional amount conserved',async()=>{
 const f=fixture({periods:{'2026-09':{opening:{amount:-100.25},paid:{amount:200.5}},'2026-10':{opening:{amount:50}}},documents:records('2026-09',[lesson('a','2026-09-01',300)])});
 const r=await read(f);assert.equal(r.months[1].closing,-.75);assert.equal(r.months[1].openingSource,'saved');assert.equal(r.months[1].paidSource,'saved');assert.equal(r.months[1].openingAdjustment,50.75);assert.equal(r.months[2].opening,50);
});
test('unknown charge blocks output and is not silently zero',async()=>{const f=fixture({documents:records('2026-09',[lesson('a','2026-09-01',0,{rate:null,reviewed:false,warnings:['단가 확인 필요']})])});const r=await read(f);assert.equal(r.months[1].closing,null);assert.ok(r.months[1].blockers.length);assert.equal(r.months[2].opening,null);});
test('ambiguous receipt prevents definitive summary, never leaks other student records',async()=>{
 const f=fixture({students:[{id:'one',name:'검증학생'},{id:'two',name:'검증학생'}],payments:[payment('amb',{sourceDueMonth:'26-09',studentId:''})],documents:records('2026-09',[lesson('a','2026-09-01')])});
 await assert.rejects(read(f),/수납 연결/);
});
test('scope, alias, financial identity and invalid values are rejected',async()=>{
 await assert.rejects(read(fixture({scope:{enabled:false}})),e=>e.status===403);
 await assert.rejects(read(fixture({students:[{id:'one',name:'검증',mergedInto:'two'}]})),e=>e.status===400);
 await assert.rejects(read(fixture({financialStudent:'two'})),e=>e.status===409);
 await assert.rejects(read(fixture({periods:{'2026-09':{opening:{amount:'10'}}}})),e=>e.status===409);
 await assert.rejects(read(fixture(),'2029-10'),e=>e.status===413);
});
test('source edit changes fingerprint; identical fresh read preserves fingerprint',async()=>{const f=fixture({documents:records('2026-09',[lesson('a','2026-09-01')])}),a=await read(f),b=await read(f);assert.equal(a.fingerprint,b.fingerprint);const c=await read(fixture({documents:records('2026-09',[lesson('a','2026-09-01',200000)])}));assert.notEqual(a.fingerprint,c.fingerprint);});
test('gateway authenticates every history request and never contacts Supabase',async()=>{
 const params={p_student_id:'one',p_month:'2026-10'};assert.equal(validateFeeCalcRequest({rpc:'feecalc_monthly_history',params}).rpc,'feecalc_monthly_history');
 for(const p of [{...params,path:'students'},{...params,p_student_id:'../one'},{...params,p_month:'2026-13'}])assert.throws(()=>validateFeeCalcRequest({rpc:'feecalc_monthly_history',params:p}));
 const f=fixture(),handler=createFeeCalculatorHandler({db:f.db,auth:{verifyIdToken:async()=>({uid:'staff'})},getServiceKey:()=>{throw Error('no secret');},fetchImpl:()=>{throw Error('no upstream');}});
 const response=()=>({set(){return this;},status(n){this.code=n;return this;},json(b){this.body=b;return this;}});
 let res=response();await handler({method:'POST',path:'/',headers:{'content-type':'application/json'},body:{rpc:'feecalc_monthly_history',params}},res);assert.equal(res.code,401);
 res=response();await handler({method:'POST',path:'/',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:{rpc:'feecalc_monthly_history',params}},res);assert.equal(res.code,200);assert.equal(res.body.data.studentId,'one');
});
test('request local memo joins concurrent reads but never spans requests',async()=>{let calls=0;const db={doc:p=>({get:async()=>{calls++;return{data:()=>({})};}})};const m=memoReader(db);await Promise.all([m.doc('one').get(),m.doc('one').get()]);assert.equal(calls,1);await memoReader(db).doc('one').get();assert.equal(calls,2);});
