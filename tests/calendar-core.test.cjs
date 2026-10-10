const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../calendar-core.js'),fixtures=require('./fixtures/calendar.cjs');
test('35 lessons and grouped receipt preserve the multi-course fixture totals',()=>{const a=fixtures.planned(),rows=a.templates.map(t=>({name:`${t.subject}-개별(${t.teacher})-${t.hours}h`,hours:t.hours,rate:t.rate,dates:t.dates})),lessons=C.expand(rows,'select','2026-09');assert.equal(lessons.length,35);assert.equal(lessons.reduce((s,r)=>s+r.hours,0),113);assert.equal(lessons.reduce((s,r)=>s+r.amount,0),3262500);assert.equal(C.groups(lessons).length,5);});
test('same day subjects, teachers and additional sessions stay independent',()=>{const rows=[{name:'수학-개별(A)-3h',hours:3,rate:87500,dates:[10],schedule:{overrides:{10:{hours:2,rate:62500}},additional:[{id:'second',day:10,hours:1,rate:30000}]}},{name:'국어-개별(B)-3h',hours:3,rate:87500,dates:[10]}];const l=C.expand(rows,'select','2026-09');assert.equal(l.length,3);assert.equal(l.filter(r=>r.subject==='국어')[0].amount,87500);rows[0].schedule.removed=[10];assert.equal(C.expand(rows,'select','2026-09').length,2);assert.equal(C.expand(rows,'select','2026-09',[10]).length,0);});
test('round per lesson; decimal hourly rates; unknown is not explicit zero',()=>{const l=C.expand([{name:'수학',hours:3,rate:29166.6667,rateMode:'perHour',dates:[1,2,3]},{name:'영어',hours:2,rate:0,dates:[1]},{name:'국어',hours:2,rate:0,rateKnown:false,dates:[1]}],'select','2026-09');assert.equal(l.filter(r=>r.subject==='수학').reduce((s,r)=>s+r.amount,0),262500);assert.equal(l.find(r=>r.subject==='영어').amount,0);assert.equal(l.find(r=>r.subject==='국어').amount,null);});
test('patterns require confirmation and exclude cancellations, absence, makeup and one-off notes',()=>{const row=(id,date,kind='regular',note='')=>({id,date,className:'수학-개별정규(A)-3h',teacher:'A',start:'14:00',end:'17:00',minutes:180,amount:87500,kind,note});const result=C.candidates({studentId:'a',month:'2026-09',lessons:[row('a','2026-09-01'),row('b','2026-09-08'),row('c','2026-09-15','cancel'),row('d','2026-09-22','absence'),row('e','2026-09-29','regular','오늘만')]});assert.equal(result.rows.length,1);assert.equal(result.rows[0].sourceIds.length,2);assert.equal(result.excluded.length,3);assert.ok(result.rows[0].reasons.includes('다음 달 시간표·변경 안내 대조'));});
test('source picker groups a class across weekdays but preserves two independent same-day sessions',()=>{
    const row=(id,date,start,end)=>({id,date,className:'수학-개별정규(A)-3h',teacher:'A',start,end,minutes:180,amount:87500,kind:'regular'});
    const across=C.groupCandidates(C.candidates({month:'2026-09',lessons:[row('a','2026-09-01','14:00','17:00'),row('b','2026-09-08','15:00','18:00'),row('c','2026-09-03','14:00','17:00')]}).rows);
    assert.equal(across.length,1);assert.deepEqual(across[0].weekdays.map(day=>[day.day,day.count,day.suggested]),[[2,2,true],[4,1,false]]);
    const sameDay=C.groupCandidates(C.candidates({month:'2026-09',lessons:[row('a','2026-09-01','10:00','13:00'),row('b','2026-09-01','14:00','17:00')]}).rows);
    assert.equal(sameDay.length,2);assert.notEqual(sameDay[0].id,sameDay[1].id);
});
test('comparison preserves missing, zero, new and removed subjects',()=>{const r=C.compareHours({수학:20,영어:10,과학:0},{수학:25,영어:0,국어:10});assert.equal(r.find(x=>x.subject==='수학').percent,-20);assert.equal(r.find(x=>x.subject==='영어').label,'신규');assert.equal(r.find(x=>x.subject==='과학').label,'비교 자료 없음');assert.equal(r.find(x=>x.subject==='국어').percent,-100);});
test('schedule validation rejects invalid dates and markup before state changes',()=>{assert.throws(()=>C.validateSchedule({overrides:{32:{hours:2,rate:100}}},'2026-09'));assert.throws(()=>C.validateSchedule({overrides:{2:{hours:'<img>',rate:100}}},'2026-09'));assert.throws(()=>C.validateSchedule({additional:[{id:'bad',day:2,hours:2,rate:-1}]},'2026-09'));});

