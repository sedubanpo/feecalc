import assert from 'node:assert/strict';
const payment=(id,patch={})=>({id,studentName:'검증학생',studentId:'one',sourceMonth:'26-09s',sourceDueMonth:'26-10s',paidAt:'2026-09-30',amount:-200000,itemName:'납부금액',business:'반포',paymentType:'계좌',...patch});
function fixture({students=[{id:'one',name:'검증학생'}],payments=[],mappings=[],periods={},scope={enabled:true,campusId:'banpo',readPayments:true},financialStudent='one',sizeOverride,documents={},followups=[],contacts=[]}={}){
 const reads=[];const lists={students,tuitionPayments:payments,intranetDeskStudentMappings:mappings,intranetFeeApplications:[],intranetStudentFees:[],intranetStudentPeriods:[],intranetLegacyPeriods:[],intranetLessonDrafts:[],intranetIssues:[],tuitionFollowups:followups,tuitionContactLogs:contacts};
 const doc=s=>({id:s.id,exists:true,data:()=>s});
 const db={collection(name){assert.ok(Object.hasOwn(lists,name));const filters=[];const q={where(k,op,v){assert.ok(['==','in'].includes(op));filters.push([k,v,op]);return q;},limit(n){assert.ok(n<=5001);return q;},async get(){reads.push(name);const rows=([...lists[name],...(['intranetStudentPeriods','intranetLegacyPeriods','intranetLessonDrafts'].includes(name)?Object.entries(documents).filter(([path])=>path.startsWith(name+'/')).map(([,value])=>value):[])]).filter(s=>filters.every(([k,v,op])=>op==='in'?v.includes(k.split('.').reduce((a,b)=>a?.[b],s)):k.split('.').reduce((a,b)=>a?.[b],s)===v));return{size:sizeOverride?.[name]??rows.length,docs:rows.map(doc)};}};return q;},doc(path){reads.push(path);return{async get(){const data=Object.hasOwn(documents,path)?documents[path]:path.startsWith('intranetStaffScopes/')?scope:path.startsWith('intranetFinancials/')?{studentId:financialStudent,periods}:path.startsWith('users/')?{role:'STAFF',status:'ACTIVE'}:{apps:{deskPortal:true}};return{exists:true,data:()=>data};}};}};
 return{db,reads};
}

export {fixture,payment};
