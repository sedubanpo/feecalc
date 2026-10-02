(()=>{
 const C=FeeFinancialSources,el=id=>document.getElementById(id);
 const month=()=>`${el('targetYear').value}-${String(el('targetMonth').value).padStart(2,'0')}`;
 const context=()=>`${staffAuthEpoch}|${matchedStudent()?.id}|${month()}|${currentTab}`;
 const money=n=>`${n>0?'+':n<0?'−':''}${Math.abs(n).toLocaleString('ko-KR')}원`;
 const buttons=document.createElement('div');buttons.className='financial-import-actions';
 const heading=el('adjustmentArea').firstElementChild,add=heading.querySelector('button');heading.classList.add('financial-area-heading');buttons.append(add);
 for(const [provider,label] of [['desk','데스크 수납 가져오기'],['intranet','인트라넷 잔액 가져오기']]){const b=document.createElement('button');b.type='button';b.className='ui-button';b.textContent=label;b.onclick=()=>open(provider,b);buttons.append(b);}heading.append(buttons);
 let active=null;
 document.addEventListener('feecalc-auth-change',()=>active?.close());
 for(const type of ['input','change'])document.addEventListener(type,e=>{if(['studentName','targetYear','targetMonth'].includes(e.target.id))active?.close();});
 function open(provider,trigger){
  active?.close();const student=matchedStudent(),targetMonth=month(),key=context();
  const dialog=document.createElement('dialog');dialog.className='draft-dialog financial-dialog';dialog.id='financialSourceDialog';dialog.setAttribute('aria-labelledby','financialSourceTitle');
  dialog.innerHTML=`<div class="temporary-heading"><div><h2 id="financialSourceTitle">${provider==='desk'?'기수납액 검토':'이월·초과금 검토'}</h2><p></p></div><button type="button" class="ui-button" aria-label="닫기">×</button></div><p class="financial-help">${provider==='desk'?'납부액·환불액·수납 정정 내역을 확인하고 가져올 항목을 선택하세요. 납부액은 차감하고 환불액은 추가합니다.':'선택한 월의 전월 잔액을 조회합니다. 직접 입력한 잔액을 우선 사용하고, 없으면 이전 달 청구액과 순수납액에서 자동 이월합니다.'}</p><div class="financial-query"><label>${provider==='desk'?'수강료 귀속월':'잔액을 반영할 월'}<input type="month" id="financialSourceMonth" min="2000-01" max="2099-12"></label><button type="button" class="ui-button" id="financialSourceReload">조회</button></div><p id="financialSourceStatus" role="status"></p><div id="financialSourceRows" class="financial-source-rows"></div><div class="financial-preview" id="financialSourcePreview" aria-live="polite"></div><p class="draft-error" role="alert" hidden></p><div class="temporary-footer"><button type="button" class="ui-button" id="financialSourceCancel">취소</button><button type="button" class="ui-button primary" id="financialSourceApply" disabled>선택 항목 반영</button></div>`;
  document.body.append(dialog);active=dialog;dialog.querySelector('.temporary-heading p').textContent=`${student?.name||'학생 미선택'} · ${targetMonth} 계산에 반영`;el('financialSourceMonth').value=targetMonth;
  let generation=0,rows=[],pending=false,queryMonth='',ids=new Set();
  const valid=()=>dialog.open&&key===context()&&!!matchedStudent()&&isServerConfigured();
  const error=message=>{const e=dialog.querySelector('.draft-error');e.hidden=!message;e.textContent=message||'';};
  const rpc=provider==='desk'?'feecalc_desk_payments':'feecalc_intranet_opening';
  const request=m=>getSupabaseClient().rpc(rpc,{p_student_id:student.id,p_month:m});
  const options=m=>({provider,studentId:student.id,month:m,targetMonth});
  function preview(){
   const selected=C.selected(rows,[...ids]),delta=selected.reduce((sum,r)=>sum+r.amount,0),existing=getAdjustmentTotal();
   el('financialSourcePreview').replaceChildren();
   for(const [label,value] of [['현재 조정 합계',existing],[`선택 ${selected.length}건`,delta],['반영 후 조정 합계',existing+delta]]){const div=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=money(value);strong.className=value<0?'financial-negative':value>0?'financial-positive':'';div.append(span,strong);el('financialSourcePreview').append(div);}
   el('financialSourceApply').disabled=pending||!selected.length||!valid()||el('financialSourceMonth').value!==queryMonth;
  }
  function render(){
   const list=el('financialSourceRows');list.replaceChildren();
   for(const row of rows){const label=document.createElement('label');label.className='financial-source-row';const input=document.createElement('input');input.type='checkbox';input.disabled=!!row.reason;input.setAttribute('aria-label',`${row.label} ${money(row.amount||0)} 선택`);input.onchange=()=>{input.checked?ids.add(row.id):ids.delete(row.id);preview();};
    const details=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('span'),note=document.createElement('small'),value=document.createElement('strong');title.textContent=row.label;meta.textContent=[row.date,row.method].filter(Boolean).join(' · ');note.textContent=row.reason||row.note;value.textContent=typeof row.amount==='number'?money(row.amount):'금액 미확인';value.className=row.amount<0?'financial-negative':row.amount>0?'financial-positive':'';details.append(title,meta,note);label.append(input,details,value);list.append(label);
   }preview();
  }
  async function load(){
   if(!valid()){error('직원 로그인 후 등록 학생을 선택해 주세요.');return;}
   const m=el('financialSourceMonth').value;if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)){error('조회할 월을 선택해 주세요.');return;}
   const token=++generation;pending=true;rows=[];ids.clear();queryMonth='';error('');render();el('financialSourceStatus').textContent='원본 기록을 조회하고 있습니다.';
   try{const {data,error:e}=await request(m);if(token!==generation||!valid())return;if(e)throw Error(e.message);rows=C.review(data,options(m),collectAdjustmentItems(true));queryMonth=m;el('financialSourceStatus').textContent=rows.length?`${rows.length}건 조회 · 가져올 항목을 선택하세요.${data.unresolved?provider==='desk'?' 학생 연결을 확인해야 하는 기록 '+data.unresolved+'건은 제외했습니다.':' 이전 달 수업 '+data.unresolved+'건의 청구 기준을 확인해야 합니다.':''}`:`${m}에 ${provider==='desk'?'조회 가능한 수납 기록':'가져올 전월 잔액'}이 없습니다.${data.unresolved?' 학생 연결 확인이 필요한 기록이 있습니다.':''}`;
   }catch(e){if(token===generation&&dialog.open){el('financialSourceStatus').textContent='조회하지 못했습니다. 현재 계산은 유지됩니다.';error(e.message);}}
   finally{if(token===generation&&dialog.open){pending=false;render();}}
  }
  el('financialSourceReload').onclick=load;el('financialSourceMonth').onchange=()=>{generation++;pending=false;rows=[];ids.clear();queryMonth='';el('financialSourceStatus').textContent='월을 변경했습니다. 조회 버튼을 눌러 주세요.';render();};
  el('financialSourceApply').onclick=async()=>{
   if(!valid()){error('학생·월 또는 로그인 상태가 바뀌었습니다. 닫고 다시 조회해 주세요.');return;}
   const selected=C.selected(rows,[...ids]),m=queryMonth;if(!selected.length||pending||el('financialSourceMonth').value!==m)return;
   pending=true;const token=++generation;preview();error('');
   try{
    const {data,error:e}=await request(m);if(token!==generation||!valid())throw Error('학생·월 또는 로그인 상태가 바뀌어 반영을 취소했습니다.');if(e)throw Error(e.message);
    const latest=C.review(data,options(m),collectAdjustmentItems(true));
    if(selected.some(s=>!latest.some(r=>r.id===s.source.id&&!r.reason&&r.source.fingerprint===s.source.fingerprint&&r.amount===s.amount)))throw Error('선택한 원본 기록이 변경되었거나 이미 반영되었습니다. 다시 조회하고 검토해 주세요.');
    FeeCalendar.remember();selected.forEach(item=>addAdjustmentItem(item.label,item.amount,{kind:item.kind,source:item.source,silent:true}));syncLegacyAdjustmentInput();FeeCalendar.commit();dialog.close();
   }catch(e){if(dialog.open)error(e.message);}finally{if(dialog.open){pending=false;preview();}}
  };
  dialog.querySelector('[aria-label="닫기"]').onclick=()=>dialog.close();el('financialSourceCancel').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{generation++;dialog.remove();if(active===dialog)active=null;trigger.focus();},{once:true});dialog.showModal();
  if(student&&isServerConfigured())load();else error('직원 로그인 후 등록 학생을 선택해 주세요.');
 }
})();
