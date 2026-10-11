const test=require('node:test'),assert=require('node:assert/strict'),core=require('../progress-core.js');
const row=(id,date,hours=2,extra={})=>({id,date,className:`수학-개별(검증강사)-${hours}h`,teacher:'검증강사',kind:'regular',start:'16:00',end:'18:00',minutes:hours*60,amount:hours*30000,...extra});
const state=lessons=>({snapshot:{studentId:'qa',month:'2026-09',lessons},cutoff:'2026-09-16',mode:'auto',excluded:[],manual:[]});
test('completed month never resurrects a missing final weekday as an automatic charge',()=>{
 const s=state([row('math','2026-09-23',3,{amount:87500}),row('other','2026-09-29',2,{amount:3018750,className:'국어-1:1-검증',teacher:'검증'})]);
 s.cutoff='2026-09-29';s.endDate='2026-09-30';const before=JSON.stringify(s);
 for(const today of ['2026-09-29','2026-09-30']){const r=core.calculate(s,today);assert.equal(r.predictedAmount,87500);assert.equal(r.actualAmount+r.predictedAmount-2287500,906250);}
 for(const today of ['2026-10-01','2026-10-03','2027-01-01']){const r=core.calculate(s,today);assert.equal(r.automaticForecastEnded,true);assert.equal(r.predicted.length,0);assert.equal(r.actualAmount,3106250);assert.equal(r.actualAmount+r.predictedAmount-2287500,818750);}
 assert.equal(JSON.stringify(s),before);
});
test('completed month preserves explicit dates, temporary lessons, edits and unresolved actuals',()=>{
 const s=state([row('math','2026-09-23',3,{amount:87500}),row('pending','2026-09-29',2,{amount:null})]);s.cutoff='2026-09-29';
 s.temporary=[row('local:explicit','2026-09-25',2,{amount:0})];s.edits=[{id:'math',minutes:180,amount:80000,start:'15:00',end:'18:00'}];
 let r=core.calculate(s,'2026-10-03');assert.equal(r.predicted.length,1);assert.equal(r.predicted[0].temporary,true);assert.equal(r.actualAmount,80000);assert.equal(r.pending,1);
 s.mode='manual';s.manual=[{templateId:'math',date:'2026-09-30'}];r=core.calculate(s,'2026-10-03');assert.equal(r.predicted.length,2);assert.equal(r.predictedAmount,87500);assert.equal(r.actualAmount,80000);
 s.removedActual=['math'];assert.equal(core.calculate(s,'2026-10-03').actual.length,1);assert.equal(s.snapshot.lessons[0].amount,87500);
});
test('current and future months continue forecasting with an explicit academy date',()=>{
 const s=state([row('math','2026-09-23')]);s.cutoff='2026-09-29';
 for(const today of ['2026-08-31','2026-09-01','2026-09-30']){const r=core.calculate(s,today);assert.equal(r.automaticForecastEnded,false);assert.equal(r.predicted.length,1);}
});
test('forecast end is inclusive and never removes actual lessons after it',()=>{
 const s=state([row('a','2026-09-09'),row('actual','2026-09-29')]);s.endDate='2026-09-23';
 const r=core.calculate(s);assert.deepEqual(r.predicted.map(x=>x.date),['2026-09-23']);assert.equal(r.actual.length,2);assert.equal(r.actualAmount,120000);
 s.endDate=s.cutoff;assert.equal(core.calculate(s).predicted.length,0);
});
test('manual forecasts respect end; old states default to month end',()=>{
 const s=state([row('a','2026-09-09')]);s.mode='manual';s.endDate='2026-09-21';s.manual=['2026-09-21','2026-09-22'].map(date=>({templateId:'a',date}));
 assert.deepEqual(core.calculate(s).predicted.map(x=>x.date),['2026-09-21']);delete s.endDate;assert.equal(core.calculate(s).predicted.length,2);assert.equal(core.monthEnd('2028-02'),'2028-02-29');
});
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
test('temporary drafts allow earlier days, preserve source, and survive cutoff changes',()=>{
 const s=state([row('source','2026-09-09')]);s.endDate=s.cutoff;
 s.temporary=[row('local:one','2026-09-01',2,{start:'18:00',end:'20:00',amount:0}),row('local:two','2026-09-09',1,{start:'19:00',end:'20:00',amount:29166.67})];
 const original=JSON.stringify(s.snapshot),r=core.calculate(s);
 assert.equal(r.actual.length,1);assert.equal(r.predicted.length,2);assert.equal(r.predictedAmount,29166.67);assert.ok(r.predicted.every(x=>x.temporary&&x.predicted));assert.equal(JSON.stringify(s.snapshot),original);
 s.cutoff='2026-09-29';s.endDate='2026-09-30';assert.equal(core.calculate(s).predicted.filter(x=>x.temporary).length,2);
});
test('temporary drafts skip source and forecast overlaps while keeping separate times',()=>{
 const s=state([row('source','2026-09-09')]);
 s.temporary=[row('local:source','2026-09-09'),row('local:forecast','2026-09-23'),row('local:separate','2026-09-09',2,{start:'18:00',end:'20:00'})];
 const r=core.calculate(s);assert.deepEqual(r.predicted.filter(x=>x.temporary).map(x=>x.id),['local:separate']);
 s.snapshot.lessons.push(row('latest','2026-09-09',2,{start:'18:00',end:'20:00'}));assert.equal(core.calculate(s).predicted.filter(x=>x.temporary).length,0);
});
test('temporary draft validation rejects wrong month, identity, unknown/negative amount, and times',()=>{
 const valid=row('local:qa','2026-09-01');assert.equal(core.validateTemporary([valid],'2026-09').length,1);
 for(const extra of [{id:'source'},{date:'2026-10-01'},{amount:null},{amount:-1},{minutes:null},{minutes:0},{start:'25:00'},{end:'17:00'},{teacher:''},{className:''}])assert.throws(()=>core.validateTemporary([{...valid,...extra}],'2026-09'));
 assert.throws(()=>core.validateTemporary([valid,valid],'2026-09'));assert.deepEqual(core.validateTemporary(undefined,'2026-09'),[]);
});

