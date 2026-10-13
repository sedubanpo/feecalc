import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.env.API_ROOT?pathToFileURL(process.env.API_ROOT+'/'):new URL('../sedu-intranet/functions/',import.meta.url);
const {readFeeCalcProgress}=await import(new URL('feecalcProgress.js',root));
const hash=m=>createHash('sha256').update('qa|'+m).digest('hex');
const lesson=(id,date,rate)=>({id,studentId:'qa',date,className:'영어-1:1-검증T',teacher:'검증T',start:'18:00',end:'20:00',sourceMinutes:120,billMinutes:120,payMinutes:120,rate,rateUnit:'perHour',kind:'regular',reviewed:false,warnings:[]});
function database(draft,includeDonor=true){
 const old=lesson('sep','2026-09-08',100000);
 const values={'students/qa':{name:'검증'},'intranetStaffScopes/staff':{enabled:true,campusId:'banpo',readPayments:true},
 [`intranetLegacyPeriods/${hash('2026-09')}`]:{studentId:'qa',month:'2026-09',lessons:includeDonor?[old]:[]},
 [`intranetStudentPeriods/${hash('2026-10')}`]:{studentId:'qa',month:'2026-10',lessons:[lesson('oct','2026-10-06',null)]},
 ...(draft?{'intranetLessonDrafts/correction':{month:'2026-09',updatedAt:'2026-10-13',lesson:{...old,...draft}}}:{})};
 const snap=(p,d)=>({id:p.split('/').at(-1),exists:!!d,data:()=>d});
 return {doc:p=>({get:async()=>snap(p,values[p])}),collection:name=>{let filters=[],limit=10000;const q={where(k,op,v){filters.push([k,op,v]);return q},limit(n){limit=n;return q},async get(){const docs=Object.entries(values).filter(([p,d])=>p.startsWith(name+'/')&&filters.every(([k,op,v])=>{const a=k.split('.').reduce((a,k)=>a?.[k],d);return op==='=='?a===v:op==='<'?a<v:a<=v})).slice(0,limit).map(([p,d])=>snap(p,d));return {size:docs.length,docs}}};return q}};
}
test('saved previous-month correction gives 100,000 per two-hour lesson, not 200,000',async()=>{
 const r=await readFeeCalcProgress(database({rate:100000,rateUnit:'perClass'}),'staff','qa','2026-10');
 assert.equal(r.lessons[0].minutes,120);assert.equal(r.lessons[0].amount,100000);
 const {default:P}=await import(new URL('./progress-core.js',import.meta.url));
 const forecast=P.calculate({snapshot:r,mode:'auto',cutoff:'2026-10-12',endDate:'2026-10-31'},'2026-10-13');
 assert.equal(forecast.predicted.length,3);assert.equal(forecast.predictedAmount,300000);assert.equal(forecast.actualAmount,100000);
});
test('genuine hourly 100,000 remains 200,000 for two hours',async()=>{
 const r=await readFeeCalcProgress(database(),'staff','qa','2026-10');assert.equal(r.lessons[0].amount,200000);
});
test('deleted historical donor cannot restore its outdated price',async()=>{
 const r=await readFeeCalcProgress(database({deletedAt:'2026-10-13'}),'staff','qa','2026-10');assert.equal(r.lessons[0].amount,null);
});
test('new unpublished historical draft is not recurring price evidence',async()=>{
 const r=await readFeeCalcProgress(database({rate:100000,rateUnit:'perClass'},false),'staff','qa','2026-10');assert.equal(r.lessons[0].amount,null);
});
