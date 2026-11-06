(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FeeMonthlyHistoryCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
 const known=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e10;
 const money=v=>known(v)?Math.abs(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'원':'확인 필요';
 const signed=v=>known(v)?(v>0?'+':v<0?'−':'')+money(v):'확인 필요';
 const shift=(m,n)=>{const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);};
 const subject=l=>String(l.className||'수업').split(/[-·(]/)[0].trim()||'수업';
 const statuses={regular:'정규',absence:'결석예고 · 0원',cancel:'당일취소',makeup:'보강',supplement:'보충',study:'학습',late:'지각'};
 const status=l=>(statuses[l.kind]||l.kind||'수업')+(l.scheduled?' · 예정':'');
 function validate(data,id,month){
  if(data?.version!==1||data.studentId!==id||data.month!==month||!Array.isArray(data.months)||data.months.length!==3||!data.fingerprint||!data.asOf)throw Error('조회한 학생·월을 확인하지 못했습니다. 다시 조회해 주세요.');
  data.months.forEach((r,i)=>{
   if(r.month!==shift(month,i-2)||!Array.isArray(r.lessons)||r.lessons.length>1000||!Array.isArray(r.receipts)||!Array.isArray(r.blockers))throw Error('월별 내역 형식이 올바르지 않습니다.');
   for(const key of ['opening','charges','paid','closing','nextOpening','openingAdjustment'])if(r[key]!==null&&!known(r[key]))throw Error('정산 금액을 확인하지 못했습니다.');
   const ids=new Set();for(const l of r.lessons){if(!l.id||ids.has(l.id)||!/^\d{4}-\d{2}-\d{2}$/.test(l.date)||!l.date.startsWith(r.month+'-')||new Date(l.date+'T00:00:00Z').toISOString().slice(0,10)!==l.date||(l.amount!==null&&!known(l.amount)))throw Error('수업 날짜·금액·중복 여부를 확인해 주세요.');ids.add(l.id);}
   if(r.closing!==null&&(r.blockers.length||![r.opening,r.charges,r.paid].every(known)||Math.abs(r.opening+r.charges-r.paid-r.closing)>0.011))throw Error('정산 합계가 일치하지 않습니다.');
  });return data;
 }
 function groups(row){const map=new Map();for(const l of row.lessons){const name=subject(l);if(!map.has(name))map.set(name,{name,count:0,minutes:0,amount:0,pending:false,ids:[]});const g=map.get(name);g.count++;g.minutes+=l.minutes||0;g.pending||=!known(l.amount);g.amount+=l.amount||0;g.ids.push(l.id);}return [...map.values()];}
 const monthName=m=>Number(m.slice(5))+'월';
 const terms={credit:'이월금(−)은 미리 낸 금액이에요. 다음 달 수강료에서 빼요.',due:'초과금(+)은 납부액보다 더 발생한 수업료예요. 다음 달 수강료에 더해요.'};
 function narrative(row){
  if(row.blockers.length||row.closing===null)return {title:'내역을 확인하고 있어요',text:row.blockers.join(' ')||'이전 달 정산 근거를 확인해야 합니다.',tone:'pending'};
  if(!row.lessons.length&&!row.receipts.length&&row.openingSource!=='saved'&&row.paidSource!=='saved'&&!row.opening)return {title:'등록된 수업·납부 내역이 없어요',text:'조회 월을 바꾸거나 원본 기록을 확인해 주세요.',tone:'empty'};
  const previous=monthName(shift(row.month,-1)),current=monthName(row.month),next=monthName(shift(row.month,1));
  const n=row.closing;
  const adjusted=row.nextOpeningSource==='saved'&&row.openingAdjustment!==0;
  const title=adjusted?`${current} 정산 잔액은 ${signed(n)}이며 ${next} 시작 금액은 별도로 조정됐어요`:
   n===0?`${current} 정산 후 남은 금액은 0원이에요`:
   `${n<0?'이월금':'초과금'} · ${next} 수강료${n<0?'에서':'에'} ${money(n)} ${n<0?'차감':'추가'}${row.provisional?' 예상':''}`;
  const opening=row.openingSource==='saved'?`${current} 시작 잔액은 ${signed(row.opening)}으로 입력돼 있어요.`:
   row.opening===0?`${previous}에서 ${current}로 넘어온 잔액은 0원이에요.`:
   `${previous} ${row.opening<0?'이월금':'초과금'} ${money(row.opening)}을 ${current} 수강료${row.opening<0?'에서 뺐어요':'에 더했어요'}.`;
  const paid=row.paid<0?`납부보다 환불이 ${money(row.paid)} 많았어요.`:`환불을 뺀 납부액은 ${money(row.paid)}이에요.`;
  return {title,text:`${opening} ${current} 수업료는 ${money(row.charges)}이고, ${paid}`,tone:n>0?'positive':n<0?'negative':'balanced'};
 }
 function carryExplanation(first,second){
  const from=monthName(first.month),to=monthName(second.month);
  const saved=second.openingSource==='saved';
  const difference=second.opening-first.closing;
  return saved?
   `${to}에는 별도로 입력한 시작 잔액 ${signed(second.opening)}을 적용했어요. ${from} 말 잔액과의 차이는 ${signed(difference)}이에요.`:
   difference!==0?`${from} 말 잔액과 ${to} 시작 잔액이 ${money(difference)} 달라요. 정산 기록을 확인해 주세요.`:
   first.closing===0?`${from} 말 잔액이 0원이어서 ${to}은 0원으로 시작했어요.`:
   `${from} 말 ${first.closing<0?'이월금':'초과금'} ${money(first.closing)}이 ${to} 시작 잔액으로 넘어와 ${to} 수강료${first.closing<0?'에서 차감':'에 추가'}됐어요.`;
 }
 function comparisonMessage(data,pair){
  const [first,second]=pair;
  const summaries=pair.map(r=>[
   r.month+' 정산'+(r.provisional?' (잠정)':''),
   '시작 잔액 '+signed(r.opening),'수업료 '+signed(r.charges),
   '납부·환불 반영 '+signed(-r.paid),'월말 잔액 '+signed(r.closing)
  ].join('\n'));
  const next=monthName(shift(second.month,1));
  const onward=second.nextOpeningSource==='saved'
   ? `${next}에는 별도로 입력한 시작 잔액 ${signed(second.nextOpening)}이 적용돼요.`
   : narrative(second).title;
  return [data.studentName+' 학생 · '+first.month+' ~ '+second.month+' 수강료 정산 안내',
   ...summaries,carryExplanation(first,second)+'\n'+onward,terms.credit+'\n'+terms.due,
   '조회 기준 '+new Date(data.asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})
  ].join('\n\n');
 }
 function message(data,row){const n=narrative(row);return `${data.studentName} 학생 · ${row.month} 수업·정산 안내\n${n.title}\n${n.text}\n\n${terms.credit}\n${terms.due}\n\n${groups(row).map(g=>`${g.name} ${g.count}건: ${g.pending?'확인 필요':money(g.amount)}`).join('\n')}\n\n전월 잔액 ${signed(row.opening)} + 수업료 ${money(row.charges)} − 순수납액 ${row.paid<0?'−':''}${money(row.paid)} = 잔액 ${signed(row.closing)}${row.openingSource==='saved'?'\n전월 잔액은 저장된 시작 잔액을 사용했습니다.':''}${row.paidSource==='saved'?'\n순수납액은 인트라넷에서 저장한 조정 금액을 사용했습니다.':''}${row.nextOpeningSource==='saved'?`\n다음 달에는 별도로 저장된 시작 잔액 ${signed(row.nextOpening)}이 적용됩니다. 위 정산 잔액과의 차이 ${signed(row.openingAdjustment)}는 별도 확인 대상입니다.`:''}\n${row.provisional?'진행 중인 달의 잠정 안내입니다. 이후 수업·수납에 따라 달라질 수 있습니다.':'현재 저장된 기록 기준이며 과거 안내서와 다를 수 있습니다.'}\n조회 기준: ${new Date(data.asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`;}
 return {carryExplanation,comparisonMessage,monthName,terms,known,money,signed,shift,subject,status,validate,groups,narrative,message};
});