test('local actual edits/exclusions change totals without changing the source or other sessions',()=>{
 const s=state([row('one','2026-09-09'),row('two','2026-09-09',2,{start:'19:00',end:'21:00'})]);s.endDate=s.cutoff;
 const before=JSON.stringify(s.snapshot);s.edits=[{id:'one',minutes:90,amount:50000,start:'16:00',end:'17:30'}];s.removedActual=['two'];
 const r=core.calculate(s);assert.equal(r.actual.length,1);assert.equal(r.actualAmount,50000);assert.equal(r.actual[0].minutes,90);assert.equal(r.actual[0].edited,true);assert.equal(JSON.stringify(s.snapshot),before);
 assert.equal(core.calculate(JSON.parse(JSON.stringify(s))).actualAmount,50000);
 s.edits=[];s.removedActual=[];assert.equal(core.calculate(s).actualAmount,120000);
 assert.throws(()=>core.validateEdits([{id:'one',minutes:NaN,amount:5,start:'',end:''}]));
 assert.throws(()=>core.validateEdits([{id:'one',minutes:120,amount:-5,start:'',end:''}]));
});
test('local forecast edit applies once and cannot change identity/date',()=>{
 const s=state([row('one','2026-09-09')]);s.edits=[{id:'one@2026-09-23',minutes:60,amount:30000,start:'16:00',end:'17:00',date:'2026-10-01',className:'other'}];
 const r=core.calculate(s);assert.equal(r.predictedAmount,90000);assert.equal(r.predicted[0].date,'2026-09-23');assert.equal(r.predicted[0].className,s.snapshot.lessons[0].className);assert.equal(r.actualAmount,60000);
});

