(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FeeFinancialSources=api;})(typeof globalThis==='object'?globalThis:this,function(){
 const month=v=>typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(v);
 const amount=v=>typeof v==='number'&&Number.isSafeInteger(v)&&Math.abs(v)<=1e10;
 function provenance(s){
  if(!s||!['desk','intranet'].includes(s.provider)||typeof s.id!=='string'||!s.id||s.id.length>200||typeof s.studentId!=='string'||!s.studentId||s.studentId.length>200||!month(s.month)||!month(s.targetMonth)||typeof s.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(s.fingerprint)||!amount(s.originalAmount))return null;
  return {provider:s.provider,id:s.id,studentId:s.studentId,month:s.month,targetMonth:s.targetMonth,fingerprint:s.fingerprint,originalAmount:s.originalAmount};
 }
 function review(data,context,existing=[]){
  if(!data||data.studentId!==context.studentId||data.month!==context.month||!Array.isArray(data.rows)||data.rows.length>5000)throw Error('조회한 학생·월이 일치하지 않습니다. 다시 조회해 주세요.');
  const seen=new Set();
  return data.rows.map(row=>{
   if(!row||typeof row.id!=='string'||!row.id||row.id.length>200||seen.has(row.id))throw Error('원본 기록을 확인하지 못했습니다. 다시 조회해 주세요.');seen.add(row.id);
   const source=provenance({provider:context.provider,id:row.id,studentId:context.studentId,month:context.month,targetMonth:context.targetMonth,fingerprint:row.fingerprint,originalAmount:row.amount});
   const prior=existing.find(item=>item.source?.provider===context.provider&&item.source.id===row.id&&item.source.studentId===context.studentId);
   const reason=String(row.blocked||'')||(!source?'금액·출처 확인 필요':row.amount===0?'반영할 금액 없음':!['carry','extra','other'].includes(row.kind)||row.kind==='carry'&&row.amount>0||row.kind==='extra'&&row.amount<0?'금액 부호 확인 필요':prior?(prior.source.fingerprint===row.fingerprint?'이미 반영한 항목':'이미 반영 · 원본 변경됨. 기존 항목을 삭제한 뒤 다시 검토하세요.'):'');
   return {id:row.id,label:String(row.label||'조정').slice(0,200),amount:row.amount,kind:row.kind,date:String(row.date||'').slice(0,20),method:String(row.method||'').slice(0,100),note:String(row.note||'').slice(0,400),source,reason};
  });
 }
 function selected(rows,ids){return rows.filter(r=>ids.includes(r.id)&&!r.reason).map(r=>({label:r.label,amount:r.amount,kind:r.kind,source:r.source}));}
 return {provenance,review,selected};
});
