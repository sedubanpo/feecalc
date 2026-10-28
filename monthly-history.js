(function install(){
 if(!document.getElementById('productHeader')){const observer=new MutationObserver(()=>{if(document.getElementById('productHeader')){observer.disconnect();install();}});observer.observe(document.body,{childList:true});return;}
 const C=FeeMonthlyHistoryCore,$=id=>document.getElementById(id),esc=escapeHtml;
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 3v4m14-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2m2 10 3 3 6-6"/></svg>';
 const host=document.createElement('section');host.id='monthlyHistory';host.hidden=true;host.setAttribute('aria-label','월별 수강료 히스토리');$('productHeader').after(host);
 host.innerHTML=`<div class="mh-toolbar"><div><h1>월별 수강료 히스토리</h1><p>수업 달력을 보며, 다음 달로 이어지는 금액을 함께 확인해요.</p></div><div class="mh-actions"><button type="button" id="mhParent">학부모용 보기</button><button type="button" id="mhImage">이미지 저장</button><button type="button" id="mhPdf">PDF 저장</button><button type="button" id="mhCopy">설명 복사</button><label class="mh-detail-toggle"><input type="checkbox" id="mhIncludeDetails"> 상세 근거 포함</label></div></div><div class="mh-query"><label>학생 찾기<input id="mhSearch" type="search" placeholder="학생 이름 검색" autocomplete="off"></label><label>학생 선택<select id="mhStudent"><option value="">학교·학년을 확인해 선택하세요</option></select></label><div class="mh-month-nav"><button type="button" id="mhPrev" aria-label="이전 달">이전</button><label>최근 3개월 · 마지막 달<input type="month" id="mhMonth" min="2000-03" max="2099-12"></label><button type="button" id="mhNext" aria-label="다음 달">다음</button></div><button type="button" id="mhReload">새로고침</button></div><p id="mhStatus" role="status" aria-live="polite"></p><div id="mhBody"></div><section id="mhPreview" hidden aria-label="학부모 안내 미리보기"><div class="mh-preview-heading"><h2>학부모용 안내 미리보기</h2><button type="button" id="mhClosePreview">닫기</button></div><p>아래 문서만 출력됩니다. 실제 학생·월과 금액을 확인해 주세요.</p><div id="mhPages"></div></section>`;
 let active=false,data=null,selectedMonth='',selectedGroup='',selectedDay='',epoch=0,busy=false,outputBusy=false,identity='',registrySignature='',renderKey='';
 const cache=new Map(),pending=new Map();
 const context=()=>`${staffAuthEpoch}|${$('mhStudent').value}|${$('mhMonth').value}`;
 const row=()=>data?.months.find(r=>r.month===selectedMonth);
 const buttons=()=>['mhParent','mhImage','mhPdf','mhCopy'].map($);
 function sync(){if(!active)return;document.body.classList.add('monthly-history-active');document.querySelectorAll('#productHeader [data-purpose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.purpose==='monthly-history')));const sig=registryState+'|'+studentRegistry.map(s=>s.id).join('|');if(sig!==registrySignature){registrySignature=sig;options();}}
 function options(){const previous=$('mhStudent').value,q=$('mhSearch').value.trim();$('mhStudent').replaceChildren(new Option(registryState==='loading'?'학생 명부 확인 중':registryState==='error'?'명부 조회 실패 · 다시 열어 주세요':'학교·학년을 확인해 선택하세요',''));for(const s of studentRegistry.filter(s=>!q||s.name.includes(q)))$('mhStudent').add(new Option(`${s.name} · ${s.school||'학교 미등록'} ${s.grade||''}`,s.id));if([...$('mhStudent').options].some(o=>o.value===previous))$('mhStudent').value=previous;else if(previous)invalidate();}
 function invalidate(){epoch++;busy=false;$('mhReload').disabled=false;host.removeAttribute('aria-busy');data=null;selectedGroup='';selectedDay='';$('mhBody').replaceChildren();$('mhPreview').hidden=true;$('mhPages').replaceChildren();buttons().forEach(b=>b.disabled=true);}
 async function open(){active=true;host.hidden=false;sync();if(!identity){const s=matchedStudent();if(s){$('mhStudent').value=s.id;$('mhSearch').value='';} $('mhMonth').value=`${$('targetYear').value}-${String($('targetMonth').value).padStart(2,'0')}`;identity='initialized';}await load();}
 function close(){active=false;host.hidden=true;epoch++;document.body.classList.remove('monthly-history-active');$('mhPreview').hidden=true;}
 async function load(force=false){
  const id=$('mhStudent').value,m=$('mhMonth').value,key=context();invalidate();const token=epoch;
  if(!isServerConfigured()||!id){$('mhStatus').textContent='직원 로그인 후 학생을 선택하면 최근 3개월의 수업과 정산 흐름을 볼 수 있습니다.';return;}
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)||m<'2000-03'){ $('mhStatus').textContent='조회할 월을 선택해 주세요.';return;}
  busy=true;$('mhReload').disabled=true;$('mhStatus').textContent='수업과 납부 내역을 연결하고 있어요…';host.setAttribute('aria-busy','true');
  try{
   const cached=cache.get(key);let result;
   if(!force&&cached&&Date.now()-cached.at<60000)result=cached.data;
   else{if(!pending.has(key))pending.set(key,getSupabaseClient().rpc('feecalc_monthly_history',{p_student_id:id,p_month:m}).finally(()=>pending.delete(key)));const response=await pending.get(key);if(response.error)throw Error(response.error.message);result=C.validate(response.data,id,m);if(token===epoch&&key===context()){cache.set(key,{at:Date.now(),data:result});while(cache.size>8)cache.delete(cache.keys().next().value);}}
   if(token!==epoch||key!==context()||!active)return;
   data=result;selectedMonth=m;renderKey=key;render();
  }catch(e){if(token===epoch){$('mhStatus').textContent=(e.message||'조회하지 못했습니다.')+' 새로고침으로 다시 시도해 주세요.';}}
  finally{if(token===epoch){busy=false;$('mhReload').disabled=false;host.removeAttribute('aria-busy');}}
 }
 function amount(v){return `<span class="mh-${v>0?'positive':v<0?'negative':'neutral'}">${esc(C.signed(v))}</span>`;}
 function equation(r){return `<dl class="mh-equation"><div><dt>전월에서 넘어온 금액</dt><dd>${amount(r.opening)}</dd></div><div><dt>이번 달 수업료</dt><dd>${amount(r.charges)}</dd></div><div><dt>납부·환불 반영${r.paidSource==='saved'?' · 저장된 조정액':''}</dt><dd>${amount(r.paid===null?null:-r.paid)}</dd></div><div class="mh-result"><dt>이번 달 정산 잔액</dt><dd>${amount(r.closing)}</dd></div></dl><p class="mh-formula">전월 잔액 + 수업료 − (납부 − 환불) = 정산 잔액</p>`;}
 function notes(r){return `${r.openingSource==='saved'?'<p>전월 금액은 인트라넷에 저장된 시작 잔액입니다. 이 화면만으로 이전 발생 사유를 확정하지 않습니다.</p>':''}${r.paidSource==='saved'?'<p>순수납액은 저장된 조정 금액입니다. 아래 개별 납부 내역의 합계와 다를 수 있습니다.</p>':''}${r.nextOpeningSource==='saved'?`<p>다음 달에는 별도로 저장된 시작 잔액 <strong>${C.signed(r.nextOpening)}</strong>이 적용됩니다. 위 잔액과의 차이 <strong>${C.signed(r.openingAdjustment)}</strong>는 별도 조정입니다.</p>`:''}<p>${r.provisional?'진행 중인 달의 잠정 안내예요. 이후 수업·수납에 따라 금액이 달라질 수 있습니다.':'현재 저장된 수업·수납 기준입니다. 과거에 전달한 안내서와 다를 수 있습니다.'}</p>`;}
 function calendar(r,compact=false){
  const count=new Date(Number(r.month.slice(0,4)),Number(r.month.slice(5)),0).getDate(),offset=new Date(r.month+'-01T00:00:00').getDay();
  let html='<div class="mh-weekdays" aria-hidden="true">'+['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')+'</div><div class="mh-calendar">'+'<div class="mh-outside"></div>'.repeat(offset);
  for(let day=1;day<=count;day++){const date=r.month+'-'+String(day).padStart(2,'0'),lessons=r.lessons.filter(l=>l.date===date);html+=`<div class="mh-day${selectedDay===date?' mh-day-selected':''}"><span class="mh-date">${day}</span>${compact?lessons.map(l=>`<div class="mh-event mh-subject-${color(C.subject(l))}"><strong>${esc(C.subject(l))}</strong><span>${l.minutes===null?'시간 확인':l.minutes+'분'} · ${esc(C.status(l))}</span></div>`).join(''):lessons.map(l=>`<button type="button" class="mh-event mh-subject-${color(C.subject(l))}${selectedGroup&&C.subject(l)!==selectedGroup?' mh-dim':''}" data-lesson="${esc(l.id)}" aria-label="${esc(day+'일 '+C.subject(l)+' '+C.status(l)+' '+C.money(l.amount))}"><strong>${esc(C.subject(l))}</strong><span>${l.minutes===null?'시간 확인':l.minutes+'분'} · ${esc(C.status(l))}</span></button>`).join('')}</div>`;}
  return html+'<div class="mh-outside"></div>'.repeat((7-(offset+count)%7)%7)+'</div>';
 }
 const color=s=>/수학/.test(s)?'math':/국어/.test(s)?'korean':/영어/.test(s)?'english':/과학|물리|화학|생명/.test(s)?'science':'other';
 function render(){
  const r=row(),n=C.narrative(r),groups=C.groups(r);$('mhStatus').textContent=`${data.studentName} · ${r.month} · 조회 기준 ${new Date(data.asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`;
  const empty=n.tone==='empty';buttons().forEach(b=>b.disabled=!!r.blockers.length||r.closing===null||empty||outputBusy);
  $('mhBody').innerHTML=`<nav class="mh-flow" aria-label="월별 정산 흐름">${data.months.map(m=>`<button type="button" data-month="${m.month}" aria-pressed="${m.month===r.month}"><span>${Number(m.month.slice(5))}월${m.month===r.month?' · 선택':''}${m.provisional?' · 잠정':''}</span><strong>${m.closing===null?'확인 필요':C.signed(m.closing)}</strong><small>${m.closing===null?'근거 확인':m.nextOpeningSource==='saved'&&m.openingAdjustment!==0?'다음 달 별도 조정':m.closing>0?'다음 달 추가':m.closing<0?'다음 달 차감':'정산 차액 없음'}</small></button>`).join('')}</nav><p class="mh-selected-context"><strong>지금 보는 내역 · ${r.month.slice(0,4)}년 ${Number(r.month.slice(5))}월</strong><span>화면·학부모 안내·저장 파일에 같은 달이 표시됩니다.</span></p><div class="mh-layout"><section class="mh-calendar-section"><div class="mh-calendar-title"><h2>${Number(r.month.slice(5))}월 수업 달력</h2><span>${r.lessons.length}건 · 예정 포함</span></div>${empty?'<p class="mh-empty">등록된 수업·납부 내역이 없습니다. 조회 월과 원본 기록을 확인해 주세요.</p>':''}${calendar(r)}<div id="mhLessonDetail" class="mh-lesson-detail" aria-live="polite">수업을 누르면 시간과 금액을 볼 수 있어요.</div></section><aside class="mh-story" aria-label="정산 이유"><div class="mh-story-title">${icon}<h2>${esc(n.title)}</h2></div><p>${esc(n.text)}</p>${equation(r)}<h3>수업료는 이렇게 구성돼요</h3><p class="mh-hint">과목을 누르면 해당 수업이 달력에 표시돼요.</p><div class="mh-subjects">${groups.map(g=>`<button type="button" data-subject="${esc(g.name)}" aria-pressed="${selectedGroup===g.name}"><span><strong>${esc(g.name)}</strong><small>${g.count}건 · ${g.minutes}분</small></span><b>${g.pending?'확인 필요':C.money(g.amount)}</b></button>`).join('')||'<p>등록된 수업이 없습니다.</p>'}</div><div class="mh-notes">${notes(r)}</div></aside></div><details class="mh-ledger"><summary>납부·환불과 정산 근거 보기</summary><h3>납부·환불 내역</h3>${receiptsTable(r)}<p>수업료에 이미 반영된 할인은 다시 차감하지 않습니다. 이전 안내본과 연결되지 않은 차액의 발생 이유는 추측하지 않습니다.</p></details>`;
  host.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{selectedMonth=b.dataset.month;selectedGroup='';selectedDay='';$('mhPreview').hidden=true;render();});
  host.querySelectorAll('[data-subject]').forEach(b=>b.onclick=()=>{selectedGroup=selectedGroup===b.dataset.subject?'':b.dataset.subject;render();});
  host.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{const l=r.lessons.find(l=>l.id===b.dataset.lesson);selectedDay=l.date;$('mhLessonDetail').innerHTML=`<strong>${esc(l.date+' · '+l.className)}</strong><span>${esc(l.teacher||'강사 미기재')} · ${esc(l.start||'시각 미기재')}${l.end?'–'+esc(l.end):''} · ${esc(C.status(l))}</span><b>${C.money(l.amount)}</b>${l.discountParts?.length?'<span>할인이 반영된 수업료입니다.</span>':''}`;});
 }
 function receiptsTable(r){return `<table class="mh-table"><thead><tr><th>납부일</th><th>내용</th><th>정산 반영</th></tr></thead><tbody>${r.receipts.map(p=>`<tr><td>${esc(p.date||'날짜 확인')}</td><td>${esc(p.label)}${p.blocked?' · 확인 필요':''}</td><td>${amount(p.amount)}</td></tr>`).join('')||'<tr><td colspan="3">연결된 납부·환불 내역이 없습니다.</td></tr>'}</tbody></table><p class="mh-hint">납부는 잔액에서 차감(−), 환불은 더하기(+)로 표시합니다.</p>`;}
 function printHeader(r,subtitle){return `<header class="mh-paper-header"><img src="assets/brand/sedu-warm.svg" alt="에스에듀"><div><span>에스에듀 반포관</span><h2>${esc(data.studentName)} · ${r.month}</h2><p>${subtitle}${r.provisional?' · 잠정 안내':''}</p></div></header>`;}
 function pages(){const r=row(),n=C.narrative(r),footer=`<footer>현재 저장된 기록 기준 · ${esc(new Date(data.asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}</footer>`;
  // Dense calendars are split at week boundaries, never shrink the text to fit.
  const cal=document.createElement('div');cal.innerHTML=calendar(r,true);const cells=[...cal.querySelector('.mh-calendar').children],weeks=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7));
  const chunks=[];let chunk=[],weight=0;for(const week of weeks){const total=Math.max(1,...week.map(c=>c.querySelectorAll('.mh-event').length));
   // Continue a dense week without dropping any lesson or reducing the font size.
   for(let start=0;start<total;start+=4){const slice=week.map(cell=>{const copy=cell.cloneNode(true);[...copy.querySelectorAll('.mh-event')].forEach((event,i)=>{if(i<start||i>=start+4)event.remove();});if(start&&copy.querySelector('.mh-date'))copy.querySelector('.mh-date').textContent+=' · 계속';return copy;});const w=Math.min(4,total-start);if(chunk.length&&(weight+w>8||start)){chunks.push(chunk);chunk=[];weight=0;}chunk.push(...slice);weight+=w;}
  }if(chunk.length)chunks.push(chunk);
  const result=chunks.map((cells,i)=>`<article class="mh-paper">${printHeader(r,i?'수업 달력 · 계속':'수업·정산 안내')} ${i?'':`<div class="mh-paper-summary"><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${equation(r)}<p class="mh-paper-groups">${C.groups(r).map(g=>esc(g.name)+' '+g.count+'건 · '+C.money(g.amount)).join(' / ')}</p></div>`}<div class="mh-weekdays">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div class="mh-calendar">${cells.map(c=>c.outerHTML).join('')}</div>${i?'':`<div class="mh-notes">${notes(r)}</div>`}${footer}</article>`);
  if(!$('mhIncludeDetails').checked)return result.map((html,i)=>html.replace('</footer>',` · ${i+1}/${result.length}</footer>`)).join('');
  const rows=r.lessons.map(l=>`<tr><td>${esc(l.date.slice(5))}</td><td>${esc(C.subject(l))} · ${esc(l.teacher)}<small>${esc(l.start||'')}${l.end?'–'+esc(l.end):''} · ${esc(C.status(l))}</small></td><td>${C.money(l.amount)}${l.discountParts?.length?'<small>할인 반영</small>':''}</td></tr>`);
  for(let i=0;i<rows.length;i+=16)result.push(`<article class="mh-paper">${printHeader(r,'수업료 상세 근거')}<table class="mh-table"><thead><tr><th>날짜</th><th>수업</th><th>적용 수업료</th></tr></thead><tbody>${rows.slice(i,i+16).join('')}</tbody></table>${footer}</article>`);
  for(let i=0;i<r.receipts.length;i+=16)result.push(`<article class="mh-paper">${printHeader(r,'납부·환불 상세 근거')}${receiptsTable({...r,receipts:r.receipts.slice(i,i+16)})}${footer}</article>`);
  return result.map((html,i)=>html.replace('</footer>',` · ${i+1}/${result.length}</footer>`)).join('');
 }
 function preview(){if(!row()||buttons()[0].disabled)return;$('mhPages').innerHTML=pages();$('mhPreview').hidden=false;$('mhPreview').scrollIntoView({behavior:'instant',block:'start'});}
 async function exportPages(kind){
  if(outputBusy||!row()||buttons()[0].disabled)return;const token=epoch,key=renderKey,fingerprint=data.fingerprint,selected=selectedMonth,details=$('mhIncludeDetails').checked;
  outputBusy=true;buttons().forEach(b=>b.disabled=true);$('mhStatus').textContent='최신 자료를 확인하고 안내 문서를 만들고 있어요…';
  let exportHost;
  const guard=()=>{if(token!==epoch||!active||key!==context()||selected!==selectedMonth||details!==$('mhIncludeDetails').checked||!isServerConfigured())throw Error('학생·월 또는 로그인 상태가 바뀌었습니다. 다시 출력해 주세요.');};
  try{
   const response=await getSupabaseClient().rpc('feecalc_monthly_history',{p_student_id:data.studentId,p_month:data.month});guard();if(response.error)throw Error(response.error.message);C.validate(response.data,data.studentId,data.month);
   if(response.data.fingerprint!==fingerprint){
    // The validated verification response already contains the full latest history.
    // Keep the selected month, but discard previews built from the old source.
    data=response.data;cache.set(key,{at:Date.now(),data});selectedGroup='';selectedDay='';
    $('mhPreview').hidden=true;$('mhPages').replaceChildren();render();
    throw Error('원본 내역이 변경되어 다시 불러왔습니다. 금액을 확인한 뒤 출력해 주세요.');
   }
   data=response.data;
   exportHost=document.createElement('div');exportHost.className='mh-export';exportHost.innerHTML=pages();document.body.append(exportHost);await document.fonts.ready;
   const images=await Promise.all([...exportHost.querySelectorAll('img')].map(async img=>{await img.decode();const blob=await(await fetch(img.src)).blob();return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});}));
   [...exportHost.querySelectorAll('img')].forEach((img,i)=>img.src=images[i]);
   const canvases=[];for(const paper of exportHost.children){guard();if(paper.scrollHeight/paper.offsetWidth>802/555)throw Error('한 페이지에 담기 어려운 긴 내역이 있습니다. 상세 근거 포함을 해제해 다시 저장하거나, 화면에서 월별 내역을 확인해 주세요.');canvases.push(await html2canvas(paper,{scale:1.5,useCORS:true,backgroundColor:'#fffefa',windowWidth:1200,scrollX:0,scrollY:0}));}guard();
   const name=`${data.studentName.replace(/[^\w가-힣-]/g,'_')}_${selected}_수강료히스토리`;
   if(kind==='pdf'){const pdf=await FeeHistoryPdf.create(canvases);guard();download(pdf,name+'.pdf');}else{
    // One image file prevents multi-download blocking; page gaps preserve the document order.
    const canvas=document.createElement('canvas');canvas.width=Math.max(...canvases.map(c=>c.width));canvas.height=canvases.reduce((n,c)=>n+c.height+24,0);if(canvas.height>30000)throw Error('이미지가 너무 깁니다. PDF 저장을 이용해 주세요.');const ctx=canvas.getContext('2d');ctx.fillStyle='#f2f3f1';ctx.fillRect(0,0,canvas.width,canvas.height);let y=0;for(const c of canvases){ctx.drawImage(c,0,y);y+=c.height+24;}const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));guard();if(!blob)throw Error('이미지 생성에 실패했습니다.');download(blob,name+'.png');
   }
   $('mhStatus').textContent='안내 파일을 저장했습니다. 학부모님께 전달하기 전에 내용을 확인해 주세요.';
  }catch(e){$('mhStatus').textContent=e.message||'출력에 실패했습니다. 다시 시도해 주세요.';}
  finally{exportHost?.remove();outputBusy=false;if(data&&active){const status=$('mhStatus').textContent;render();$('mhStatus').textContent=status;}}
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 $('mhSearch').oninput=options;$('mhStudent').onchange=()=>load();$('mhMonth').onchange=()=>load();$('mhReload').onclick=()=>load(true);
 for(const [id,d] of [['mhPrev',-1],['mhNext',1]])$(id).onclick=()=>{if(!$('mhMonth').value)return;$('mhMonth').value=C.shift($('mhMonth').value,d);load();};
 $('mhIncludeDetails').onchange=()=>{if(!$('mhPreview').hidden)preview();};$('mhParent').onclick=preview;$('mhClosePreview').onclick=()=>{$('mhPreview').hidden=true;$('mhParent').focus();};$('mhImage').onclick=()=>exportPages('image');$('mhPdf').onclick=()=>exportPages('pdf');
 $('mhCopy').onclick=async()=>{if(!data||!row()||$('mhCopy').disabled)return;try{await navigator.clipboard.writeText(C.message(data,row()));$('mhStatus').textContent='설명 문구를 복사했습니다.';}catch{$('mhStatus').textContent='클립보드 접근이 제한됐습니다. 학부모용 보기에서 내용을 확인해 주세요.';}};
 document.addEventListener('feecalc-auth-change',()=>{invalidate();cache.clear();pending.clear();identity='';registrySignature='';$('mhSearch').value='';$('mhStudent').replaceChildren(new Option('학생 선택',''));$('mhStatus').textContent='로그인 상태가 바뀌었습니다. 학생을 다시 선택해 주세요.';});
 const nav=document.createElement('button');nav.type='button';nav.dataset.purpose='monthly-history';nav.innerHTML=icon+'월별 수강료 히스토리';nav.onclick=()=>FeeCalendar.navigate('monthly-history');$('productHeader').querySelector('[data-purpose="history"]').after(nav);
 window.FeeMonthlyHistory={open,close,sync,get active(){return active;}};buttons().forEach(b=>b.disabled=true);
})();
