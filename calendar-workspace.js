// Revision 7 shell; existing staff auth, RPC gateway, and calculator modes remain authoritative.
(() => {
    const C=FeeCalendarCore, el=id=>document.getElementById(id), esc=escapeHtml;
    const logo='assets/brand/sedu-warm.svg';
    const money=v=>v===null?'확인 필요':Number(v).toLocaleString('ko-KR')+'원';
    const signed=v=>v===null?'확인 필요':(v>0?'+':v<0?'−':'')+money(Math.abs(v));
    const tone=v=>v>0?'positive':v<0?'negative':'neutral';
    const historyMismatch=()=>options.historySource&&((options.historySource.studentId&&options.historySource.studentId!==matchedStudent()?.id)||options.historySource.studentName!==getCurrentStudentName()||options.historySource.month!==month());
    const month=()=>`${el('targetYear').value}-${String(el('targetMonth').value).padStart(2,'0')}`;
    const priorMonth=()=>{const d=new Date(Number(el('targetYear').value),Number(el('targetMonth').value)-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
    const rowList=()=>[...document.querySelectorAll(currentTab==='auto'?'#autoList .auto-row':'#selectList .select-row')];
    let view='work',lastMode='auto',selectedRow=0,selectedSubject='전체',selectedDays=new Set(),detailDay=1,selectedExtraId=null,undo=[],applying=false,queued=false;
    let options={layout:'compact',showComparison:false,previous:null,source:null,placements:[],timetableSource:null};
    const originalReceiptHead=document.querySelector('.receipt-fee-table thead').innerHTML;
    let sourceSnapshot=null,sourceContext='',candidateResult=null,candidateGroups=[],fetchToken=0,sourceTimer=0,sourceAttempt='',sourcePending='',outputPending=false,legacySnapshot=null,draftMonth=null;
    const iconPaths={calculate:'M4 3h16v18H4zM7 7h10M7 11h2m4 0h4M7 15h2m4 0h4',progress:'M4 20V10m8 10V4m8 16v-7',history:'M4 8a9 9 0 1 1-1 7M4 3v5h5m3 0v5l3 2',notice:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',timetable:'M5 3v4m14-4v4M3 10h18M5 5h14v16H5z',settings:'M4 7h16M4 17h16M8 4v6m8 4v6'};
    const svg=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[key]||iconPaths.calculate}"/></svg>`;
    const subjectIcon=s=>{const key=/사탐|사회|역사|지리|윤리/.test(s)?'사회':/물리|화학|생명|지학/.test(s)?'과학':s;const url=SUBJECT_ICONS[key];return url?`<img class="subject-icon" src="${esc(url)}" crossorigin="anonymous" alt="" aria-hidden="true" onerror="this.hidden=true">`:'';};
    function scheduleOf(row){try{return JSON.parse(row.dataset.schedule||'{}');}catch{return {};}}
    function readRows(){return rowList().map(row=>({name:row.querySelector('.sub-name').value,hours:getBillableDuration(row,row.querySelector('.sub-name').value,0),rate:row.querySelector('.sub-rate').value===''?null:Number(row.querySelector('.sub-rate').value),rateKnown:row.querySelector('.sub-rate').value!=='',rateMode:getRowRateMode(row),days:[...row.querySelectorAll('.day-chk:checked')].map(c=>Number(c.value)),dates:[...(selectRowDates[row.id.replace('srow-','')]||[])],excludedDates:[...(autoRowExcludedDates[row.id.replace('arow-','')]||[])],schedule:scheduleOf(row),legacyAggregate:row.dataset.legacyAggregate==='true'}));}
    function activeLessons(){
        if(['auto','select'].includes(currentTab))return C.expand(readRows(),currentTab,month(),[...excludedDates]);
        if(currentTab==='history'&&historyMismatch())return [];
        if(currentTab==='history')return historyData.filter(r=>!r.excludeFromHistory&&r.month===Number(el('targetMonth').value)&&r.year===Number(el('targetYear').value)).map((r,i)=>({...C.info(r.subject,r.teacher),id:'history:'+i,day:r.day,hours:r.hours||0,amount:r.amount,rawName:r.subject,start:r.startTime||'',end:r.endTime||'',status:(getHistoryStatusMeta(r)?.label||r.attend||'출석').replace(/ · (과금|0원)$/,''),rate:null,rateMode:'perClass'}));
        if(currentTab==='progress'){const result=progressResult();return [...result.actual,...result.predicted].map(r=>({...C.info(r.className,r.teacher),id:r.id,day:Number(r.date.slice(-2)),hours:(r.minutes||0)/60,amount:r.amount,rawName:r.className,start:r.start,end:r.end,status:r.predicted?'예상':progressKind(r.kind),rate:null,predicted:r.predicted}));}
        if(currentTab==='timetable')return options.timetableSource?.month===month()&&options.timetableSource?.studentName===getCurrentStudentName()?options.placements:[];
        if(currentTab==='first')return collectFirstRegistrationRows().flatMap((r,i)=>getFirstRegistrationMonthDates(r).map(day=>({...C.info(r.name),id:'first:'+i+':'+day,day,hours:r.hours,amount:Math.round(r.rate*(r.rateMode==='perHour'?r.hours:1)),rawName:r.name,start:'',end:'',status:'예정'}))); 
        return [];
    }
    function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});}
    function markTouched(){el('calendarWorkspace').dispatchEvent(new Event('input',{bubbles:true}));}
    function saveUndo(){undo.push({state:collectCalculatorState(),loaded:currentLoadedRecordId});if(undo.length>25)undo.shift();}
    function restoreUndo(){const item=undo.pop();if(!item)return;const rest=undo;applyCalculatorState(item.state);undo=rest;currentLoadedRecordId=item.loaded;markTouched();refresh();}
    function navigate(purpose){
        if(purpose==='settings'){openAppSettings();return;}
        if(purpose==='notice'){view='notice';if(currentTab==='timetable')switchTab(lastMode);refresh();return;}
        view='work';
        if(purpose==='calculate')switchTab(['auto','select','manual','first'].includes(lastMode)?lastMode:'auto');
        if(purpose==='progress')switchTab('progress');
        if(purpose==='history')switchTab('history');
        if(purpose==='timetable')switchTab('timetable');
        refresh();
    }
    window.FeeCalendar={navigate,refresh,activeLessons};
    function setup(){
        if(el('productHeader'))return;
        document.title='에스에듀 반포관 · 수강료 계산기';document.body.classList.add('calendar-app');
        const header=document.createElement('header');header.id='productHeader';header.innerHTML=`<div class="product-brand"><img src="${logo}" alt="에스에듀 로고"><div><span>에스에듀 반포관</span><strong>수강료 계산기</strong></div></div><nav aria-label="수강료 업무 메뉴">${[['calculate','수강료 계산'],['progress','진행·정산'],['history','수업 이력'],['notice','안내서'],['timetable','시간표'],['settings','설정']].map(([key,label])=>`<button type="button" data-purpose="${key}">${svg(key)}${label}</button>`).join('')}</nav>`;
        document.body.prepend(header);header.querySelectorAll('[data-purpose]').forEach(b=>b.onclick=()=>navigate(b.dataset.purpose));
        const controls=el('controlColumn'),grid=el('workspaceGrid');
        const work=document.createElement('section');work.id='calendarWorkspace';work.innerHTML=`
          <div class="work-heading"><div><h2 id="workTitle">월간 수업 계산</h2><p id="workSummary"></p></div><div><button type="button" id="undoCalendar">실행 취소</button><button type="button" id="viewNotice">안내서 검토</button></div></div>
          <section id="sourceTools" class="source-tools"><div><strong>지난달 수업 가져오기</strong><span>학생을 찾으면 지난달 수업을 자동으로 보여 줍니다. 이번 달 요일이나 날짜를 선택해 적용하세요.</span></div><button type="button" id="loadSource">다시 불러오기</button><p id="sourceStatus" role="status"></p><div id="sourceCandidates" hidden></div></section>
          <div class="calendar-toolbar"><label>과목 표시<select id="calendarSubject"><option>전체</option></select></label><div id="weekdaySelect" aria-label="요일별 날짜 선택"></div><button type="button" id="clearCalendarSelection">날짜 선택 해제</button><button type="button" id="globalExcludeDays">선택 날짜 전체 휴강</button><button type="button" id="restoreGlobalDays">선택 날짜 휴강 해제</button></div>
          <div class="calendar-body"><div class="calendar-center"><img class="work-watermark" src="${logo}" alt="" aria-hidden="true"><div class="calendar-weekdays">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div id="workCalendar" class="work-calendar"></div></div><aside id="dayDetail" class="day-detail"></aside></div>
          <div id="calendarBatch" class="calendar-batch"><label>적용할 수업 조건<select id="calendarTemplate"></select></label><label>시수<input id="calendarHours" type="number" min="0" step="0.25"></label><label>단가<input id="calendarRate" type="number" min="0" step="any"></label><span id="calendarDiff" role="status"></span><div><button type="button" id="applyCalendar" class="primary">선택 날짜에 적용</button><button type="button" id="removeCalendar">선택 수업 제외</button></div></div>
          <p class="calendar-help">날짜의 체크 상자는 여러 날짜 선택, 날짜 제목은 당일 내역 확인입니다. 수업을 누르면 해당 조건을 선택합니다.</p>`;
        controls.after(work);
        const auth=el('staffAuthPanel');header.append(auth);auth.setAttribute('aria-label','직원 계정');
        auth.querySelectorAll(':scope > p:not(#staffAuthStatus)').forEach(p=>p.remove());
        const staffName=document.createElement('span');staffName.id='headerStaffName';auth.prepend(staffName);
        el('staffLoginId').placeholder='이메일·휴대전화';el('staffLoginPassword').placeholder='비밀번호';
        el('staffLogout').textContent='로그아웃';el('staffLogout').title='로그아웃 및 입력 초기화';
        new MutationObserver(syncHeaderAuth).observe(el('staffAuthStatus'),{childList:true,subtree:true,characterData:true});
        el('serverRecordArea').querySelector('h3').textContent='최근 저장 기록';
        el('serverRecordArea').querySelector('.record-panel-header').parentElement.querySelector('p')?.remove();
        document.querySelectorAll('#captureArea .watermark-img,#captureArea .receipt-brand img').forEach(img=>img.src=logo);
        el('receiptSubTitle').classList.add('receipt-document-title');el('captureArea').querySelector('.receipt-header').append(el('receiptSubTitle'),el('receiptContext'));
        el('dispTotal').parentElement.classList.add('receipt-total');
        const preview=el('captureArea').parentElement;preview.id='noticeColumn';
        const memoWidget=el('studentMemoWidget');if(memoWidget)controls.append(memoWidget);
        const review=document.createElement('div');review.id='noticeControls';review.innerHTML=`<div class="notice-heading"><h2>안내서 검토</h2><button type="button" id="returnWork">계산 작업</button></div><div class="notice-options"><label>출력 배치<select id="noticeLayout"><option value="compact">금액 요약 + 전체 달력</option><option value="portrait">세로 배치</option></select></label><label><input type="checkbox" id="showMonthComparison"> 전월 대비 시수 표시</label><button type="button" id="loadPreviousHours">전월 실제 시수 불러오기</button><span id="previousStatus" role="status"></span></div>`;
        el('captureArea').before(review);
        const legend=document.createElement('p');legend.id='calendarReceiptLegend';legend.textContent='날짜별 수업은 달력에, 금액 산출 근거는 과목·강사별 내역에 표시합니다.';el('receiptMiniCalGrid').after(legend);
        const compare=document.createElement('section');compare.id='monthComparison';legend.after(compare);
        const output=preview.querySelector('.image-save-button').parentElement;
        output.id='noticeTools';output.setAttribute('role','complementary');output.setAttribute('aria-label','이미지 출력과 안내 문자');
        const composer=output.querySelector('.bg-gray-100');composer.id='messageComposer';composer.querySelector('.text-xs.font-bold').textContent='안내 문자';
        output.querySelector('.image-save-button').remove();const outputBar=document.createElement('div');outputBar.className='output-actions';outputBar.innerHTML=`<button type="button" id="saveNoticeImage" class="primary">이미지 저장</button><button type="button" id="copyNoticeImage">이미지 복사</button><button type="button" id="openNoticeImage" hidden>생성 이미지 열기</button><span id="imageOutputStatus" role="status"></span>`;output.prepend(outputBar);const outputTitle=document.createElement('h3');outputTitle.textContent='이미지 출력';output.prepend(outputTitle);const editGuides=document.createElement('button');editGuides.type='button';editGuides.id='editReceiptGuides';editGuides.textContent='안내 문구 편집';editGuides.onclick=()=>{openAppSettings();switchSettingsTab('guides');};output.append(editGuides);
        el('saveNoticeImage').onclick=()=>outputImage('save');el('copyNoticeImage').onclick=()=>outputImage('copy');
        el('undoCalendar').onclick=restoreUndo;el('viewNotice').onclick=()=>{view='notice';refresh();};el('returnWork').onclick=()=>{view='work';refresh();};
        el('calendarSubject').onchange=e=>{selectedSubject=e.target.value;renderWork();};
        el('calendarTemplate').onchange=e=>{selectedExtraId=null;selectedRow=Number(e.target.value);updateBatch();renderWork();};
        el('calendarHours').oninput=updateDiff;el('calendarRate').oninput=updateDiff;
        el('clearCalendarSelection').onclick=()=>{selectedExtraId=null;selectedDays.clear();renderWork();};
        el('applyCalendar').onclick=()=>applyDates(false);el('removeCalendar').onclick=()=>applyDates(true);el('globalExcludeDays').onclick=()=>globalDates(true);el('restoreGlobalDays').onclick=()=>globalDates(false);
        el('loadSource').onclick=()=>loadSource(false);el('loadPreviousHours').onclick=loadPrevious;
        el('noticeLayout').onchange=e=>{options.layout=e.target.value;markTouched();refresh();};
        el('showMonthComparison').onchange=e=>{options.showComparison=e.target.checked;markTouched();refresh();};
        ['일','월','화','수','목','금','토'].forEach((day,i)=>{const b=document.createElement('button');b.type='button';b.textContent=day;b.setAttribute('aria-label',`${day}요일 날짜 선택`);b.onclick=()=>{selectedExtraId=null;for(let d=1;d<=C.daysInMonth(month());d++)if(C.weekday(month(),d)===i)selectedDays.add(d);renderWork();};el('weekdaySelect').append(b);});
        const tt=document.createElement('section');tt.id='timetablePlacement';tt.innerHTML=`<h3>시간표 배치</h3><p>현재 계산한 수업을 가져와 날짜·시작 시각을 직접 배치합니다. 수강료와 원본 기록은 바뀌지 않습니다.</p><button type="button" id="importTimetable">현재 계산 수업 가져오기</button><div id="timetableEditors"></div>`;el('tab-timetable').prepend(tt);el('importTimetable').onclick=importTimetable;
        const historyButton=document.createElement('button');historyButton.type='button';historyButton.className='primary intranet-history';historyButton.textContent='선택 월 인트라넷 이력 불러오기';historyButton.onclick=loadHistory;el('tab-history').prepend(historyButton);
        const subnav=el('tabNavRow');el('controlColumn').prepend(subnav);el('btn-ai').hidden=true;const aiFields=document.createElement('div');aiFields.hidden=true;while(el('tab-ai').firstChild)aiFields.append(el('tab-ai').firstChild);el('tab-ai').append(aiFields);el('tab-ai').insertAdjacentHTML('beforeend','<p>폐기된 기능의 과거 저장본입니다. 저장 당시 내역만 열람합니다. 새 계산·덮어쓰기는 지원하지 않습니다.</p>');
        el('workspaceTopBar').classList.add('hidden');
        el('calendarGrid').parentElement.classList.add('legacy-calendar');
        document.addEventListener('input',e=>{const row=e.target.closest('.auto-row,.select-row,.manual-row,.first-reg-row');if(row)row.dataset.legacyAggregate='false';if(e.target.closest('#controlColumn')&&!e.target.closest('#staffAuthPanel'))queue();});
        document.addEventListener('change',e=>{if(e.target.closest('#controlColumn'))queue();if(['targetYear','targetMonth'].includes(e.target.id))scheduleSourceLookup();});
        refresh();
    }
    function decorateConditions(){
        for(const [mode,id] of [['auto','autoList'],['select','selectList']]){
            [...el(id).querySelectorAll('.'+mode+'-row')].forEach((row,i)=>{
                let heading=row.querySelector('.condition-heading');
                if(!heading){const body=document.createElement('div');body.className='condition-fields';while(row.firstChild)body.append(row.firstChild);heading=document.createElement('button');heading.type='button';heading.className='condition-heading';row.append(heading,body);if(!row.querySelector('.sub-name').value)row.classList.add('condition-expanded');heading.onclick=()=>{selectedExtraId=null;selectedRow=rowList().indexOf(row);const open=!row.classList.contains('condition-expanded');row.classList.toggle('condition-expanded',open);heading.setAttribute('aria-expanded',String(open));updateBatch();renderWork();};}
                const name=row.querySelector('.sub-name').value||'새 수업 조건',hours=getBillableDuration(row,name,0),rate=row.querySelector('.sub-rate').value;
                heading.innerHTML=`<div>${subjectIcon(C.info(name).subject)}${esc(name)}<span>${hours}시간 · ${rate===''?'단가 미확인':money(Number(rate))}</span></div>`;
                heading.setAttribute('aria-expanded',String(row.classList.contains('condition-expanded')));
            });
        }
        el('tabNavRow').querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.id==='btn-'+currentTab)));
    }
    function renderWork(){
        const lessons=activeLessons(),rows=['auto','select'].includes(currentTab)?readRows():[];
        const editable=['auto','select'].includes(currentTab),subjects=[...new Set(lessons.map(r=>r.subject))];
        if(!subjects.includes(selectedSubject))selectedSubject='전체';
        el('calendarSubject').innerHTML=['전체',...subjects].map(s=>`<option ${selectedSubject===s?'selected':''}>${esc(s)}</option>`).join('');
        el('workTitle').textContent=`${el('targetMonth').value}월 · ${currentTab==='timetable'?'시간표 배치':TAB_LABELS[currentTab]||'월간 수업 계산'}`;
        el('workSummary').textContent=`${getCurrentStudentName()||'학생 선택'} · ${lessons.length}건 · ${Number(lessons.reduce((s,r)=>s+r.hours,0).toFixed(2))}시간${lessons.some(r=>r.amount===null)?' · 단가 확인 필요':''}`;
        el('viewNotice').textContent=currentTab==='timetable'?'시간표 미리보기':'안내서 검토';el('undoCalendar').disabled=!undo.length;
        el('calendarBatch').hidden=!editable;el('sourceTools').hidden=!editable;el('weekdaySelect').hidden=!editable;
        el('calendarTemplate').innerHTML=rows.map((r,i)=>`<option value="${i}" ${selectedRow===i?'selected':''}>${esc(r.name||'미분류 수업')} · ${r.hours}h · ${r.rateKnown?money(r.rate):'단가 미확인'}</option>`).join('');
        const host=el('workCalendar');host.replaceChildren();
        for(let i=0;i<C.weekday(month(),1);i++){const b=document.createElement('div');b.className='calendar-day outside';host.append(b);}
        for(let day=1;day<=C.daysInMonth(month());day++){
            const cell=document.createElement('div');cell.className='calendar-day'+(selectedDays.has(day)?' selected-date':'');
            const head=document.createElement('div');head.className='calendar-day-head';const title=document.createElement('button');title.type='button';title.textContent=day;title.setAttribute('aria-label',`${day}일 수업 내역`);title.onclick=()=>{detailDay=day;renderDay(lessons);};head.append(title);
            if(editable){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=selectedDays.has(day);box.setAttribute('aria-label',`${day}일 날짜 선택`);box.onchange=()=>{selectedExtraId=null;if(box.checked)selectedDays.add(day);else selectedDays.delete(day);cell.classList.toggle('selected-date',box.checked);updateDiff();};label.append(box);head.append(label);}cell.append(head);if(excludedDates.has(day))cell.insertAdjacentHTML('beforeend','<span class="global-holiday">전체 휴강</span>');
            for(const r of lessons.filter(r=>r.day===day&&(selectedSubject==='전체'||r.subject===selectedSubject))){const b=document.createElement('button');b.type='button';b.className=`calendar-event ${getSubjectColorClass(r.subject,false,false)}${r.row===selectedRow&&editable?' active-condition':''}`;b.innerHTML=`<strong>${subjectIcon(r.subject)}${esc(r.subject)}${r.teacher?' · '+esc(r.teacher):''}</strong><span>${esc(r.start&&r.end?`${r.start}–${r.end}`:r.hours+'시간')}${r.status==='예정'?'':' · '+esc(r.status)}</span>${currentTab==='timetable'?'':`<small class="${tone(r.amount)}">${signed(r.amount)}</small>`}`;b.onclick=()=>{detailDay=day;if(editable){selectedExtraId=null;selectedRow=r.row;updateBatch();}renderWork();};cell.append(b);}host.append(cell);
        }
        el('globalExcludeDays').hidden=!editable;el('restoreGlobalDays').hidden=!editable;renderDay(lessons);updateDiff();
    }
    function renderDay(lessons){
        const day=el('dayDetail');day.innerHTML=`<h3>${detailDay}일 수업 내역</h3>`;
        const daily=lessons.filter(r=>r.day===detailDay);
        for(const r of daily){const line=document.createElement('div');line.className='day-lesson';line.innerHTML=`<strong>${subjectIcon(r.subject)}${esc(r.subject)} · ${esc(r.teacher||'강사 미기재')}</strong><span>${esc(r.type)} · ${r.hours}시간 · ${esc(r.status)}</span><b class="${tone(r.amount)}">${signed(r.amount)}</b>`;
            if(['auto','select'].includes(currentTab)){
                const edit=document.createElement('button');edit.type='button';edit.textContent='이 회차 수정';edit.onclick=()=>{selectedExtraId=r.id.includes(':extra:')?r.id:null;selectedRow=r.row;selectedDays=new Set([detailDay]);updateBatch();el('calendarHours').value=r.hours;el('calendarRate').value=r.rate??'';renderWork();};line.append(edit);
                const remove=document.createElement('button');remove.type='button';remove.textContent='이 회차 제외';remove.onclick=()=>{saveUndo();const row=rowList()[r.row],s=scheduleOf(row);if(r.id.includes(':extra:'))s.additional=(s.additional||[]).filter(x=>r.id!==`${currentTab}:${r.row}:extra:${x.id}`);else s.removed=[...new Set([...(s.removed||[]),r.day])];row.dataset.legacyAggregate='false';row.dataset.schedule=JSON.stringify(s);commitCalendar();};line.append(remove);
            }day.append(line);
        }
        if(!daily.length)day.insertAdjacentHTML('beforeend','<p>등록된 수업이 없습니다.</p>');
        if(['auto','select'].includes(currentTab)){const b=document.createElement('button');b.type='button';b.textContent='같은 조건의 별도 회차 추가';b.onclick=()=>{const row=rowList()[selectedRow],hours=Number(el('calendarHours').value),rate=Number(el('calendarRate').value);if(!row||!validBatch())return;saveUndo();const s=scheduleOf(row);s.additional=[...(s.additional||[]),{id:crypto.randomUUID(),day:detailDay,hours,rate}];row.dataset.legacyAggregate='false';row.dataset.schedule=JSON.stringify(s);commitCalendar();};day.append(b);}
    }
    function updateBatch(){const r=readRows()[selectedRow];if(!r)return;el('calendarHours').value=r.hours;el('calendarRate').value=r.rate??'';el('calendarTemplate').value=selectedRow;updateDiff();}
    function validBatch(){return el('calendarHours').value!==''&&Number(el('calendarHours').value)>0&&el('calendarRate').value!==''&&Number(el('calendarRate').value)>=0&&Number.isFinite(Number(el('calendarRate').value));}
    function updateDiff(){
        if(!['auto','select'].includes(currentTab))return;
        const r=readRows()[selectedRow],days=[...selectedDays].filter(d=>!excludedDates.has(d)),all=activeLessons();
        const old=all.filter(l=>l.row===selectedRow&&days.includes(l.day)&&(selectedExtraId?l.id===selectedExtraId:!l.id.includes(':extra:')));
        const sum=rows=>rows.some(r=>r.amount===null)?null:rows.reduce((n,r)=>n+r.amount,0),hours=rows=>rows.reduce((n,r)=>n+r.hours,0);
        const next=r&&validBatch()?days.length*Math.round(Number(el('calendarRate').value)*(r.rateMode==='perHour'?Number(el('calendarHours').value):1)):null;
        const amount=sum(old),allOld=all.filter(r=>selectedDays.has(r.day)),allAmount=sum(allOld);
        const restored=C.expand(readRows(),currentTab,month(),[...excludedDates].filter(d=>!selectedDays.has(d))).filter(r=>selectedDays.has(r.day)),restoreAmount=sum(restored);
        const delta=v=>(v>0?'+':v<0?'−':'')+Math.abs(Number(v.toFixed(2)));
        el('calendarDiff').textContent=`선택 ${selectedDays.size}일${selectedExtraId?' · 별도 회차 수정':''} | 적용: ${delta(days.length-old.length)}건 · ${delta(days.length*Number(el('calendarHours').value)-hours(old))}시간 · ${next===null||amount===null?'금액 확인 필요':signed(next-amount)} | 선택 수업 제외: −${old.length}건 · −${Number(hours(old).toFixed(2))}시간 · ${amount===null?'금액 확인 필요':signed(-amount)} | 전체 휴강: −${allOld.length}건 · −${Number(hours(allOld).toFixed(2))}시간 · ${allAmount===null?'금액 확인 필요':signed(-allAmount)} | 휴강 해제: +${restored.length-allOld.length}건 · +${Number((hours(restored)-hours(allOld)).toFixed(2))}시간 · ${restoreAmount===null||allAmount===null?'금액 확인 필요':signed(restoreAmount-allAmount)}`;
        el('applyCalendar').disabled=!r||!days.length||!validBatch();el('removeCalendar').disabled=!r||!old.length;
        el('globalExcludeDays').disabled=!selectedDays.size;el('restoreGlobalDays').disabled=![...selectedDays].some(d=>excludedDates.has(d));
    }
    function globalDates(exclude){if(!selectedDays.size)return;saveUndo();for(const day of selectedDays){if(exclude)excludedDates.add(day);else{excludedDates.delete(day);selectCutoffExcludedDates.delete(day);}}selectedExtraId=null;commitCalendar();}
    function applyDates(remove){
        const row=rowList()[selectedRow];if(!row||!selectedDays.size||(!remove&&!validBatch()))return;saveUndo();
        const s=scheduleOf(row);s.extraDates=s.extraDates||[];s.removed=s.removed||[];s.overrides=s.overrides||{};
        if(selectedExtraId){const id=selectedExtraId,entry=(s.additional||[]).find(x=>id===`${currentTab}:${selectedRow}:extra:${x.id}`);if(entry){if(remove)s.additional=s.additional.filter(x=>x!==entry);else{entry.hours=Number(el('calendarHours').value);entry.rate=Number(el('calendarRate').value);}}selectedExtraId=null;row.dataset.schedule=JSON.stringify(s);commitCalendar();return;}
        for(const d of selectedDays){if(excludedDates.has(d))continue;if(remove)s.removed=[...new Set([...s.removed,d])];else{s.removed=s.removed.filter(n=>n!==d);s.extraDates=[...new Set([...s.extraDates,d])];s.overrides[d]={hours:Number(el('calendarHours').value),rate:Number(el('calendarRate').value)};}}
        row.dataset.legacyAggregate='false';row.dataset.schedule=JSON.stringify(s);commitCalendar();
    }
    function commitCalendar(){markTouched();updateAll();refresh();}
    function renderGroupedReceipt(lessons){
        document.querySelector('.receipt-fee-table').classList.toggle('grouped-receipt',['auto','select','history','progress','first'].includes(currentTab));
        if(!['auto','select','history','progress','first'].includes(currentTab)){document.querySelector('.receipt-fee-table thead').innerHTML=originalReceiptHead;return;}
        document.querySelector('.receipt-fee-table thead').innerHTML='<tr><th>과목·강사</th><th>수업 내역</th><th id="thAmount">금액</th></tr>';
        const billingLessons=currentTab==='first'?C.expand(collectFirstRegistrationRows().map(r=>({...r,dates:Array.from({length:getFirstRegistrationBillingCount(r)},(_,i)=>i+1)})),'select',month()):lessons;
        el('receiptBody').innerHTML=C.groups(billingLessons).map(g=>`<tr><td><strong>${subjectIcon(g.subject)}${esc(g.subject)}</strong><span class="receipt-teacher">${esc(g.teacher||'강사 미기재')}</span></td><td><div class="receipt-variants">${[...g.variants.values()].map(v=>`<span class="receipt-variant"><span class="variant-condition">${esc(v.type==='개별정규'?'개별':v.type)} ${v.hours}h × ${v.count}${currentTab==='history'?'건':'회'}${v.status==='예정'||v.status==='출석'?'':' · '+esc(v.status)}</span><small>${v.rate!==null&&v.rate!==undefined?money(v.rate)+(v.rateMode==='perHour'?'/시간':'/회'):v.amount===null?'금액 확인 필요':money(v.amount)+'/회'}</small></span>`).join('')}</div></td><td class="${tone(g.total)}">${signed(g.pending?null:g.total)}</td></tr>`).join('');
        const cal=el('receiptMiniCalGrid');cal.replaceChildren();
        for(let i=0;i<C.weekday(month(),1);i++){const c=document.createElement('div');c.className='receipt-cal-cell outside';cal.append(c);}
        for(let d=1;d<=C.daysInMonth(month());d++){
            const c=document.createElement('div');c.className='receipt-cal-cell';c.innerHTML=`<div class="rc-date">${d}</div>`;
            if(!isReceiptCalendarDetailsHidden())for(const r of lessons.filter(r=>r.day===d))c.insertAdjacentHTML('beforeend',`<div class="notice-event ${getSubjectColorClass(r.subject,false,false)}${r.status==='예상'?' predicted':''}"><strong>${subjectIcon(r.subject)}${esc(r.subject)}</strong><span class="notice-time">${esc(r.start&&r.end?formatCompactTimeRange(r.start,r.end):r.hours+'시간')}</span><small class="notice-meta">${r.teacher?'<span class="notice-teacher-name">'+esc(r.teacher)+'</span>':''}${r.status==='예정'||r.status==='출석'?'':'<span class="notice-status">'+esc(r.status)+'</span>'}</small></div>`);cal.append(c);
        }
    }
    function refresh(){
        if(!el('calendarWorkspace')||applying)return;
        if(draftMonth&&draftMonth!==month()){draftMonth=month();resetAndUpdate();}draftMonth=month();
        if(sourceContext&&sourceContext!==matchedStudent()?.id+'|'+month()){sourceContext='';sourceSnapshot=null;candidateResult=null;candidateGroups=[];fetchToken++;el('sourceCandidates').hidden=true;el('sourceStatus').textContent='학생·월이 바뀌어 지난달 수업을 다시 확인합니다.';el('loadSource').disabled=false;}
        el('receiptContext').hidden=currentTab!=='progress'||!el('receiptContext').textContent;
        const lessons=activeLessons(),editable=['auto','select'].includes(currentTab),notice=view==='notice';
        document.body.dataset.view=notice?'notice':'work';document.body.dataset.mode=currentTab;
        el('noticeColumn').hidden=!notice;el('calendarWorkspace').hidden=notice;el('controlColumn').hidden=notice;el('controlColumn').inert=!!legacySnapshot;
        el('noticeControls').querySelector('h2').textContent=currentTab==='timetable'?'시간표 검토':'안내서 검토';
        syncHeaderAuth();
        for(const b of el('productHeader').querySelectorAll('[data-purpose]'))b.setAttribute('aria-pressed',String(b.dataset.purpose===(notice?(currentTab==='timetable'?'timetable':'notice'):currentTab==='progress'||currentTab==='payment'?'progress':currentTab==='history'?'history':currentTab==='timetable'?'timetable':'calculate')));
        el('tabNavRow').querySelectorAll('button').forEach(b=>{const m=b.id.slice(4);b.hidden=currentTab==='ai'||(currentTab==='progress'||currentTab==='payment'?!['progress','payment'].includes(m):currentTab==='timetable'?m!=='timetable':currentTab==='history'?m!=='history':!['auto','select','manual','first','guide'].includes(m));});
        el('captureArea').classList.toggle('portrait-notice',options.layout==='portrait');el('noticeLayout').value=options.layout;el('showMonthComparison').checked=options.showComparison;
        if(editable){
            const subtotal=lessons.reduce((s,r)=>s+(r.amount||0),0),discount=getPercentDiscountInfo(subtotal),pending=lessons.some(r=>r.amount===null);
            el('dispSubtotal').textContent=signed(subtotal);updateDiscountSummaryRow(discount);renderAdjustmentSummary();
            el('dispTotal').textContent=pending?'단가 확인 필요':money(renderSiblingSummary(getCurrentStudentName(),discount.discountedBase+getAdjustmentTotal()));
            el('labelTotal').textContent='예상 납부액';updateInfoText(subtotal,getAdjustmentTotal());
            rowList().forEach((r,i)=>{const count=r.querySelector('.sub-count');if(count)count.value=lessons.filter(l=>l.row===i).length;});
        }
        if(el('studentMemoWidget')?.parentElement!==el('controlColumn'))el('controlColumn').append(el('studentMemoWidget'));
        if(currentTab==='history'&&historyMismatch()){el('dispTotal').textContent='학생·월 자료 재확인';el('generatedTextArea').value='선택 학생과 수업 이력의 학생·월이 다릅니다. 선택 학생의 기록을 다시 불러온 뒤 안내 문자를 생성하세요.';}
        document.querySelectorAll('[onclick="copyGeneratedText()"]').forEach(b=>b.disabled=currentTab==='history'&&!!historyMismatch());
        if(currentTab==='history'&&lessons.some(r=>r.amount===null))el('dispTotal').textContent='금액 확인 필요';
        decorateConditions();renderGroupedReceipt(lessons);renderWork();renderComparison(lessons);renderPlacements();
        for(const id of ['dispSubtotal','dispDiscount','dispAdj']){const n=el(id);if(!n)continue;const num=Number(n.textContent.replace(/[^\d.-]/g,''))*(n.textContent.includes('−')?-1:1);n.textContent=signed(num);n.classList.remove('positive','negative','neutral');n.classList.add(tone(num));}
        el('dispTotal')?.classList.add('expected-total');
        el('dispTotal')?.parentElement.classList.add('receipt-total');
        for(const row of el('priceSummaryArea').querySelectorAll('.flex,.payment-summary-row')){
            const label=row.firstElementChild,value=row.lastElementChild;
            if(!label||!value||label===value||!['수업 누계','수강료 소계'].includes(label.textContent.trim()))continue;
            const amount=Number(value.textContent.replace(/[^\d.-]/g,''));value.textContent=signed(amount);value.classList.remove('positive','negative','neutral');value.classList.add(tone(amount));
        }
        if(currentTab==='ai'){el('calendarWorkspace').hidden=true;view='notice';document.body.dataset.view='notice';el('noticeColumn').hidden=false;el('controlColumn').hidden=true;el('calendarBatch').hidden=true;}
        updateServerSaveModeUi();decorateRecords();scheduleSourceLookup();
    }
    function renderComparison(lessons){
        const host=el('monthComparison');host.hidden=!options.showComparison||!['auto','select','history','progress','first'].includes(currentTab);
        if(host.hidden)return;
        const bound=options.previous?.studentId===matchedStudent()?.id&&options.previous?.month===priorMonth();
        host.innerHTML='<h3>전월 대비 · 과목별 총 시수</h3>';
        if(!bound){host.insertAdjacentHTML('beforeend','<p>전월 자료를 불러오면 과목별 시수 변화를 표시합니다.</p>');return;}
        const baseline=options.previous.hours;
        host.insertAdjacentHTML('beforeend',`<p>${esc(options.previous.month)} 실제 기록 → ${esc(month())} ${currentTab==='history'?'실제 기록':'계산 수업'} · 전월 누락·변경 사항은 확인해 주세요.</p>`);
        for(const row of C.compareHours(C.hoursBySubject(lessons),baseline))host.insertAdjacentHTML('beforeend',`<div class="comparison-line"><span>${subjectIcon(row.subject)}${esc(row.subject)} ${row.previous??'미확인'} → ${Number(row.current.toFixed(2))}시간</span><b class="${tone(row.percent)}">${row.label||((row.percent>0?'+':row.percent<0?'−':'')+Math.abs(row.percent).toFixed(1)+'%')}</b></div>`);
    }
    async function fetchSnapshot(whichMonth){
        const student=matchedStudent();if(!student||!isServerConfigured())throw Error('직원 로그인 후 등록 학생을 선택해 주세요.');
        const epoch=staffAuthEpoch,studentId=student.id,context=month();
        const {data,error}=await getSupabaseClient().rpc('feecalc_progress',{p_student_id:studentId,p_month:whichMonth});
        if(epoch!==staffAuthEpoch||studentId!==matchedStudent()?.id||context!==month())throw Error('학생·월이 바뀌어 조회를 취소했습니다.');
        if(error)throw Error(error.message);const snapshot=ProgressCore.validateSnapshot(data);
        if(snapshot.studentId!==studentId||snapshot.month!==whichMonth)throw Error('조회된 학생·월이 일치하지 않습니다.');return snapshot;
    }
    function scheduleSourceLookup(){
        if(!el('loadSource')||!['auto','select'].includes(currentTab))return;
        const student=matchedStudent();
        if(!student||!isServerConfigured()){clearTimeout(sourceTimer);sourceAttempt='';return;}
        const key=student.id+'|'+month();
        if(key===sourceContext||key===sourcePending||key===sourceAttempt)return;
        clearTimeout(sourceTimer);
        sourceTimer=setTimeout(()=>{if(matchedStudent()?.id===student.id&&month()===key.split('|')[1])loadSource(true);},320);
    }
    async function loadSource(automatic=false){
        const student=matchedStudent(),key=student?.id+'|'+month();
        if(automatic&&(!student||!['auto','select'].includes(currentTab)||key===sourceContext||key===sourcePending))return;
        clearTimeout(sourceTimer);sourceAttempt=key;sourcePending=key;
        const token=++fetchToken;el('loadSource').disabled=true;el('sourceStatus').textContent='지난달 수업을 불러오는 중입니다.';
        try{
            const snapshot=await fetchSnapshot(priorMonth());if(token!==fetchToken)return;
            sourceSnapshot=snapshot;sourceContext=matchedStudent().id+'|'+month();candidateResult=C.candidates(snapshot);candidateGroups=C.groupCandidates(candidateResult.rows);
            renderCandidates();
            el('sourceStatus').textContent=snapshot.lessons.length?`${snapshot.month} 수업 ${snapshot.lessons.length}건에서 조건 ${candidateGroups.length}개를 찾았습니다. 보충·결석·일회성 등 ${candidateResult.excluded.length}건은 제안에서 뺐습니다.`:'지난달 수업 기록이 없습니다. 수업 조건을 직접 추가할 수 있습니다.';
        }catch(error){if(token===fetchToken)el('sourceStatus').textContent=error.message+' 다시 불러오기를 누르거나 직접 입력해 주세요.';}
        finally{if(token===fetchToken){sourcePending='';el('loadSource').disabled=false;}}
    }
    function pickedCandidateCards(){
        return [...el('sourceCandidates').querySelectorAll('[data-source-group]')].map(card=>{
            const group=candidateGroups[Number(card.dataset.sourceGroup)];
            const days=[...card.querySelectorAll('[data-source-weekday][aria-pressed="true"]')].map(b=>Number(b.dataset.sourceWeekday));
            const dates=[...card.querySelectorAll('[data-source-date]:checked')].map(input=>Number(input.dataset.sourceDate));
            return {group,days,dates};
        }).filter(item=>item.group&&(currentTab==='auto'?item.days.length:item.dates.length));
    }
    function updateCandidateSelection(){
        const host=el('sourceCandidates');
        for(const card of host.querySelectorAll('[data-source-group]')){
            const count=currentTab==='auto'?card.querySelectorAll('[data-source-weekday][aria-pressed="true"]').length:card.querySelectorAll('[data-source-date]:checked').length;
            card.querySelector('.source-selection-count').textContent=count?currentTab==='auto'?`${count}개 요일 선택`:`${count}일 선택`:'선택 없음';
        }
        const chosen=pickedCandidateCards();el('applyCandidates').disabled=!chosen.length;
        el('candidateSelectionSummary').textContent=chosen.length?`${chosen.length}개 수업 조건을 ${month()} 달력에 추가합니다. 기존 수업은 유지됩니다.`:'수업의 요일이나 날짜를 선택해 주세요.';
    }
    function renderCandidates(){
        const host=el('sourceCandidates');host.hidden=!candidateGroups.length;
        if(!candidateGroups.length){host.replaceChildren();return;}
        const selective=currentTab==='select',weekdayLabels=['일','월','화','수','목','금','토'];
        host.innerHTML=`<div class="source-candidate-heading"><strong>지난달 수업 ${candidateGroups.length}개</strong><span>${selective?'이번 달 수업 날짜를 고르세요. 요일을 누르면 해당 날짜가 한 번에 선택됩니다.':'이번 달에 진행할 요일을 고르세요. 반복된 요일은 미리 선택했습니다.'}</span></div><div id="candidateRows" class="source-candidate-grid"></div><div class="source-candidate-footer"><p>시간표·학생별 변경 안내를 확인한 뒤 적용하세요. 1회 기록과 같은 날 다른 조건은 직접 확인이 필요합니다.</p><span id="candidateSelectionSummary" role="status"></span><button type="button" id="applyCandidates" class="primary" disabled>선택한 ${selective?'날짜':'요일'}로 수업 추가</button></div>`;
        candidateGroups.forEach((group,i)=>{
            const card=document.createElement('section');card.className='source-candidate';card.dataset.sourceGroup=String(i);
            const suggested=new Set(group.weekdays.filter(w=>w.suggested).map(w=>w.day));
            const evidence=group.sourceDates.map(date=>date.slice(5).replace('-','/')).join(' · ');
            const warnings=group.reasons.filter(reason=>reason!=='다음 달 시간표·변경 안내 대조');
            card.innerHTML=`<div class="source-candidate-title"><strong>${subjectIcon(group.subject)}${esc(group.subject)} · ${esc(group.teacher||'강사 미기재')}</strong><b>${group.amount===null?'단가 확인 필요':esc(money(group.amount)+'/회')}</b></div><div class="source-candidate-meta">${esc(group.type)} · ${group.hours}시간 · 지난달 ${group.sourceDates.length}회${group.separateSession&&group.times.length?' · 기록 시각 '+esc(group.times.join(', ')):group.times.length>1?' · 시각 변경 기록':''}</div><p class="source-evidence">수업일 ${esc(evidence)}${warnings.length?' · '+esc(warnings.join(' / ')):''}</p><div class="source-weekdays" role="group" aria-label="${esc(group.subject)} ${esc(group.teacher)} ${selective?'날짜 빠른 선택':'요일 선택'}">${weekdayLabels.map((day,index)=>`<button type="button" data-source-weekday="${index}" aria-pressed="${suggested.has(index)?'true':'false'}"><span>${day}</span>${group.weekdays.some(w=>w.day===index)?`<small>${group.weekdays.find(w=>w.day===index).count}회</small>`:''}</button>`).join('')}</div>${selective?`<button type="button" class="source-date-toggle" aria-expanded="false">날짜 직접 고르기</button><div class="source-date-picker" hidden><div class="source-date-weekdays">${weekdayLabels.map(day=>`<span>${day}</span>`).join('')}</div><div class="source-date-grid">${Array.from({length:C.weekday(month(),1)},()=>'<span></span>').join('')}${Array.from({length:C.daysInMonth(month())},(_,n)=>{const day=n+1,checked=suggested.has(C.weekday(month(),day));return `<label><input type="checkbox" data-source-date="${day}" aria-label="${esc(group.subject)} ${day}일" ${checked?'checked':''}><span>${day}</span></label>`;}).join('')}</div></div>`:''}<span class="source-selection-count"></span>`;
            for(const button of card.querySelectorAll('[data-source-weekday]'))button.onclick=()=>{
                const active=button.getAttribute('aria-pressed')!=='true';
                if(selective){
                    for(const input of card.querySelectorAll('[data-source-date]'))if(C.weekday(month(),Number(input.dataset.sourceDate))===Number(button.dataset.sourceWeekday))input.checked=active;
                    syncCandidateWeekdays(card);
                }else button.setAttribute('aria-pressed',String(active));
                updateCandidateSelection();
            };
            if(selective){
                const toggle=card.querySelector('.source-date-toggle');toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));card.querySelector('.source-date-picker').hidden=!open;toggle.textContent=open?'날짜 선택 접기':'날짜 직접 고르기';};
                card.querySelector('.source-date-picker').onchange=()=>{syncCandidateWeekdays(card);updateCandidateSelection();};
            }
            el('candidateRows').append(card);
        });
        el('applyCandidates').onclick=applyCandidates;updateCandidateSelection();
    }
    function syncCandidateWeekdays(card){
        for(const button of card.querySelectorAll('[data-source-weekday]')){
            const inputs=[...card.querySelectorAll('[data-source-date]')].filter(input=>C.weekday(month(),Number(input.dataset.sourceDate))===Number(button.dataset.sourceWeekday));
            button.setAttribute('aria-pressed',String(inputs.length>0&&inputs.every(input=>input.checked)));
            button.classList.toggle('partly-selected',inputs.some(input=>input.checked)&&!inputs.every(input=>input.checked));
        }
    }
    function applyCandidates(){
        if(sourceContext!==matchedStudent()?.id+'|'+month())return;
        const chosen=pickedCandidateCards();if(!chosen.length)return;
        const mode=currentTab;if(!['auto','select'].includes(mode))return;saveUndo();
        const existing=new Set(readRows().map(row=>{const info=C.info(row.name);return JSON.stringify([info.subject,info.teacher,info.type,row.hours,row.rate,mode==='auto'?row.days.sort((a,b)=>a-b):row.dates.sort((a,b)=>a-b)]);}));
        const selectedKeys=new Set(rowList().flatMap(row=>JSON.parse(row.dataset.candidateKeys||'[]')));
        let added=0;
        for(const {group,days,dates} of chosen){
            const selected=(mode==='auto'?days:dates).sort((a,b)=>a-b),key=JSON.stringify([group.subject,group.teacher,group.type,group.hours,group.amount,selected]);
            if(selectedKeys.has(group.id)||(!group.separateSession&&existing.has(key)))continue;
            const name=`${group.subject}-${group.type}(${group.teacher})-${group.hours}h`;
            if(mode==='auto')addAutoRow(name);else addSelectRow(name);
            const row=rowList().at(-1);row.querySelector('.sub-rate').value=group.amount??'';row.querySelector('.sub-hours').value=group.hours;row.querySelector('.rate-mode').value='perClass';
            if(mode==='auto')for(const day of days)row.querySelector(`.day-chk[value="${day}"]`).checked=true;
            else selectRowDates[row.id.replace('srow-','')]=new Set(dates);
            row.dataset.sourceIds=JSON.stringify(group.sourceIds);row.dataset.candidateKeys=JSON.stringify([group.id]);existing.add(key);added++;
        }
        options.source={studentId:sourceSnapshot.studentId,month:sourceSnapshot.month,fetchedAt:sourceSnapshot.fetchedAt,confirmedAt:new Date().toISOString(),sourceIds:chosen.flatMap(item=>item.group.sourceIds),targetMonth:month()};
        options.previous={studentId:sourceSnapshot.studentId,month:sourceSnapshot.month,hours:C.hoursBySubject(C.normalizeSnapshot(sourceSnapshot).filter(r=>r.kind!=='absence'))};
        el('sourceCandidates').hidden=true;el('sourceStatus').textContent=added?`${added}개 수업을 추가했습니다. 달력에서 날짜와 금액을 확인하세요.`:'이미 추가한 수업입니다. 달력에서 요일이나 날짜를 수정할 수 있습니다.';updateDateContext();commitCalendar();
    }
    async function loadPrevious(){
        el('loadPreviousHours').disabled=true;el('previousStatus').textContent='전월 실제 시수 확인 중';
        try{const s=await fetchSnapshot(priorMonth());if(!s.lessons.length)throw Error('전월 기록이 없습니다. 0시간으로 간주하지 않습니다.');options.previous={studentId:s.studentId,month:s.month,hours:C.hoursBySubject(C.normalizeSnapshot(s).filter(r=>r.kind!=='absence'))};markTouched();el('previousStatus').textContent=`${s.month} 원본 ${s.lessons.length}건 확인`;refresh();}catch(error){el('previousStatus').textContent=error.message;}finally{el('loadPreviousHours').disabled=false;}
    }
    async function loadHistory(){
        const button=document.querySelector('.intranet-history');button.disabled=true;
        try{const s=await fetchSnapshot(month());if(currentTab!=='history')return;saveUndo();const statusMap={regular:'출석',late:'지각',cancel:'당일취소',absence:'결석예고',absenceMakeup:'결석보강',cancelMakeup:'보충',lateMakeup:'보충',free:'프리'};
            options.historySource={studentId:s.studentId,studentName:getCurrentStudentName(),month:s.month,origin:'intranet'};
            historyData=s.lessons.map(r=>normalizeHistoryRecord({sourceId:r.id,year:Number(s.month.slice(0,4)),month:Number(s.month.slice(5)),day:Number(r.date.slice(-2)),subject:r.className,teacher:r.teacher,attend:statusMap[r.kind]||r.kind,hours:(r.minutes||0)/60,amount:r.amount,originalAmount:r.amount,amountPending:r.amount===null,startTime:r.start,endTime:r.end,compactTimeRange:formatCompactTimeRange(r.start,r.end)}));updateHistoryView();markTouched();refresh();setServerRecordStatus(`${s.month} 인트라넷 기록 ${s.lessons.length}건을 읽었습니다. 원본은 변경되지 않습니다.`,'success');
        }catch(error){setServerRecordStatus(error.message,'error');}finally{button.disabled=false;}
    }
    const oldHistoryPaste=processHistoryPaste;processHistoryPaste=function(...args){const before=historyData,result=oldHistoryPaste(...args);if(historyData!==before){options.historySource={studentId:matchedStudent()?.id||'',studentName:getCurrentStudentName(),month:month(),origin:'paste'};queue();}return result;};
    function importTimetable(){
        const savedMode=currentTab;currentTab=lastMode;const rows=activeLessons();currentTab=savedMode;
        if(!rows.length){setServerRecordStatus('수강료 계산·진행·이력에서 날짜별 수업을 먼저 준비하세요.','warning');return;}
        if(options.placements.length&&!confirm('현재 시간표 배치를 계산 수업으로 교체할까요?'))return;
        saveUndo();options.placements=rows.map(r=>({...r,id:crypto.randomUUID(),sourceId:r.id,start:r.start||'',end:r.end||''}));options.timetableSource={mode:lastMode,studentId:matchedStudent()?.id||'',month:month(),studentName:getCurrentStudentName()};markTouched();refresh();
    }
    function migrateTimetable(){
        options.placements=ttData.flatMap((r,i)=>{const days=Array.from({length:C.daysInMonth(month())},(_,n)=>n+1).filter(d=>!excludedDates.has(d)&&(C.weekday(month(),d)===Number(r.day)||(r.manualDates||[]).includes(d)));return days.map(day=>({...C.info(r.subject),id:'legacy-tt:'+i+':'+day,day,hours:r.duration,amount:null,start:String(r.start).padStart(2,'0')+':00',end:String((Number(r.start)+Number(r.duration))%24).padStart(2,'0')+':00',status:'예정'}));});
        options.timetableSource={month:month(),studentName:getCurrentStudentName()};
    }
    const oldTtResult=renderTimetableResult;renderTimetableResult=function(...args){const value=oldTtResult(...args);if(!applying){migrateTimetable();queue();}return value;};
    function renderPlacements(){
        const host=el('timetableEditors');if(!host)return;host.replaceChildren();if(currentTab!=='timetable')return;
        const placements=activeLessons();for(const r of placements){const line=document.createElement('div');line.className='placement-row';line.innerHTML=`<strong>${subjectIcon(r.subject)}${esc(r.subject)} · ${esc(r.teacher||'강사')} · ${r.hours}h</strong><label>날짜<input type="number" min="1" max="${C.daysInMonth(month())}" value="${r.day}"></label><label>시작<input type="time" value="${esc(r.start)}"></label><button type="button">제외</button>`;
            const [day,start]=line.querySelectorAll('input');day.onchange=()=>{if(!Number.isInteger(Number(day.value))||Number(day.value)<1||Number(day.value)>C.daysInMonth(month())){day.value=r.day;return;}saveUndo();r.day=Number(day.value);markTouched();refresh();};start.onchange=()=>{saveUndo();r.start=start.value;const [h,m]=start.value.split(':').map(Number),end=(h*60+m+r.hours*60)%1440;r.end=Number.isFinite(end)?`${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`:'';markTouched();refresh();};line.querySelector('button').onclick=()=>{saveUndo();options.placements=options.placements.filter(x=>x!==r);markTouched();refresh();};host.append(line);
        }
        // Timetable output is intentionally independent of tuition totals.
        el('receiptSubTitle').textContent=`${el('targetMonth').value}월 수업 시간표`;
        const cal=el('receiptMiniCalGrid');cal.replaceChildren();for(let i=0;i<C.weekday(month(),1);i++)cal.insertAdjacentHTML('beforeend','<div class="receipt-cal-cell outside"></div>');
        for(let day=1;day<=C.daysInMonth(month());day++)cal.insertAdjacentHTML('beforeend',`<div class="receipt-cal-cell"><div class="rc-date">${day}</div>${placements.filter(r=>r.day===day).map(r=>`<div class="notice-event ${getSubjectColorClass(r.subject,false,false)}"><strong>${subjectIcon(r.subject)}${esc(r.subject)} · ${esc(r.teacher)}</strong><span class="notice-time">${esc(r.start&&r.end?r.start+'–'+r.end:r.hours+'시간 · 시각 미배치')}</span></div>`).join('')}</div>`);
    }
    let outputUrl='';
    async function outputImage(action){
        if(outputPending)return;
        if(currentTab==='history'&&historyMismatch()){el('imageOutputStatus').textContent='수업 이력의 학생·월이 다릅니다. 선택 학생의 기록을 다시 불러오세요.';return;}
        if(currentTab==='progress'&&!progressReady()){setServerRecordStatus('최신 수업과 미확인 금액을 확인한 뒤 출력하세요.','warning');return;}
        if(['auto','select','history'].includes(currentTab)&&activeLessons().some(r=>r.amount===null)){el('imageOutputStatus').textContent='단가 미확인 수업을 먼저 확인하세요. 0원은 직접 입력할 수 있습니다.';return;}
        outputPending=true;el('imageOutputStatus').textContent='이미지를 만들고 있습니다.';
        const target=el('captureArea'),oldWidth=target.style.width,oldMax=target.style.maxWidth;
        const context=JSON.stringify(collectCalculatorState());
        document.querySelectorAll('.output-actions button').forEach(b=>b.disabled=true);
        try{
            if(typeof html2canvas!=='function')throw Error('이미지 변환기를 불러오지 못했습니다. 네트워크를 확인한 뒤 재시도하세요.');
            await document.fonts.ready;
            await Promise.all([...target.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,8000);}))); 
            target.style.width='1120px';target.style.maxWidth='1120px';await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const canvas=await html2canvas(target,{scale:2,useCORS:true,backgroundColor:'#fff',windowWidth:1440,onclone:doc=>{doc.body.classList.add('capture-mode');doc.getElementById('captureArea').style.width='1120px';}});
            if(context!==JSON.stringify(collectCalculatorState()))throw Error('이미지 생성 중 계산 내용이 바뀌었습니다. 다시 출력하세요.');
            const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(Error('이미지 생성에 실패했습니다.')),'image/png'));
            if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=URL.createObjectURL(blob);const url=outputUrl;
            el('openNoticeImage').hidden=false;el('openNoticeImage').onclick=()=>window.open(url,'_blank');
            let copied=false;if(action==='copy'){try{if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error();await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);copied=true;}catch{el('imageOutputStatus').textContent='이미지 복사가 제한되어 파일 저장으로 전환합니다.';}}
            if(!copied){const a=document.createElement('a');a.href=url;a.download=`${getCurrentStudentName().replace(/[^\w가-힣-]/g,'_')||'학생'}_${month()}_${currentTab==='timetable'?'시간표':'수강료안내서'}.png`;a.click();}
            el('imageOutputStatus').textContent=copied?'이미지를 복사했습니다.':'파일 저장을 요청했습니다. 다운로드가 막히면 생성 이미지 열기를 사용하세요.';
        }catch(error){el('imageOutputStatus').textContent=error.message||'출력 실패 · 입력을 유지했습니다. 다시 시도하세요.';}
        finally{target.style.width=oldWidth;target.style.maxWidth=oldMax;outputPending=false;document.querySelectorAll('.output-actions button').forEach(b=>b.disabled=false);}
    }
    // Persist only draft extensions. School assets and student registry stay out of localStorage.
    const collectOriginal=collectCalculatorState;
    collectCalculatorState=function(){
        if(legacySnapshot)return JSON.parse(JSON.stringify(legacySnapshot));
        const data=collectOriginal();data.calendarWorkspace=JSON.parse(JSON.stringify(options));
        for(const [mode,id] of [['auto','autoList'],['select','selectList'],['manual','manualList']]){
            const nodes=[...el(id).querySelectorAll('.'+mode+'-row')];
            data[mode+'Rows'].forEach((r,i)=>{const row=nodes[i];r.rate=Number(row.querySelector('.sub-rate').value)||0;r.rateKnown=row.querySelector('.sub-rate').value!=='';r.schedule=scheduleOf(row);r.sourceIds=JSON.parse(row.dataset.sourceIds||'[]');r.legacyAggregate=row.dataset.legacyAggregate==='true';r.candidateKeys=JSON.parse(row.dataset.candidateKeys||'[]');});
        }return data;
    };
    const applyOriginal=applyCalculatorState;
    applyCalculatorState=function(data,...args){
        const m=`${data.targetYear}-${String(data.targetMonth).padStart(2,'0')}`;
        for(const key of ['autoRows','selectRows'])for(const row of data[key]||[])C.validateSchedule(row.schedule,m);
        applying=true;legacySnapshot=null;options={layout:'compact',showComparison:false,previous:null,source:null,placements:[],timetableSource:null,...(data.calendarWorkspace||{})};
        if(!Array.isArray(options.placements)||options.placements.some(r=>!r||!Number.isInteger(r.day)||r.day<1||r.day>31||!Number.isFinite(r.hours)||r.hours<0)) {applying=false;throw Error('시간표 저장 형식을 확인해 주세요.');}
        try{const result=applyOriginal(data,...args);
        
        if(data.currentTab==='history'&&data.historyData?.length&&!options.historySource)options.historySource={studentId:data.studentId||'',studentName:data.studentName||'',month:m,origin:'saved'};
        if(data.currentTab==='timetable'&&!data.calendarWorkspace)migrateTimetable();
        if(data.currentTab==='ai'){legacySnapshot=JSON.parse(JSON.stringify(data));view='notice';}else{view='work';lastMode=data.currentTab||'auto';}
        selectedExtraId=null;selectedDays.clear();selectedRow=0;undo=[];sourceSnapshot=null;candidateResult=null;candidateGroups=[];sourceContext='';sourceAttempt='';sourcePending='';fetchToken++;clearTimeout(sourceTimer);if(el('sourceCandidates'))el('sourceCandidates').hidden=true;
        return result;}finally{applying=false;draftMonth=month();updateBatch();refresh();window.markCalculatorSaved();}
    };
    const oldSwitch=switchTab;
    switchTab=function(tab){
        if(tab==='ai'&&!applying){setServerRecordStatus('AI예측 기능은 폐기되었습니다. 기존 저장본에서만 열람할 수 있습니다.','warning');return;}
        if(tab!=='timetable'&&tab!=='ai')lastMode=tab;
        if(!applying&&tab!=='ai')legacySnapshot=null;
        oldSwitch(tab);selectedDays.clear();selectedRow=0;updateBatch();if(['auto','select'].includes(tab)&&candidateGroups.length&&sourceContext===matchedStudent()?.id+'|'+month())renderCandidates();queue();
    };
    const oldUpdate=updateAll;updateAll=function(...args){oldUpdate(...args);if(!applying)queue();};
    for(const name of ['updateHistoryView','renderPaymentReceipt','renderProgress','renderFirstRegistrationView','renderGuideEstimate','updateTimetableView']){const original=window[name];if(typeof original==='function')window[name]=function(...args){const result=original(...args);queue();return result;};}
    const oldReset=resetAndUpdate;resetAndUpdate=function(...args){selectedDays.clear();options.source=null;options.previous=null;options.showComparison=false;options.placements=[];options.timetableSource=null;document.querySelectorAll('[data-schedule]').forEach(row=>{delete row.dataset.schedule;delete row.dataset.sourceIds;delete row.dataset.candidateKeys;row.dataset.legacyAggregate='false';});return oldReset(...args);};
    const oldClear=clearMonthlyState;clearMonthlyState=function(...args){draftMonth=null;selectedExtraId=null;legacySnapshot=null;options={layout:'compact',showComparison:false,previous:null,source:null,placements:[],timetableSource:null};sourceSnapshot=null;candidateResult=null;candidateGroups=[];sourceContext='';sourceAttempt='';sourcePending='';clearTimeout(sourceTimer);fetchToken++;selectedDays.clear();undo=[];if(el('sourceCandidates'))el('sourceCandidates').hidden=true;document.querySelectorAll('[data-schedule]').forEach(row=>{delete row.dataset.schedule;delete row.dataset.sourceIds;delete row.dataset.candidateKeys;row.dataset.legacyAggregate='false';});return oldClear(...args);};
    const oldSave=saveServerRecord;saveServerRecord=function(...args){refresh();if(currentTab==='history'&&historyMismatch()){setServerRecordStatus('선택 학생의 수업 이력을 다시 불러온 뒤 저장하세요.','warning');return;}if(legacySnapshot){setServerRecordStatus('폐기된 AI예측 저장본은 열람만 가능합니다. 새 계산으로 시작하세요.','warning');return;}if(['auto','select','history'].includes(currentTab)&&activeLessons().some(r=>r.amount===null)){setServerRecordStatus('단가 미확인 수업을 확인한 뒤 저장하세요.','warning');return;}return oldSave(...args);};
    const oldSaveUi=updateServerSaveModeUi;updateServerSaveModeUi=function(){oldSaveUi();if(legacySnapshot||(currentTab==='history'&&historyMismatch())||(['auto','select','history'].includes(currentTab)&&activeLessons().some(r=>r.amount===null)))document.querySelectorAll('[onclick^="saveServerRecord("]').forEach(b=>b.disabled=true);};
    const oldHistoryText=updateHistoryInfoText;updateHistoryInfoText=function(...args){if(historyMismatch()){el('generatedTextArea').value='선택 학생과 수업 이력의 학생·월이 다릅니다. 선택 학생의 기록을 다시 불러온 뒤 안내 문자를 생성하세요.';return;}return oldHistoryText(...args);};
    const oldCopyText=copyGeneratedText;copyGeneratedText=function(...args){if(currentTab==='history'&&historyMismatch()){updateHistoryInfoText();setServerRecordStatus('선택 학생의 수업 이력을 다시 불러온 뒤 문자를 복사하세요.','warning');return;}return oldCopyText(...args);};
    window.downloadImage=()=>outputImage('save');window.processAiPrediction=()=>setServerRecordStatus('AI예측 기능은 폐기되었습니다.','warning');
    const oldInit=initWorkspaceLayout;initWorkspaceLayout=function(){oldInit();setup();};
    const oldLoad=window.onload;window.onload=async function(...args){const value=await oldLoad.apply(this,args);setup();updateBatch();refresh();return value;};
    const oldStudentMatch=syncStudentMatch;syncStudentMatch=function(...args){const result=oldStudentMatch(...args);scheduleSourceLookup();return result;};
    const oldRecords=renderServerRecordList;renderServerRecordList=function(){oldRecords();decorateRecords();};
    const knownSchools=typeof SCHOOL_ICONS==='undefined'?{}:SCHOOL_ICONS;
    function decorateRecords(){
        if(!isServerConfigured()&&!document.querySelector('#serverRecordList .record-item')){el('serverRecordList').textContent='';return;}
        [...document.querySelectorAll('#serverRecordList .record-item')].forEach((card,i)=>{
            const record=serverRecordHistory[i];if(!record)return;
            const byName=studentRegistry.filter(s=>s.name===record.studentName),student=record.payload?.studentId?studentRegistry.find(s=>s.id===record.payload.studentId):byName.length===1?byName[0]:null;
            const open=card.querySelector('.record-open-btn'),remove=card.querySelector('.record-delete-btn');if(!open||!remove)return;
            if(!card.querySelector('.record-student')){
                open.innerHTML=`<span class="record-kind">${esc(TAB_LABELS[record.currentTab]||'수강료 기록')}</span><strong class="record-student">${esc(record.studentName||'학생명')}</strong><span class="record-month">${esc(record.targetYear||'—')}년 ${esc(record.targetMonth||'—')}월</span><b class="record-amount">${esc(record.totalText||'0원')}</b><span class="record-open-label">저장본 열기 <span aria-hidden="true">↗</span></span><time class="record-saved-at">${esc(formatSavedAt(record.savedAt))}</time>`;
                remove.title=`${record.studentName||'학생'} 저장 기록 삭제`;card.replaceChildren(open,remove);
            }
            // Registry and records arrive independently; enrich an existing card once school data arrives.
            if(!student?.school)return;
            let label=card.querySelector('.school-label');if(!label){label=document.createElement('span');label.className='school-label';card.querySelector('.record-month').before(label);}label.textContent=student.school;
            const url=student.schoolLogoUrl||student.schoolEmblemUrl||knownSchools[student.school];
            if(url&&/^https:\/\//.test(url)){
                let img=card.querySelector('.school-watermark');if(!img){img=document.createElement('img');img.className='school-watermark';img.alt='';img.setAttribute('aria-hidden','true');img.onerror=()=>img.hidden=true;card.prepend(img);}
                if(img.getAttribute('src')!==url){img.hidden=false;img.src=url;}
            }else card.querySelector('.school-watermark')?.remove();
        });
    }
    let headerAuth={state:'loading',actor:null};
    function syncHeaderAuth(){
        if(!el('headerStaffName'))return;
        const name=headerAuth.state==='ready'?headerAuth.actor?.name:'';
        el('headerStaffName').textContent=name||'';el('headerStaffName').hidden=!name;
        const status=el('staffAuthStatus'),routine=!['error','denied'].includes(headerAuth.state)&&/^(로그인 기능을 준비하고 있습니다\.|로그인하고 있습니다\.|직원 계정으로 로그인해 주세요\.|.+님으로 로그인했습니다\.|직원 권한을 확인하고 있습니다\.)$/.test(status.textContent.trim());
        status.hidden=!status.textContent.trim()||routine;
    }
    const oldAuthState=handleStaffAuthState;
    handleStaffAuthState=async function(state){headerAuth=state;const pending=oldAuthState(state);syncHeaderAuth();await pending;syncHeaderAuth();};
    const oldRecordStatus=setServerRecordStatus;
    setServerRecordStatus=function(message,tone='info'){oldRecordStatus(message,tone);el('serverRecordStatus').hidden=tone==='info'&&/직원 로그인|로그인 후|로그인해 주세요/.test(message);};

})();
