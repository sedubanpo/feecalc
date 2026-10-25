const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../progress-core.js'),C=require('../calendar-core.js');
const row=(id,date,extra={})=>({id,date,className:'수학-개별-검증강사',teacher:'검증강사',kind:'regular',start:'16:00',end:'18:00',minutes:120,amount:60000,...extra});
const state=lessons=>({snapshot:{studentId:'qa',month:'2026-10',lessons},mode:'auto',cutoff:'2026-10-09',endDate:'2026-10-16'});
const run=s=>P.calculate(s,'2026-10-09');
test('Mon/Wed/Fri regular lessons never pick up Tuesday makeups; actual charges survive',()=>{
 for(const kind of ['absenceMakeup','cancelMakeup','lateMakeup','free','보충','보강','당취보충','결석보강']){
  const lessons=[row('mon','2026-10-05'),row('wed','2026-10-07'),row('fri','2026-10-09'),row('makeup','2026-10-06',{kind,amount:kind==='free'?0:45000})];
  const s=state(lessons),before=JSON.stringify(s),result=run(s);
  assert.deepEqual(result.predicted.map(r=>r.date),['2026-10-12','2026-10-14','2026-10-16']);
  assert.equal(result.actualAmount,180000+(kind==='free'?0:45000));assert.equal(result.actual.length,4);
  assert.equal(result.excludedMakeupCount,1);assert.equal(JSON.stringify(s),before);
 }
});
test('legacy class/status makeup labels and makeup-only months do not become recurring',()=>{
 for(const extra of [{className:'수학-보강-검증강사'},{status:'보충'},{className:'수학-개별-검증강사 (결석보강)'},{kind:'absenceMakeup'}]){
  const s=state([row('only','2026-10-06',extra)]);assert.equal(run(s).predicted.length,0);assert.equal(run(s).actualAmount,60000);
 }
});
test('makeup at another time on the same weekday cannot replace the regular duration, time or fee',()=>{
 const s=state([row('regular','2026-10-02'),row('makeup','2026-10-09',{kind:'absenceMakeup',start:'10:00',end:'13:00',minutes:180,amount:90000})]);
 const r=run(s).predicted[0];assert.equal(r.date,'2026-10-16');assert.equal(r.start,'16:00');assert.equal(r.minutes,120);assert.equal(r.amount,60000);
});
test('future makeups at separate times coexist with regular forecasts, overlaps still block duplicates',()=>{
 const s=state([row('regular','2026-10-02'),row('makeup','2026-10-16',{kind:'absenceMakeup',start:'10:00',end:'12:00'})]);
 assert.equal(run(s).predicted.length,1);assert.equal(run(s).actualAmount,120000);
 for(const [start,end] of [['16:00','18:00'],['15:00','17:00'],['',''],['19:00','18:00']]){
  s.snapshot.lessons[1]={...s.snapshot.lessons[1],start,end};assert.equal(run(s).predicted.length,0);
 }
 s.snapshot.lessons[1]={...s.snapshot.lessons[1],start:'18:00',end:'20:00'};assert.equal(run(s).predicted.length,1);
 s.snapshot.lessons[1].kind='absence';assert.equal(run(s).predicted.length,0);
});
test('an absence can use an earlier regular fee but never a makeup fee as its recurring price',()=>{
 const s=state([row('regular','2026-10-02',{amount:62500}),row('makeup','2026-10-09',{kind:'absenceMakeup',amount:10000}),row('abs','2026-10-16',{kind:'absence',minutes:0,amount:0})]);
 s.cutoff='2026-10-16';s.endDate='2026-10-23';assert.equal(run(s).predicted[0].amount,62500);
 s.snapshot.lessons.shift();assert.equal(run(s).predicted[0].amount,null);assert.equal(run(s).pending,1);
});
test('local makeup classification affects recurrence while a one-occurrence clock/amount edit does not',()=>{
 const s=state([row('regular','2026-10-02')]);
 s.edits=[{id:'regular',kind:'absenceMakeup',minutes:120,amount:50000,start:'10:00',end:'12:00'}];
 assert.equal(run(s).predicted.length,0);assert.equal(run(s).actualAmount,50000);assert.equal(s.snapshot.lessons[0].kind,'regular');
 s.edits[0].kind='regular';const r=run(s).predicted[0];assert.equal(r.start,'16:00');assert.equal(r.amount,60000);
});
test('explicit manual dates already based on a makeup remain readable after save/restore',()=>{
 const s=state([row('makeup','2026-10-06',{kind:'absenceMakeup'})]);s.mode='manual';s.manual=[{templateId:'makeup',date:'2026-10-13'}];
 assert.equal(run(JSON.parse(JSON.stringify(s))).predictedAmount,60000);
 s.mode='auto';assert.equal(run(s).predicted.length,0);
});
test('one-session absence edits retain regular forecast fees; a source makeup is not promoted by a draft',()=>{
 const s=state([row('regular','2026-10-02')]);
 s.edits=[{id:'regular',kind:'absence',minutes:0,amount:0,start:'16:00',end:'18:00'}];
 assert.equal(run(s).actualAmount,0);assert.equal(run(s).predicted[0].amount,60000);assert.equal(run(s).pending,0);
 s.snapshot.lessons[0].kind='absenceMakeup';s.edits[0].kind='regular';assert.equal(run(s).predicted.length,0);
});
test('regular schedule changes and unresolved regular fees keep their previous behavior',()=>{
 const s=state([row('old','2026-10-02'),row('new','2026-10-09',{start:'17:00',end:'20:00',minutes:180,amount:null})]);
 const r=run(s);assert.equal(r.predicted[0].start,'17:00');assert.equal(r.predicted[0].minutes,180);assert.equal(r.pending,2);
});
test('next-month candidates exclude labeled makeups even if recorded as regular',()=>{
 for(const extra of [{kind:'absenceMakeup'},{className:'수학-보강-검증강사'},{status:'보충'},{note:'결석 보강'}]){
  const lessons=['2026-10-02','2026-10-09','2026-10-16'].map((date,i)=>row('qa'+i,date,extra));
  assert.equal(C.nextMonthPlan({studentId:'qa',month:'2026-10',lessons},'2026-11').groups.length,0);
 }
});
