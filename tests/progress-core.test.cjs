const test=require('node:test'),assert=require('node:assert/strict'),core=require('../progress-core.js');
const row=(id,date,hours=2,extra={})=>({id,date,className:`수학-개별(검증강사)-${hours}h`,teacher:'검증강사',kind:'regular',start:'16:00',end:'18:00',minutes:hours*60,amount:hours*30000,...extra});
const state=lessons=>({snapshot:{studentId:'qa',month:'2026-09',lessons},cutoff:'2026-09-16',mode:'auto',excluded:[],manual:[]});
test('absence-only weekday bills zero that day and repeats normal fee next week',()=>{
 const s=state([row('absent','2026-09-10',0,{kind:'absence',amount:0,forecastMinutes:120,forecastAmount:62500})]);s.cutoff='2026-09-10';
 const r=core.calculate(s);assert.equal(r.actualAmount,0);assert.equal(r.actual[0].minutes,0);
 assert.deepEqual(r.predicted.map(r=>[r.date,r.minutes,r.amount]),[['2026-09-17',120,62500],['2026-09-24',120,62500]]);
 assert.equal(r.pending,0);assert.equal(s.snapshot.lessons[0].kind,'absence');
});
test('legacy absence uses earlier same-weekday price, unknown price remains pending',()=>{
 const s=state([row('regular','2026-09-03'),row('absence','2026-09-10',0,{kind:'absence',amount:0})]);
 assert.equal(core.calculate(s).predicted[0].amount,60000);
 s.snapshot.lessons.shift();assert.equal(core.calculate(s).predicted[0].amount,null);assert.equal(core.calculate(s).pending,2);
});
test('absence with unknown schedule is pending and does not silently disappear',()=>{
 const r=core.calculate(state([row('a','2026-09-10',0,{kind:'absence',amount:0,start:'',end:'',forecastMinutes:null,forecastAmount:null})]));
 assert.equal(r.predicted.length,2);assert.equal(r.pending,2);
});
test('explicit unresolved forecast fee cannot silently reuse an older fee',()=>{
 const r=core.calculate(state([row('old','2026-09-03'),row('abs','2026-09-10',0,{kind:'absence',amount:0,forecastMinutes:120,forecastAmount:null})]));
 assert.equal(r.predicted[0].amount,null);assert.equal(r.pending,2);
});
test('latest weekday duration repeats to month end, not the average',()=>{
 const r=core.calculate(state([row('old','2026-09-02',2),row('recent','2026-09-09',3)]));
 assert.deepEqual(r.predicted.map(x=>[x.date,x.minutes,x.amount]),[['2026-09-23',180,90000],['2026-09-30',180,90000]]);
 assert.equal(r.actualAmount,150000);
});
test('weekday patterns are independent and current cutoff date is not projected',()=>{
 const r=core.calculate(state([row('wed','2026-09-09',3),row('fri','2026-09-11',2)]));
 assert.deepEqual(r.predicted.map(x=>x.date),['2026-09-18','2026-09-23','2026-09-25','2026-09-30']);
});
test('already entered future lessons and absence dates block duplicates',()=>{
 const r=core.calculate(state([row('base','2026-09-09'),row('future','2026-09-23'),row('absence','2026-09-30',0,{kind:'absence',amount:0})]));
 assert.equal(r.predicted.length,0);
});
test('two same-day sessions remain two; excluded predictions restore without touching source',()=>{
 const s=state([row('a','2026-09-09'),row('b','2026-09-09',2,{start:'19:00',end:'21:00'})]);
 assert.equal(core.calculate(s).predicted.length,4);s.excluded=['a@2026-09-23'];assert.equal(core.calculate(s).predicted.length,3);s.excluded=[];assert.equal(core.calculate(s).predicted.length,4);assert.equal(s.snapshot.lessons.length,2);
});
test('manual dates deduplicate and reject wrong month, invalid date, and past dates',()=>{
 const s=state([row('a','2026-09-09')]);s.mode='manual';s.manual=['2026-09-21','2026-09-21','2026-10-01','2026-09-31','2026-09-15'].map(date=>({templateId:'a',date}));
 assert.deepEqual(core.calculate(s).predicted.map(x=>x.date),['2026-09-21']);
});
test('cancelled/free lessons are not forecast templates; unknown amount is pending not zero',()=>{
 const r=core.calculate(state([row('a','2026-09-09',2,{amount:null}),row('cancel','2026-09-16',3,{kind:'cancel'})]));
 assert.equal(r.predicted.length,2);assert.equal(r.predicted[0].minutes,120);assert.equal(r.pending,3);
});
test('strict imported snapshot validation and leap-year boundaries',()=>{
 const s=state([row('a','2026-09-09')]).snapshot;assert.deepEqual(core.validateSnapshot(s),s);
 for(const bad of [{...s,month:'2026-13'},{...s,lessons:[row('a','2026-09-31')]},{...s,lessons:[row('a','2026-09-09',2,{amount:NaN})]},{...s,lessons:[...s.lessons,...s.lessons]}])assert.throws(()=>core.validateSnapshot(bad));
 assert.equal(core.daysInMonth('2028-02'),29);assert.equal(core.daysInMonth('2026-02'),28);
});
test('Korean today boundary and empty month',()=>{
 assert.equal(core.defaultCutoff(state([row('past','2026-09-15'),row('future','2026-09-30')]).snapshot,'2026-09-16'),'2026-09-15');
 assert.deepEqual(core.calculate(state([])).predicted,[]);
});
test('manual mode can reuse an older duration and prevents duplicate slot templates',()=>{
 const s=state([row('old','2026-09-02',2),row('new','2026-09-09',3),row('otherweekday','2026-09-10',2)]);s.mode='manual';
 assert.ok(core.calculate(s).templates.some(r=>r.minutes===120));
 s.manual=[{templateId:'new',date:'2026-09-21'},{templateId:'otherweekday',date:'2026-09-21'}];
 assert.equal(core.calculate(s).predicted.length,1);
});
test('manual durations cannot overlap, but consecutive sessions are allowed',()=>{
 const s=state([row('a','2026-09-02'),row('b','2026-09-09',3,{end:'19:00'}),row('c','2026-09-10',1,{start:'19:00',end:'20:00'})]);s.mode='manual';
 s.manual=['b','a','c'].map(templateId=>({templateId,date:'2026-09-21'}));
 assert.deepEqual(core.calculate(s).predicted.map(r=>r.templateId),['b','c']);
});