test('legacy aggregate rounding remains stable while new calculations round per lesson',()=>{const r={name:'수학',hours:1.25,rate:10000.5,rateMode:'perHour',dates:[1,2,3],legacyAggregate:true};assert.equal(C.expand([r],'select','2026-09').reduce((n,r)=>n+r.amount,0),37502);r.legacyAggregate=false;assert.equal(C.expand([r],'select','2026-09').reduce((n,r)=>n+r.amount,0),37503);});

test('next month needs three distinct weekly occurrences and excludes unknown/one-off terms',()=>{
 const row=(id,date,extra={})=>({id,date,className:'수학-개별(검증)-2h',teacher:'검증',minutes:120,amount:62500,start:'16:00',end:'18:00',kind:'regular',...extra});
 const lessons=[1,8,15].map((d,i)=>row('stable'+i,'2026-09-'+String(d).padStart(2,'0')));
 lessons.push(row('dup','2026-09-15'),row('once','2026-09-02'),...['03','10','17'].map((d,i)=>row('unknown'+i,'2026-09-'+d,{amount:null})),row('makeup','2026-09-22',{kind:'cancelMakeup'}),row('note','2026-09-29',{note:'오늘만 대체'}));
 const p=C.nextMonthPlan({month:'2026-09',lessons},'2026-10');assert.equal(p.groups.length,1);assert.deepEqual(p.groups[0].days,[2]);assert.deepEqual(p.groups[0].dates,[6,13,20,27]);assert.equal(p.groups[0].total,250000);assert.equal(p.groups[0].schedule.overrides[6].start,'16:00');assert.equal(p.skipped,6);
 assert.equal(C.nextMonthPlan({month:'2026-09',lessons:lessons.slice(0,2)},'2026-10').groups.length,0);
});
test('next-month rollover keeps independent sessions and valid February dates',()=>{
 const lessons=[1,8,15].flatMap(d=>['10:00','16:00'].map((start,i)=>({id:d+start,date:'2026-12-'+String(d).padStart(2,'0'),className:'수학-개별(검증)-2h',teacher:'검증',minutes:120,amount:50000,start,end:i?'18:00':'12:00',kind:'regular'})));
 const p=C.nextMonthPlan({month:'2026-12',lessons},'2027-01');assert.equal(p.groups.length,2);assert.equal(p.groups.reduce((n,g)=>n+g.total,0),400000);
 assert.ok(C.nextMonthPlan({month:'2026-12',lessons},'2027-02').groups.every(g=>g.dates.every(d=>d<=28)));
});

test('Saturday recurrence survives a clock shift without merging geography or other tuition terms',()=>{
 const row=(d,subject,start='13:00',amount=375000)=>({id:String(d),date:`2026-09-${d}`,className:`${subject}-1:1(검증)-3h`,teacher:'검증',minutes:180,amount,start,end:start==='14:00'?'17:00':'16:00',kind:'regular'});
 const lessons=[row('05','지리'),row('12','사회'),row('19','사회'),row('26','사회','14:00')];
 const result=C.nextMonthPlan({month:'2026-09',lessons},'2026-10');
 assert.equal(result.groups.length,1);const g=result.groups[0];assert.equal(g.subject,'사회');assert.deepEqual(g.days,[6]);assert.equal(g.count,5);assert.equal(g.total,1875000);assert.equal(g.schedule.overrides[3].start,'14:00');assert.equal(result.skipped,1);
 lessons[3].amount=250000;assert.equal(C.nextMonthPlan({month:'2026-09',lessons},'2026-10').groups.length,0);
});

test('notice groups the same teacher across subjects without losing variants, totals or unknown amounts',()=>{
 const rows=[{subject:'사회',teacher:'강사T',type:'개별정규',hours:2,rate:null,amount:62500,status:'출석'},{subject:'사탐',teacher:'강사',type:'개별정규',hours:2,rate:null,amount:62500,status:'출석'},{subject:'통사',teacher:'강사',type:'개별정규',hours:2,rate:null,amount:null,status:'결석예고'}];
 const before=JSON.stringify(rows),groups=C.groups(rows,true);assert.equal(groups.length,1);assert.equal(groups[0].total,125000);assert.equal(groups[0].pending,true);assert.equal(groups[0].variants.size,3);assert.deepEqual(groups[0].subjects,['사회','사탐','통사']);assert.equal(JSON.stringify(rows),before);
 assert.equal(C.groups([{...rows[0],teacher:''},{...rows[1],teacher:''}],true).length,2);
});

