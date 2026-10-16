const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../progress-core.js'),C=require('../calendar-core.js');
const lesson={id:'one',date:'2026-10-09',className:'국어-개별-검증',teacher:'검증',start:'15:00',end:'18:00',minutes:180,amount:87500,kind:'regular'};
test('occurrence status persists and zero-priced states cannot retain charges',()=>{
 for(const kind of ['absence','free','cancelMakeup']){
 const edit={id:'one',kind,minutes:180,amount:50000,start:'15:00',end:'18:00'};
 const edits=P.validateEdits(JSON.parse(JSON.stringify([edit])));
 assert.equal(edits[0].kind,kind);
 const result=P.calculate({snapshot:{studentId:'qa',month:'2026-10',lessons:[lesson]},edits,mode:'manual'},'2026-10-16');
 assert.equal(result.actualAmount,kind==='cancelMakeup'?50000:0);
 }
 assert.throws(()=>P.validateEdits([{...lesson,kind:'unknown'}]));
});
test('weekday and selected-date occurrence statuses survive schedule serialization',()=>{
 for(const mode of ['auto','select'])for(const kind of ['absence','free','cancelMakeup']){
 const schedule=JSON.parse(JSON.stringify({overrides:{9:{kind,hours:3,rate:50000}}}));C.validateSchedule(schedule,'2026-10');
 const rows=C.expand([{name:'국어-개별-검증',hours:3,rate:87500,rateKnown:true,rateMode:'perClass',days:[5],dates:[9],schedule}],mode,'2026-10');
 const r=rows.find(r=>r.day===9);assert.equal(r.amount,kind==='cancelMakeup'?50000:0);assert.equal(r.kind,kind);assert.notEqual(r.status,'예정');
 }
});
