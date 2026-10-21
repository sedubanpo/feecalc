import {createHash} from 'node:crypto';
import {readFeeCalcProgress} from './feecalcProgress.js';
import {readFeeCalcPayments} from './feecalcFinancialSources.js';
import {readMonthlyDesk} from './feecalcDesk.js';
import {readBalanceHistory,historyMonths} from './balanceHistory.js';
import {balanceHistoryStart,resolveBalanceOpening} from './balanceAnchor.js';
import {projectCalculatorBalanceMonth} from './feecalcBalancePolicy.js';
import {billingModelVersion} from './feecalcBilling.generated.js';
export const shiftMonth=(m,n)=>{const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);};
const known=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e10;
const round=n=>Math.round(n*100)/100;
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
// Request-local promise reuse only. No persistent cache, permission bypass, or writes.
export function memoReader(db){
 const cache=new Map();const once=(key,read)=>{if(!cache.has(key))cache.set(key,Promise.resolve().then(read));return cache.get(key);};
 function query(ref,key){return {where:(...a)=>query(ref.where(...a),key+JSON.stringify(['where',...a])),limit:n=>query(ref.limit(n),key+JSON.stringify(['limit',n])),get:()=>once(key,()=>ref.get())};}
 return {doc:path=>({get:()=>once('doc:'+path,()=>db.doc(path).get())}),collection:path=>query(db.collection(path),'collection:'+path)};
}
export async function readFeeCalcMonthlyHistory(rawDb,uid,studentId,month){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||!studentId||studentId.includes('/'))fail(400,'학생과 조회 월을 확인해 주세요.');
 const db=memoReader(rawDb);
 const scope=(await db.doc(`intranetStaffScopes/${uid}`).get()).data();
 if(!scope?.enabled||scope.campusId!=='banpo'||!scope.readPayments)throw Object.assign(Error('반포관 인트라넷 수납 조회 권한이 필요합니다.'),{status:403,code:'FINANCIAL_SCOPE_REQUIRED'});
 const roster=await db.collection('students').limit(5001).get();
 if(roster.size>5000)fail(413,'학생 명부 조회 한도를 초과했습니다.');
 const students=roster.docs.map(d=>{const s=d.data();return {id:d.id,name:s.name||s.studentName||'',isAlias:!!(s.mergedInto||s.isAlias||s.status==='MERGED')};});
 const student=students.find(s=>s.id===studentId&&!s.isAlias&&s.name);
 if(!student)fail(400,'등록 학생을 다시 선택해 주세요.');
 const financial=(await db.doc(`intranetFinancials/${studentId}`).get()).data()||{};
 if(financial.studentId&&financial.studentId!==studentId)fail(409,'잔액 기록의 학생 정보가 일치하지 않습니다.');
 const periods=financial.periods||{},visible=[shiftMonth(month,-2),shiftMonth(month,-1),month];
 const start=[...visible.map(m=>balanceHistoryStart(m,periods)),...visible].sort()[0],end=shiftMonth(month,1);
 if(historyMonths(start,end).length>24)fail(413,'정산 연결 기간이 24개월을 넘습니다. 인트라넷에서 시작 잔액을 확인해 주세요.');
 for(const [m,p] of Object.entries(periods))if(m>=start&&m<=end)for(const field of ['opening','paid'])if(p?.[field]?.amount!=null&&!known(p[field].amount))fail(409,'저장된 잔액·수납 금액을 확인해 주세요.');
 const history=await readBalanceHistory({db,student:{...student,originMonth:start,opening:0},start,end,deskRecords:m=>readMonthlyDesk(db,m,students),persistSnapshots:false,projectMonth:projectCalculatorBalanceMonth,modelVersion:billingModelVersion});
 const loaded=history.months.map(s=>s.month),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
 const months=[];
 for(const m of visible){
  const [progress,receipts]=await Promise.all([readFeeCalcProgress(db,uid,studentId,m),readFeeCalcPayments(db,studentId,m)]);
  const summary=history.months.find(s=>s.month===m),p=periods[m]||{};
  const opening=m<balanceHistoryStart(m,periods)?null:resolveBalanceOpening(m,periods,loaded,history.months);
  const paid=p.paid?.amount??summary?.paid,charges=summary?.charges;
  const lessons=progress.lessons.map(l=>({...l,scheduled:l.date>today}));
  const future=lessons.some(l=>l.scheduled),pending=lessons.filter(l=>!known(l.amount)).length;
  const lessonSum=round(lessons.reduce((s,l)=>s+(known(l.amount)?l.amount:0),0));
  const mismatch=known(charges)&&!pending&&Math.abs(lessonSum-charges)>0.01;
  const blockers=[];
  if(opening===null)blockers.push('전월 잔액의 연결 근거를 확인해야 합니다.');
  if((summary?.unresolved||0)||pending)blockers.push('일부 수업의 단가·청구 기준을 확인해야 합니다.');
  if(receipts.unresolved||receipts.rows.some(r=>r.blocked))blockers.push('일부 납부·환불 내역의 연결을 확인해야 합니다.');
  if(!known(paid)||!known(charges)||mismatch)blockers.push('수업 상세와 정산 합계를 확인해야 합니다.');
  const closing=blockers.length?null:round(opening+charges-paid);
  const nextSaved=periods[shiftMonth(m,1)]?.opening?.amount;
  months.push({month:m,opening,openingSource:p.opening?.amount!=null?'saved':'automatic',charges:known(charges)?charges:null,paid:known(paid)?paid:null,paidSource:p.paid?.amount!=null?'saved':'receipts',closing,nextOpening:nextSaved??closing,nextOpeningSource:nextSaved!=null?'saved':'automatic',openingAdjustment:nextSaved!=null&&closing!==null?round(nextSaved-closing):null,blockers,provisional:m>=today.slice(0,7)||future,lessons,receipts:receipts.rows.map(({id,amount,date,label,blocked})=>({id,amount,date,label,blocked})),sourceFingerprint:summary?.sourceFingerprint||''});
 }
 const result={version:1,studentId,studentName:student.name,month,asOf:new Date().toISOString(),basis:'현재 저장된 수업·수납 기준',months};
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(months)).digest('hex')};
}
