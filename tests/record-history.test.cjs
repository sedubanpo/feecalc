const test=require('node:test'),assert=require('node:assert/strict'),{groupRecords}=require('../record-history.js');
const row=(recordId,studentName,savedAt,extra={})=>({recordId,studentName,savedAt,...extra});
test('groups same display name, newest version first, without mutating records or mixing payloads',()=>{
 const records=[row('a','검증학생','2026-10-01',{payload:{studentId:'one'}}),row('b','다른학생','2026-10-05'),row('c','검증학생','2026-10-09',{payload:{studentId:'two'}})];
 const before=JSON.stringify(records),groups=groupRecords(records);
 assert.equal(groups.length,2);assert.deepEqual(groups[0].records.map(r=>r.recordId),['c','a']);
 assert.equal(groups[0].records[0].payload.studentId,'two');assert.equal(groups[0].records[1].payload.studentId,'one');
 assert.equal(JSON.stringify(records),before);assert.equal(groups[1].name,'다른학생');
});
test('equal timestamps remain distinct versions and unnamed records stay separate',()=>{
 const records=[row('a',' 검증학생 ','2026-10-09'),row('b','검증학생','2026-10-09'),row('c','',''),row('d','','')];
 const groups=groupRecords(records);assert.equal(groups.length,3);assert.deepEqual(groups[0].records.map(r=>r.recordId),['a','b']);
 assert.deepEqual(groupRecords([]),[]);
});
test('unicode names normalize without collapsing meaningful name distinctions',()=>{
 const groups=groupRecords([row('a','가학생',''),row('b','가학생'.normalize('NFD'),''),row('c','가학생b','')]);
 assert.equal(groups.length,2);assert.equal(groups[0].records.length,2);
});