test('absence notices waive unknown or locally edited amounts without altering source',()=>{
 const s=state([row('absence','2026-09-01',2,{kind:'absence',minutes:null,amount:null}),row('regular','2026-09-02')]);s.cutoff='2026-09-30';
 s.edits=[{id:'absence',minutes:0,amount:87500,start:'16:00',end:'18:00'}];const before=JSON.stringify(s);
 const r=core.calculate(s,'2026-10-04');assert.equal(r.pending,0);assert.equal(r.actualAmount,60000);assert.equal(r.actual[0].amount,0);assert.equal(JSON.stringify(s),before);
 s.snapshot.lessons[1].amount=null;assert.equal(core.calculate(s,'2026-10-04').pending,1);
});
test('two-month basis restores January courses but never bills historical rows automatically',()=>{
 const snapshot={studentId:'qa',month:'2027-01',lessons:[]};
 const basis=[{studentId:'qa',month:'2026-12',lessons:[row('old','2026-12-10')]}];
 const s={snapshot,basis,mode:'auto',cutoff:'2027-01-01'};
 assert.equal(core.calculate(s,'2027-01-01').actualAmount,0);assert.equal(core.calculate(s,'2027-01-01').predicted.length,0);
 s.mode='manual';const choice=core.calculate(s).templates[0];assert.equal(choice.sourceMonth,'2026-12');
 s.manual=[{templateId:choice.id,date:'2027-01-02'}];assert.equal(core.calculate(s).predictedAmount,60000);assert.equal(core.calculate(s).actual.length,0);
 assert.throws(()=>core.validateBasis([{...basis[0],studentId:'other'}],snapshot));assert.throws(()=>core.validateBasis([{...basis[0],month:'2026-11',lessons:[]}],snapshot));
});
test('unknown recurring absence fee remains pending when explicitly planning a normal class',()=>{
 const s=state([row('waived','2026-09-01',2,{kind:'absence',minutes:null,amount:null,forecastAmount:null,forecastMinutes:120})]);s.mode='manual';s.cutoff='2026-09-01';
 s.manual=[{templateId:'waived',date:'2026-09-02'}];const r=core.calculate(s);assert.equal(r.actualAmount,0);assert.equal(r.pending,1);assert.equal(r.predicted[0].amount,null);
});

test('new current-month equivalent course preserves dates and edits selected from prior basis',()=>{
 const s={snapshot:{studentId:'qa',month:'2026-10',lessons:[]},basis:[{studentId:'qa',month:'2026-09',lessons:[row('prior','2026-09-24')]}],mode:'manual',cutoff:'2026-10-01'};
 const template=core.calculate(s).templates[0],id=template.id;s.manual=[{templateId:id,date:'2026-10-08'}];s.edits=[{id:id+'@2026-10-08',minutes:120,amount:50000,start:'16:00',end:'18:00'}];
 s.snapshot.lessons=[row('current','2026-10-01')];const r=core.calculate(s);assert.equal(r.templates.length,1);assert.ok(r.templates[0].aliases.includes(id));assert.equal(r.predictedAmount,50000);assert.equal(r.predicted[0].id,id+'@2026-10-08');assert.equal(r.predicted[0].templateId,id);
});

test('merged sessions forecast as one lesson while legacy segment edits remain recoverable',()=>{
 const C=require('../progress-core.js');
 const segment=(id,start,end)=>({id,date:'2026-10-02',className:'수학-개별(검증)-2h',teacher:'검증',minutes:60,amount:30000,start,end,kind:'regular'});
 const segments=[segment('a','16:00','17:00'),segment('b','17:00','18:00')];
 const snapshot=C.validateSnapshot({studentId:'qa',month:'2026-10',lessons:[{...segments[0],id:'session:ab',end:'18:00',minutes:120,amount:60000,segments,sourceIds:['a','b']}]});
 const state={snapshot,mode:'auto',cutoff:'2026-10-02',endDate:'2026-10-31'};
 const result=C.calculate(state,'2026-10-11');assert.equal(result.actual.length,1);assert.equal(result.predicted.length,4);assert.equal(result.predictedAmount,240000);assert.ok(result.predicted.every(r=>r.minutes===120));
 for(const draft of [{edits:[{id:'a'}]},{removedActual:['b']},{excluded:['a@2026-10-09']},{manual:[{templateId:'b'}]},{manual:[{templateId:'basis:2026-10:a'}]},{edits:[{id:'basis:2026-10:a@2026-11-06'}]}])assert.equal(C.preserveSessionDraft(snapshot,draft).lessons.length,2);
 const edited=C.calculate({...state,edits:[{id:'session:ab',minutes:120,amount:50000,start:'16:00',end:'18:00'}]},'2026-10-11');assert.equal(edited.actualAmount,50000);assert.equal(snapshot.lessons[0].amount,60000);
 assert.equal(C.calculate({...state,removedActual:['session:ab']},'2026-10-11').actual.length,0);
});
