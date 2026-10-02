// Previous-month review is an independent calculator draft; source systems are read-only.
(()=>{
 const el=id=>document.getElementById(id),esc=escapeHtml,C=FeeCalendarCore;
 const money=n=>n===null?'확인 필요':`${n>0?'+':n<0?'−':''}${Math.abs(n).toLocaleString('ko-KR')}원`;
 const tone=n=>n<0?'negative':n>0?'positive':'neutral';
 let ctx=null,key='',version='',generation=0,pending=false,message='';
 const contextKey=()=>`${staffAuthEpoch}|${ctx?.student?.id}|${ctx?.month}`;
 const validDraft=()=>{const d=ctx.options.priorNotice;return d&&d.studentId===ctx.student?.id&&d.targetMonth===ctx.month&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(d.month)&&d.month<ctx.month&&Array.isArray(d.lessons)&&Array.isArray(d.adjustments)?d:null;};
 function setup(){
  if(el('priorNoticeSection'))return;
  const section=document.createElement('section');section.id='priorNoticeSection';section.innerHTML=`<header class="prior-heading"><div><h2>이전 달 안내서</h2><p>실제 수업과 데스크 수납, 인트라넷 시작 잔액을 함께 확인합니다.</p></div><label>조회 월<input id="priorNoticeMonth" type="month" min="2000-01"></label><button type="button" id="loadPriorNotice">이전 달 안내서 불러오기</button></header><p id="priorNoticeStatus" role="status"></p><div class="prior-notice-layout"><article id="priorNoticePaper" class="prior-notice-paper" hidden></article><aside id="priorNoticeSettings" aria-label="이전 달 안내서 설정" hidden></aside></div>`;
  el('noticeColumn').append(section);el('loadPriorNotice').onclick=load;
  el('priorNoticeMonth').onchange=()=>{generation++;pending=false;message='월을 선택했습니다. 불러오기를 눌러 주세요.';status();};
  document.addEventListener('feecalc-auth-change',()=>{generation++;version='';render(ctx);});
 }
 function status(){el('priorNoticeStatus').textContent=message;el('loadPriorNotice').disabled=pending||!ctx.student||!isServerConfigured();}
 async function load(){
  if(pending||!ctx.student||!isServerConfigured())return;
  const month=el('priorNoticeMonth').value,studentId=ctx.student.id,identity=contextKey(),token=++generation;
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||month>=ctx.month){message='현재 계산 월보다 이전인 월을 선택하세요.';status();return;}
  pending=true;message='수업·수납·시작 잔액을 조회하고 있습니다.';status();
  try{
   const rpc=name=>getSupabaseClient().rpc(name,{p_student_id:studentId,p_month:month});
   const [snapshot,desk,opening]=await Promise.all([ctx.fetchSnapshot(month),rpc('feecalc_desk_payments'),rpc('feecalc_intranet_opening')]);
   if(token!==generation||identity!==contextKey()||!isServerConfigured())return;
   const adjustments=[];let sourceIssue='';
   for(const [provider,response] of [['desk',desk],['intranet',opening]]){
    if(response.error)throw Error(response.error.message);
    const data=response.data,rows=FeeFinancialSources.review(data,{provider,studentId,month,targetMonth:month});
    if(data.unresolved)sourceIssue='원본에 미확인 금액 또는 학생 연결 문제가 있습니다. 원본을 확인한 뒤 다시 불러오세요.';
    for(const r of rows){
     if(r.reason&&r.reason!=='반영할 금액 없음')sourceIssue=r.reason;
     adjustments.push({id:provider+':'+r.id,label:r.label,amount:r.reason&&r.reason!=='반영할 금액 없음'?null:r.amount,source:r.source,provider,included:true,date:r.date});
    }
    if(provider==='intranet'&&!rows.length)adjustments.push({id:'intranet:missing',label:'시작 잔액 확인 필요',amount:null,provider,included:true});
   }
   FeeCalendar.remember();ctx.options.priorNotice={studentId,targetMonth:ctx.month,month,fetchedAt:new Date().toISOString(),lessons:C.normalizeSnapshot(snapshot).map(r=>({...r,included:true})),adjustments,sourceIssue,modified:false};
   ctx.markTouched();message=`${month} 실제 수업 ${snapshot.lessons.length}건 · 원본 조회 완료. 아래 합계와 포함 항목을 검토하세요.`;version='';render(ctx);
  }catch(error){if(token===generation){message='조회하지 못했습니다. '+error.message;}}
  finally{if(token===generation){pending=false;status();}}
 }
 function total(d){const rows=[...d.lessons,...d.adjustments].filter(r=>r.included!==false);return d.sourceIssue||rows.some(r=>typeof r.amount!=='number'||!Number.isFinite(r.amount))?null:Math.round(rows.reduce((sum,r)=>sum+r.amount,0)*100)/100;}
 function paper(d){
  const host=el('priorNoticePaper'),lessons=d.lessons.filter(r=>r.included!==false),adjustments=d.adjustments.filter(r=>r.included!==false),sum=lessons.some(r=>r.amount===null)?null:lessons.reduce((s,r)=>s+r.amount,0);
  host.dataset.month=d.month;
  const events=day=>lessons.filter(r=>r.day===day).map(r=>`<div class="prior-event ${getSubjectColorClass(r.subject,false,false)} ${r.status==='결석예고'?'prior-absence':''} ${r.type==='1:1'?'prior-private':''}"><strong>${esc(r.subject)}</strong>${ctx.options.hideNoticeTimes?'':`<span>${esc(r.start&&r.end?r.start+'–'+r.end:(r.hours===null?'시간 확인 필요':r.hours+'시간'))}</span>`}<small>${r.type==='1:1'?'1:1 · ':''}<span class="notice-teacher-badge">${esc(r.teacher)}</span> ${esc(ctx.options.cancelAsAttendance?r.status.replace('당일취소','출석'):r.status)}</small></div>`).join('');
  host.innerHTML=`<img src="assets/brand/sedu-warm.svg" class="watermark-img" alt=""><header class="prior-document-header"><div><img src="assets/brand/sedu-warm.svg" alt="에스에듀 반포관 로고"><span>에스에듀 반포관</span></div><div class="receipt-student"><h2>${esc(ctx.student.name)}</h2>${ctx.schoolHtml(ctx.student)}<p>${Number(d.month.slice(0,4))}년 ${Number(d.month.slice(5))}월분</p></div></header><h2>수강료 정산 안내서</h2><p class="prior-context">실제 입력 기록 기준 · ${esc(d.fetchedAt.slice(0,10))} 조회${d.modified?' · 검토 수정본':''}</p><div class="prior-document-content"><section><table><thead><tr><th>과목·강사 / 수업 내역</th><th>금액</th></tr></thead><tbody>${lessons.map(r=>`<tr class="${r.status==='결석예고'?'prior-absence':''}"><td><strong>${esc(r.subject)}</strong> <span class="notice-teacher-badge">${esc(r.teacher)}</span><small>${r.day}일 · ${esc(r.type)} ${r.hours===null?'확인 필요':r.hours+'시간'} · ${esc(ctx.options.cancelAsAttendance?r.status.replace('당일취소','출석'):r.status)}</small></td><td class="${tone(r.amount)}">${money(r.amount)}</td></tr>`).join('')}</tbody></table><div class="prior-money-row"><span>실제 수업료</span><b class="${tone(sum)}">${money(sum)}</b></div>${adjustments.map(r=>`<div class="prior-money-row"><span>${esc(r.label)}</span><b class="${tone(r.amount)}">${money(r.amount)}</b></div>`).join('')}<div class="prior-money-row prior-total"><strong>이월·초과금</strong><b class="${tone(total(d))}">${money(total(d))}</b></div><p class="prior-context">이월금 − · 초과금 +<br>월마감 확정 여부와 별개인 입력 기록 기준 정산입니다.</p></section><section><h3>${Number(d.month.slice(5))}월 수업 일정</h3><div class="prior-weekdays">${['일','월','화','수','목','금','토'].map(x=>`<span>${x}</span>`).join('')}</div><div class="prior-calendar-grid">${'<div class="prior-day outside"></div>'.repeat(C.weekday(d.month,1))}${Array.from({length:C.daysInMonth(d.month)},(_,i)=>`<div class="prior-day"><b>${i+1}</b>${events(i+1)}</div>`).join('')}${'<div class="prior-day outside"></div>'.repeat((7-(C.weekday(d.month,1)+C.daysInMonth(d.month))%7)%7)}</div><p class="prior-context">회색·취소선: 결석예고 · 금색 테두리: 1:1 수업</p></section></div>`;
  const issue=el('priorSourceIssue');if(issue)issue.textContent=d.sourceIssue||'';
  document.querySelectorAll('[data-prior-export]').forEach(b=>b.disabled=total(d)===null);
 }
 function settings(d){
  const host=el('priorNoticeSettings');host.innerHTML='<h3>이전 달 안내서 설정</h3><p>체크한 항목만 합산합니다. 수정은 이 안내서 초안에만 저장되며, 인트라넷·데스크 원본과 현재 달 계산에는 반영되지 않습니다.</p><p id="priorSourceIssue" role="alert"></p><p id="priorExportStatus" role="status"></p><div class="prior-export"><button type="button" data-prior-export="save">이전 달 이미지 저장</button><button type="button" data-prior-export="copy">이전 달 이미지 복사</button></div><button type="button" id="resetPriorEdits">원본 다시 불러오기</button><div id="priorEditors"></div>';
  const editors=el('priorEditors');
  for(const [name,rows] of [['실제 수업',d.lessons],['잔액·수납',d.adjustments]]){
   const group=document.createElement('details');group.open=name==='잔액·수납';const summary=document.createElement('summary');summary.textContent=`${name} ${rows.length}건`;group.append(summary);
   rows.forEach((row,i)=>{
    const box=document.createElement('div');box.className='prior-edit-row';
    const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=row.included!==false;label.append(check,document.createTextNode(name==='실제 수업'?`${row.day}일 ${row.subject} · ${row.teacher}`:row.label));box.append(label);
    const change=()=>{d.modified=true;ctx.markTouched();paper(d);};check.onchange=()=>{row.included=check.checked;change();};
    const field=(title,value,write,type='text')=>{const l=document.createElement('label'),input=document.createElement('input');l.textContent=title;input.type=type;input.value=value??'';input.setAttribute('aria-label',`${name} ${i+1} ${title}`);if(type==='number'){input.step='0.01';input.min=title==='금액 (원)'&&name==='잔액·수납'?'-10000000000':'0';input.max='10000000000';}if(type==='date'){input.min=d.month+'-01';input.max=d.month+'-'+C.daysInMonth(d.month);}input.onchange=()=>{if((type==='date'||type==='time')&&(!input.value||!input.checkValidity())){input.reportValidity();input.value=type==='date'?row.date:(title==='시작 시간'?row.start:row.end);return;}if(type==='number'){if(input.value===''||!input.checkValidity()){input.setCustomValidity('올바른 숫자를 입력하세요.');input.reportValidity();write(null);change();return;}input.setCustomValidity('');}write(type==='number'?Number(input.value):input.value);change();};input.oninput=()=>input.setCustomValidity('');l.append(input);box.append(l);};
    field('금액 (원)',row.amount,v=>row.amount=v,'number');
    if(name==='실제 수업'){field('과목',row.subject,v=>row.subject=v);field('강사',row.teacher,v=>row.teacher=v);field('수업 시간',row.hours,v=>row.hours=v,'number');field('수업일',row.date,v=>{if(new RegExp('^'+d.month+'-\\d{2}$').test(v)&&Number(v.slice(-2))<=C.daysInMonth(d.month)){row.date=v;row.day=Number(v.slice(-2));}},'date');field('시작 시간',row.start,v=>row.start=v,'time');field('종료 시간',row.end,v=>row.end=v,'time');}
    else field('내용',row.label,v=>row.label=v);
    group.append(box);
   });editors.append(group);
  }
  el('resetPriorEdits').onclick=()=>{el('priorNoticeMonth').value=d.month;load();};
  host.querySelectorAll('[data-prior-export]').forEach(b=>b.onclick=async()=>{if(total(d)!==null){el('priorExportStatus').textContent='이미지를 만들고 있습니다.';await FeeCalendar.exportNotice(el('priorNoticePaper'),b.dataset.priorExport);if(el('priorExportStatus'))el('priorExportStatus').textContent=el('imageOutputStatus').textContent;}});
 }
 function render(next){
  if(!next)return;ctx=next;setup();const now=contextKey();
  if(now!==key){key=now;generation++;pending=false;version='';message='이전 달 자료를 불러오면 현재 안내서 아래에서 검토할 수 있습니다.';el('priorNoticeMonth').value=ctx.priorMonth;}
  const section=el('priorNoticeSection');section.hidden=!ctx.notice;el('priorNoticeMonth').max=ctx.priorMonth;status();
  const d=isServerConfigured()?validDraft():null;el('priorNoticePaper').hidden=!d;el('priorNoticeSettings').hidden=!d;
  if(!d){version='';return;}
  const updated=JSON.stringify(d);if(updated!==version){version=updated;el('priorNoticeMonth').value=d.month;settings(d);}paper(d);
 }
 window.FeePriorNotice={render};
})();
