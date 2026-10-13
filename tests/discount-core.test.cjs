const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discount-core'),P=require('../progress-core'),C=require('../calendar-core');
const part={base:84375,amount:59063,percent:30,special:false};
const lesson={id:'a',date:'2026-10-02',className:'과학-개별-검증',teacher:'검증',start:'10:00',end:'13:00',minutes:180,amount:59063,kind:'regular',discountParts:[part]};
test('discount display preserves per-occurrence rounding without applying discount twice',()=>{
 const rows=Array.from({length:18},()=>lesson);
 assert.match(D.describe(lesson),/30% 할인 적용 · 84,375원 → 59,063원/);
 assert.match(D.summary(rows),/1,518,750원 → 1,063,134원/);
 assert.equal(rows.reduce((s,r)=>s+r.amount,0),1063134);
 assert.equal(D.describe({...lesson,discountParts:undefined}),'');
 assert.equal(D.valid([],null),true);assert.equal(D.valid([{...part,percent:101}],59063),false);
});
test('discount provenance survives forecast and restore but is cleared by amount or duration edits',()=>{
 const snapshot=P.validateSnapshot({studentId:'qa',month:'2026-10',lessons:[lesson]});
 const state={snapshot,mode:'auto',cutoff:lesson.date,endDate:'2026-10-31'};
 const r=P.calculate(state,'2026-10-13');assert.equal(r.predicted.length,4);assert.deepEqual(r.predicted[0].discountParts,[part]);assert.equal(r.actualAmount+r.predictedAmount,59063*5);
 const changed=P.calculate({...state,edits:[{id:'a',amount:50000,minutes:180,start:lesson.start,end:lesson.end}]},'2026-10-13');assert.equal(D.describe(changed.actual[0]),'');assert.equal(changed.predicted[0].amount,59063);
 assert.deepEqual(C.normalizeSnapshot(snapshot)[0].discountParts,[part]);
});
test('absence forecast uses normal discount evidence and keeps actual zero',()=>{
 const snapshot={studentId:'qa',month:'2026-10',lessons:[{...lesson,kind:'absence',minutes:0,amount:0,discountParts:[],forecastMinutes:180,forecastAmount:59063,forecastDiscountParts:[part]}]};
 const r=P.calculate({snapshot,mode:'auto',cutoff:lesson.date},'2026-10-13');assert.equal(r.actualAmount,0);assert.equal(D.describe(r.actual[0]),'');assert.deepEqual(r.predicted[0].discountParts,[part]);
});
test('merged and mixed discounts retain evidence and distinct variants',()=>{
 const merged={...lesson,amount:118126,discountParts:[part,part]};assert.match(D.describe(merged),/168,750원 → 118,126원/);
 const mixed={...merged,discountParts:[part,{base:65625,amount:59063,percent:10,special:true}]};assert.match(D.describe(mixed),/특별 단가 · 10%·30%/);
 const rows=[lesson,{...lesson,discountParts:[{...part,base:59063,percent:0,special:true}]}].map(r=>({...r,subject:'과학',type:'개별',hours:3,status:'출석'}));assert.equal(C.groups(rows,true)[0].variants.size,2);
});