test('unknown source durations stay unknown in notices and subject comparisons',()=>{
 const snapshot={lessons:[{id:'missing',date:'2026-09-01',className:'수학-개별(A)',teacher:'A',minutes:null,amount:50000,start:'',end:'',kind:'regular'},{id:'known',date:'2026-09-02',className:'수학-개별(A)',teacher:'A',minutes:120,amount:50000,start:'10:00',end:'12:00',kind:'regular'},{id:'absent',date:'2026-09-03',className:'영어-개별(B)',teacher:'B',minutes:0,amount:0,start:'10:00',end:'12:00',kind:'absence'}]};
 const rows=C.normalizeSnapshot(snapshot);assert.equal(rows[0].hours,null);assert.equal(rows[2].hours,0);
 assert.deepEqual(C.hoursBySubject(rows),{수학:null,영어:0});
 assert.deepEqual(C.hoursBySubject(rows.slice().reverse()),{영어:0,수학:null});
 const priorMissing=C.compareHours({수학:10},{수학:null})[0];assert.equal(priorMissing.percent,null);assert.equal(priorMissing.label,'비교 자료 없음');
 const currentMissing=C.compareHours({수학:null},{수학:10})[0];assert.equal(currentMissing.current,null);assert.equal(currentMissing.percent,null);assert.equal(currentMissing.label,'현재 시수 확인 필요');
});

test('previous notice draft validation preserves explicit zero and unknown values; rejects corrupt records',()=>{
 const lesson=C.normalizeSnapshot({lessons:[{id:'one',date:'2026-09-01',className:'수학-개별(A)',teacher:'A',minutes:null,amount:null,start:'',end:'',kind:'regular'}]})[0];
 const draft={studentId:'one',month:'2026-09',targetMonth:'2026-10',fetchedAt:'2026-10-03T00:00:00Z',lessons:[lesson],adjustments:[{id:'desk:p',label:'기수납',amount:-50000},{id:'intranet:zero',label:'시작 잔액',amount:0}]};
 const before=JSON.stringify(draft);C.validatePriorNotice(draft);assert.equal(JSON.stringify(draft),before);
 for(const invalid of [{lessons:[{...lesson,day:31}]},{lessons:[{...lesson,hours:-1}]},{lessons:[{...lesson,amount:'50000'}]},{lessons:[{...lesson,status:null}]},{lessons:[lesson,lesson]},{adjustments:[{id:'p',label:'납부',amount:Infinity}]},{fetchedAt:null},{month:'2026-10'}])assert.throws(()=>C.validatePriorNotice({...draft,...invalid}));
 C.validatePriorNotice(null);C.validatePriorNotice(undefined);
});

test('absence notice missing time and amount is explicitly excluded from notice billing',()=>{
 const snapshot={lessons:[{id:'abs',date:'2026-10-02',className:'영어',teacher:'검증',minutes:null,amount:null,kind:'absence'}]};const before=JSON.stringify(snapshot);
 const row=C.normalizeSnapshot(snapshot)[0];assert.equal(row.hours,0);assert.equal(row.amount,0);assert.equal(row.status,'결석예고');assert.equal(JSON.stringify(snapshot),before);
});

test('next-month forecasts seed short patterns without importing temporary or unresolved lessons',()=>{
 const row=(id,date,extra={})=>({id,date,className:'수학-개별(A)-3h',teacher:'A',minutes:180,amount:87500,start:'16:00',end:'19:00',kind:'regular',predicted:true,...extra});
 const snapshot={month:'2026-10',lessons:[row('forecast','2026-10-30'),row('temporary','2026-10-29',{temporary:true}),row('unknown','2026-10-28',{amount:null}),row('absence','2026-10-27',{kind:'absence'}),row('once','2026-10-26',{note:'오늘만'}),row('actual','2026-10-24',{predicted:false})]};
 const original=JSON.stringify(snapshot),plan=C.nextMonthPlan(snapshot,'2026-11');
 assert.equal(plan.groups.length,1);assert.equal(plan.groups[0].forecastBased,true);assert.deepEqual(plan.groups[0].dates,[6,13,20,27]);assert.equal(plan.groups[0].total,350000);assert.equal(plan.skipped,5);assert.equal(JSON.stringify(snapshot),original);
});
