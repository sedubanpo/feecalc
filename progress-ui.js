// 진행형 is a read-only projection of Intranet lessons plus local forecasts.
let progressState = {snapshot:null,mode:'auto',cutoff:'',endDate:'',excluded:[],manual:[]};
let progressRequest = 0, progressLoading = false, progressStatus = '';
let progressRefreshPending = false, progressVerified = false;
let progressContext = '';
const progressEl = id => document.getElementById(id);
const progressMoney = value => value === null ? '확인 필요' : value.toLocaleString('ko-KR') + '원';
const progressMonth = () => `${progressEl('targetYear').value}-${String(progressEl('targetMonth').value).padStart(2,'0')}`;
const progressToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function progressBound() { return !!progressState.snapshot && progressState.snapshot.studentId === matchedStudent()?.id && progressState.snapshot.month === progressMonth(); }
function progressResult() { return ProgressCore.calculate(progressBound() ? progressState : null); }
function progressReady() { return progressBound() && progressVerified && !progressLoading && progressResult().actual.length > 0 && progressResult().pending === 0; }

const progressButton = document.createElement('button');
progressButton.id = 'btn-progress'; progressButton.type = 'button'; progressButton.textContent = '진행형';
progressButton.onclick = () => switchTab('progress');
progressEl('btn-ai').before(progressButton);
const progressPanel = document.createElement('section');
progressPanel.id = 'tab-progress'; progressPanel.className = 'hidden progress-panel';
progressPanel.setAttribute('aria-label','진행형 계산');
progressPanel.innerHTML = `
 <h3>인트라넷 수업으로 계산</h3>
 <p class="ui-help">선택한 학생·월의 저장된 수업을 읽어옵니다. 인트라넷 원본은 변경하지 않습니다.</p>
 <button type="button" id="progressFetch" class="ui-button primary" onclick="loadProgressLessons()">인트라넷 수업 불러오기</button>
 <p id="progressStatus" role="status" class="ui-help"></p>
 <div id="progressControls" hidden>
  <fieldset class="progress-method"><legend>남은 수업 계산 방식</legend>
   <label><input type="radio" name="progressMode" value="auto" checked onchange="setProgressMode(this.value)"> 남은 요일 자동 계산</label>
   <label><input type="radio" name="progressMode" value="manual" onchange="setProgressMode(this.value)"> 날짜 직접 추가</label>
  </fieldset>
  <div class="progress-range">
   <label class="progress-field">예상 시작 기준일<input id="progressCutoff" type="date" onchange="setProgressCutoff(this.value)"></label>
   <label class="progress-field">예상 종료일<input id="progressEnd" type="date" onchange="setProgressEnd(this.value)"></label>
  </div>
  <p id="progressCoverage" class="ui-help"></p>
  <p class="ui-help">기준일 다음 날부터 종료일까지 예상합니다. 종료일은 예상 수업에만 적용하며 실제 입력 수업은 모두 유지합니다. 같은 과목·강사·날짜의 실제 수업과 중복 계산하지 않습니다.</p>
  <div id="progressManual" hidden>
   <label class="progress-field">추가할 기준 수업<select id="progressTemplate"></select></label>
   <p class="ui-help">아래 날짜를 누르면 기준 수업이 추가됩니다. 다시 누르면 취소됩니다.</p>
   <div id="progressDates" class="progress-dates" aria-label="예상 수업 추가 날짜"></div>
  </div>
  <div id="progressSummary" class="progress-summary" aria-live="polite"></div>
  <div class="progress-actions"><h4>예상 수업</h4><button type="button" id="progressRestore" class="ui-button" onclick="restoreProgressForecast()">예상 제외 복구</button></div>
  <div id="progressPredicted"></div>
  <details><summary id="progressActualTitle">입력 수업 확인</summary><div id="progressActual"></div></details>
 </div>`;
progressEl('tab-auto').before(progressPanel);
progressEl('progressTemplate').onchange = renderProgressDates;

async function loadProgressLessons(options={}) {
    // Settle student/month invalidation before assigning this request's token.
    renderProgress();
    const student = matchedStudent(), month = progressMonth();
    if (!student || !isServerConfigured()) { progressStatus='직원 로그인 후 등록 학생을 선택해 주세요.'; renderProgress(); return; }
    if (!ProgressCore.validMonth(month)) { progressStatus='조회할 연도와 월을 확인해 주세요.'; renderProgress(); return; }
    if (progressLoading) return;
    if (!options.preserveForecast && progressBound() && (progressState.manual.length || progressState.excluded.length) && !confirm('수업을 다시 불러오면 예상 날짜의 추가·제외가 초기화됩니다. 계속할까요?')) return;
    const previous=progressBound()?progressState:null;
    const request=++progressRequest, epoch=staffAuthEpoch;
    progressLoading=true; progressStatus='인트라넷 수업을 불러오고 있습니다.'; renderProgress();
    try {
        const {data,error}=await getSupabaseClient().rpc('feecalc_progress',{p_student_id:student.id,p_month:month});
        if (request!==progressRequest || epoch!==staffAuthEpoch || matchedStudent()?.id!==student.id || progressMonth()!==month) return;
        if (error) throw Error(error.message || '수업 조회에 실패했습니다.');
        const snapshot=ProgressCore.validateSnapshot(data);
        if (snapshot.studentId!==student.id || snapshot.month!==month) throw Error('학생·월 정보가 맞지 않습니다. 다시 조회해 주세요.');
        const latest=ProgressCore.defaultCutoff(snapshot,progressToday());
        const cutoff=options.preserveForecast && previous?.cutoff>latest ? previous.cutoff : latest;
        const savedEnd=previous?.endDate || ProgressCore.monthEnd(snapshot.month);
        progressState={snapshot,mode:progressState.mode,cutoff,endDate:savedEnd<cutoff?cutoff:savedEnd,excluded:options.preserveForecast?(previous?.excluded || []):[],manual:options.preserveForecast?(previous?.manual || []):[]};
        progressVerified=true;
        progressStatus=snapshot.lessons.length ? `최신 수업 ${snapshot.lessons.length}건을 확인했습니다. 마지막 수업일 ${snapshot.lessons.map(r=>r.date).sort().at(-1)}.` : '선택한 월에 저장된 수업이 없습니다. 인트라넷 입력 후 다시 불러와 주세요.';
    } catch(error) {
        if (request===progressRequest && epoch===staffAuthEpoch) progressStatus=`${error.message} 다시 불러오기로 재시도하세요.${progressBound()?' 기존에 불러온 데이터는 유지됩니다.':''}`;
    } finally { if(request===progressRequest){progressLoading=false;renderProgress();} }
}
function setProgressMode(mode) { progressState.mode=mode==='manual'?'manual':'auto'; renderProgress(); }
function setProgressCutoff(value) {
    if (!ProgressCore.validDate(value) || value.slice(0,7)!==progressMonth()) { progressStatus='기준일은 선택한 월 안에서 지정해 주세요.'; renderProgress(); return; }
    progressState.cutoff=value;if(progressState.endDate<value)progressState.endDate=value;renderProgress();
}
function setProgressEnd(value) {
    if(!ProgressCore.validDate(value) || value.slice(0,7)!==progressMonth() || value<progressState.cutoff){progressStatus='종료일은 같은 달의 기준일 이후로 선택해 주세요.';renderProgress();return;}
    progressState.endDate=value;renderProgress();
}
function toggleProgressDate(date) {
    const templateId=progressEl('progressTemplate').value;
    const index=progressState.manual.findIndex(r=>r.templateId===templateId && r.date===date);
    if(index>=0) progressState.manual.splice(index,1); else {
        const result=progressResult(),template=result.templates.find(r=>r.id===templateId);
        if(template && result.predicted.some(r=>r.date===date && r.start<template.end && template.start<r.end && ProgressCore.courseKey(r)===ProgressCore.courseKey(template))){progressStatus='시간이 겹치는 같은 과목의 예상 수업이 이미 있습니다. 기존 예상분을 제외한 뒤 추가하세요.';renderProgress();return;}
        progressState.manual.push({templateId,date});
    }
    renderProgress();
}
function removeProgressPrediction(id) {
    if(progressState.mode==='auto') progressState.excluded=[...new Set([...progressState.excluded,id])];
    else progressState.manual=progressState.manual.filter(r=>r.templateId+'@'+r.date!==id);
    renderProgress();
}
function restoreProgressForecast() { progressState.excluded=[]; renderProgress(); }
function renderProgressDates() {
    const host=progressEl('progressDates'); host.replaceChildren();
    if(!progressBound()) return;
    const template=progressResult().templates.find(r=>r.id===progressEl('progressTemplate').value);
    for(let day=1;day<=ProgressCore.daysInMonth(progressMonth());day++) {
        const date=progressMonth()+'-'+String(day).padStart(2,'0'), button=document.createElement('button');
        const occupied=template && progressState.snapshot.lessons.some(r=>r.date===date && ProgressCore.courseKey(r)===ProgressCore.courseKey(template));
        const selected=!!template && progressState.manual.some(r=>r.date===date&&r.templateId===template.id);
        button.type='button';button.className='ui-button';button.textContent=`${day}일`;
        button.setAttribute('aria-label',`${date} 예상 수업${occupied?' · 입력 수업 있음':''}`);button.setAttribute('aria-pressed',String(selected));
        button.disabled=!template || date<=progressState.cutoff || date>progressState.endDate || !!occupied;
        button.onclick=()=>toggleProgressDate(date);host.append(button);
    }
}
function progressLessonList(host,rows,editable) {
    host.replaceChildren();
    if(!rows.length){const p=document.createElement('p');p.className='ui-help';p.textContent=editable?'예상 수업이 없습니다. 계산 방식과 기준일을 확인하거나 날짜를 추가하세요.':'입력 수업이 없습니다.';host.append(p);return;}
    const fragment=document.createDocumentFragment();
    rows.forEach(row=>{
        const line=document.createElement('div');line.className='progress-lesson';
        const text=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span');
        title.textContent=`${row.date.slice(5)} · ${row.className} · ${row.teacher}`;
        detail.textContent=`${row.start}–${row.end} · ${row.minutes===null?'시간 확인 필요':row.minutes/60+'시간'} · ${progressMoney(row.amount)}${!editable?' · '+progressKind(row.kind):' · 예상'}`;
        text.append(title,detail);line.append(text);
        if(editable){const button=document.createElement('button');button.type='button';button.className='ui-button';button.textContent='제외';button.setAttribute('aria-label',`${row.date} ${row.className} 예상 제외`);button.onclick=()=>removeProgressPrediction(row.id);line.append(button);}
        fragment.append(line);
    });host.append(fragment);
}
function progressKind(kind){return ({regular:'출석',late:'지각',cancel:'당일취소',absence:'결석예고',absenceMakeup:'대체수업',cancelMakeup:'보충',lateMakeup:'보충',free:'프리'})[kind] || '확인 필요';}
function renderProgress() {
    if(currentTab!=='progress' || !progressEl('progressStatus')) return;
    const context=(matchedStudent()?.id || '')+'|'+progressMonth();
    if(progressContext!==context){progressContext=context;progressRequest++;progressLoading=false;progressStatus='';}
    const bound=progressBound(), result=progressResult();
    if(bound && progressRefreshPending && !progressLoading && isServerConfigured()){
        progressRefreshPending=false;
        const snapshot=progressState.snapshot;
        queueMicrotask(()=>{if(progressState.snapshot!==snapshot)return;if(currentTab==='progress' && progressBound())loadProgressLessons({preserveForecast:true});else progressRefreshPending=true;});
    }
    progressEl('progressFetch').disabled=progressLoading || !matchedStudent() || !isServerConfigured();
    progressEl('progressFetch').setAttribute('aria-busy',String(progressLoading));
    progressEl('progressControls').hidden=!bound;
    progressEl('progressStatus').textContent=progressStatus || (bound?'저장된 조회본입니다. 최신 수업을 확인하기 전에는 저장·이미지 내보내기를 할 수 없습니다.':'등록 학생과 월을 확인한 뒤 인트라넷 수업을 불러오세요.');
    if(bound){
        const cutoff=progressEl('progressCutoff');cutoff.value=progressState.cutoff;cutoff.min=progressMonth()+'-01';cutoff.max=progressMonth()+'-'+ProgressCore.daysInMonth(progressMonth());
        const end=progressEl('progressEnd');end.value=progressState.endDate || ProgressCore.monthEnd(progressMonth());end.min=progressState.cutoff;end.max=ProgressCore.monthEnd(progressMonth());
        progressEl('progressCoverage').textContent=`조회본 마지막 수업일 ${result.actual.map(r=>r.date).sort().at(-1)||'없음'} · ${result.actual.length}건${progressVerified?' · 최신 조회 완료':' · 최신 확인 필요'}`;
        document.querySelectorAll('input[name="progressMode"]').forEach(el=>{el.checked=el.value===progressState.mode;});
        progressEl('progressManual').hidden=progressState.mode!=='manual';progressEl('progressRestore').hidden=progressState.mode!=='auto';
        progressEl('progressRestore').disabled=!progressState.excluded.length;
        const select=progressEl('progressTemplate'),previous=select.value;select.replaceChildren();
        result.templates.forEach(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=`${r.className} · ${r.teacher} · ${r.minutes===null?'시간 확인 필요':r.minutes/60+'시간'} · ${r.date.slice(5)} ${r.start}`;select.append(option);});
        if(result.templates.some(r=>r.id===previous))select.value=previous;
        if(!result.templates.length){const option=document.createElement('option');option.textContent='반복할 출석 수업이 없습니다.';select.append(option);}
        renderProgressDates();
        progressEl('progressSummary').textContent=`입력 ${result.actual.length}회 · ${(result.actual.reduce((s,r)=>s+(r.minutes||0),0)/60).toLocaleString()}시간 · ${progressMoney(result.actualAmount)} / 예상 ${result.predicted.length}회 · ${progressMoney(result.predictedAmount)}${result.pending?` · ${result.pending}건 금액·시간 확인 필요 (미확인 금액은 합계 미포함)` : ''}`;
        progressEl('progressActualTitle').textContent=`입력 수업 ${result.actual.length}건 확인 · ${String(progressState.snapshot.fetchedAt||'').slice(0,10)} 조회본`;
        progressLessonList(progressEl('progressPredicted'),result.predicted,true);progressLessonList(progressEl('progressActual'),result.actual,false);
    } else {
        for(const id of ['progressActual','progressPredicted','progressSummary','progressTemplate','progressDates'])progressEl(id).replaceChildren();
    }
    renderProgressReceipt(result,bound);
    updateServerSaveModeUi();
}
function groupProgressReceipt(rows) {
    const subjects=new Map();
    for(const row of rows){
        const info=parseSubjectInfo(row.className),subject=info.mainName || '기타',teacher=(row.teacher || info.teacher || '강사 미지정').replace(/T$/i,'');
        if(!subjects.has(subject))subjects.set(subject,new Map());
        const teachers=subjects.get(subject);
        if(!teachers.has(teacher))teachers.set(teacher,{teacher,total:0,pending:false,variants:new Map()});
        const group=teachers.get(teacher),type=info.type || '수업',kind=row.predicted?'regular':row.kind;
        const key=JSON.stringify([type,row.minutes,row.amount,kind]);
        if(!group.variants.has(key))group.variants.set(key,{type,minutes:row.minutes,amount:row.amount,kind,count:0,predicted:0,dates:[]});
        const variant=group.variants.get(key);variant.count++;variant.predicted+=row.predicted?1:0;variant.dates.push(Number(row.date.slice(8)));
        group.total+=row.amount || 0;group.pending ||= row.amount===null;
    }
    return [...subjects].sort(([a],[b])=>a.localeCompare(b,'ko')).map(([subject,teachers])=>({subject,teachers:[...teachers.values()].sort((a,b)=>a.teacher.localeCompare(b.teacher,'ko'))}));
}
function renderProgressReceipt(result,bound) {
    restoreDefaultPriceSummaryArea();
    progressEl('receiptSubTitle').textContent=`진행형 수강료 예상 안내서${bound?' · '+progressState.cutoff+' 기준 / '+(progressState.endDate || ProgressCore.monthEnd(progressMonth()))+'까지 예상':''}`;progressEl('labelTotal').textContent='예상 납부액';
    progressEl('dispTotal').parentElement.classList.add('progress-total');
    progressEl('dispName').textContent=getCurrentStudentName()||'학생명';progressEl('dispDate').textContent=`${progressEl('targetYear').value}년 ${progressEl('targetMonth').value}월분`;
    const tbody=progressEl('receiptBody');tbody.replaceChildren();
    const groups=groupProgressReceipt([...result.actual,...result.predicted]);
    for(const subject of groups){
        const heading=document.createElement('tr'),cell=document.createElement('th');cell.colSpan=2;cell.scope='rowgroup';cell.textContent=subject.subject;heading.className='progress-subject-heading';heading.append(cell);tbody.append(heading);
        for(const group of subject.teachers){
            const tr=document.createElement('tr'),name=document.createElement('td'),amount=document.createElement('td'),strong=document.createElement('strong'),details=document.createElement('div');
            strong.textContent=group.teacher+'T';details.className='progress-variants';
            for(const variant of group.variants.values()){
                const detail=document.createElement('span');
                if(variant.kind==='absence') {detail.className='progress-absence-detail';detail.textContent=`${variant.type} · ${variant.dates.join(', ')}일 결석예고 · 0원`;}
                else detail.textContent=`${variant.type} ${variant.minutes===null?'시간 확인':variant.minutes/60+'h'} × ${variant.count}회${variant.predicted?' · 예상 '+variant.predicted:''}${variant.kind!=='regular'?' · '+progressKind(variant.kind):''}${variant.amount===null?' · 금액 확인':''}`;
                detail.title=`회당 ${progressMoney(variant.amount)}`;
                details.append(detail);
            }
            name.append(strong,details);amount.textContent=progressMoney(group.pending?null:group.total);tr.append(name,amount);tbody.append(tr);
        }
    }
    if(!groups.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=2;td.textContent=bound?'입력된 수업이 없습니다.':'인트라넷 수업을 불러오면 예상 내역이 표시됩니다.';tr.append(td);tbody.append(tr);}
    tbody.classList.add('progress-receipt');
    const subtotal=result.actualAmount+result.predictedAmount,discount=getPercentDiscountInfo(subtotal);
    progressEl('dispSubtotal').textContent=progressMoney(subtotal);updateDiscountSummaryRow(discount);renderAdjustmentSummary();
    const total=discount.discountedBase+(Number(progressEl('adjustment').value)||0);
    progressEl('dispTotal').textContent=!bound?'조회 필요':!progressVerified?'최신 확인 필요':result.pending?'확인 필요':progressMoney(total);
    progressEl('captureArea').classList.add('progress-document');
    renderCommonReceiptCalendar([...result.actual,...result.predicted].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).map(row=>({day:Number(row.date.slice(8)),name:parseSubjectInfo(row.className).mainName,rawName:row.className,durationHours:(row.minutes||0)/60,isPredicted:row.predicted,isAbsent:!row.predicted && row.kind==='absence'})));
    let legend=progressEl('progressCalendarLegend');
    if(!legend){legend=document.createElement('p');legend.id='progressCalendarLegend';progressEl('receiptMiniCalGrid').after(legend);}
    legend.textContent=`진행 수업 ${progressMoney(result.actualAmount)} · 예상 ${progressMoney(result.predictedAmount)} | 점선: 예상 · 회색: 결석예고(0원)`;
    legend.hidden=false;
    progressEl('generatedTextArea').value=!bound?'인트라넷 수업을 먼저 불러와 주세요.':!progressVerified?'저장된 조회본의 최신 수업을 확인 중입니다. 조회 실패 시 다시 불러와 주세요.':result.pending?'금액·시간이 미확인인 수업이 있습니다. 인트라넷에서 확인한 뒤 다시 불러와 주세요.':buildProgressMessage(result,total,discount);
}
function buildProgressMessage(result,total,discount) {
    const adjustments=collectAdjustmentItems();
    return ['안녕하세요. 에스에듀 반포관입니다.','',
        `${getCurrentStudentName()} 학생 ${progressEl('targetMonth').value}월 수강료 예상 내역입니다.`,
        `입력된 수업 ${result.actual.length}회: ${progressMoney(result.actualAmount)}`,
        `추가 예상 수업 ${result.predicted.length}회: ${progressMoney(result.predictedAmount)}`,
        `할인: ${progressMoney(discount.amount)}`,
        ...buildAdjustmentMessageLines(adjustments),
        ...(adjustments.length>1?[`이월·초과금 조정 합계: ${progressMoney(getAdjustmentTotal(adjustments))}`]:[]),
        `월 예상 납부액: ${progressMoney(total)}`,'',
        `예상 종료일: ${progressState.endDate || '월말'} (실제 입력 수업은 모두 포함)`,
        `${progressState.cutoff} 기준 ${progressState.mode==='manual'?'입력 수업에 선택한 날짜의 수업을 추가했으며':'최근 요일별 입력 수업을 바탕으로 작성했으며'}, 예상 수업은 실제 일정에 따라 달라질 수 있습니다.`,
        '감사합니다.'].join('\n');
}
const progressOriginalSwitch=switchTab;
switchTab=function(tab){
    progressEl('captureArea').classList.toggle('progress-document',tab==='progress');
    if(progressEl('progressCalendarLegend'))progressEl('progressCalendarLegend').hidden=tab!=='progress';
    progressOriginalSwitch(tab);
    progressEl('calendarGrid').parentElement.classList.toggle('hidden',tab==='progress');
    progressEl('receiptBody').classList.toggle('progress-receipt',tab==='progress');
    document.querySelectorAll('.progress-total').forEach(el=>el.classList.toggle('progress-total',tab==='progress'));
    if(tab==='progress'){
        progressEl('smartPasteSection').classList.add('hidden');progressEl('voucherGuideBox').classList.add('hidden');progressEl('messageControlArea').classList.add('hidden');
        progressEl('tabHelpBubble').textContent='진행형: 인트라넷 입력 수업 + 남은 요일 자동 계산 또는 날짜 직접 추가';renderProgress();
    }
    updateServerSaveModeUi();
};
const progressOriginalCollect=collectCalculatorState;
collectCalculatorState=function(){const value=progressOriginalCollect();value.progress=progressBound()?JSON.parse(JSON.stringify(progressState)):null;return value;};
const progressOriginalApply=applyCalculatorState;
applyCalculatorState=function(data,...args){
    let restored={snapshot:null,mode:'auto',cutoff:'',endDate:'',excluded:[],manual:[]};
    if(data?.progress?.snapshot){
        const snapshot=ProgressCore.validateSnapshot(data.progress.snapshot);
        if(snapshot.studentId!==data.studentId || snapshot.month!==`${data.targetYear}-${String(data.targetMonth).padStart(2,'0')}`)throw Error('진행형 저장본의 학생·월이 일치하지 않습니다.');
        if(!ProgressCore.validDate(data.progress.cutoff)||data.progress.cutoff.slice(0,7)!==snapshot.month)throw Error('진행형 기준일을 확인해 주세요.');
        const endDate=data.progress.endDate || ProgressCore.monthEnd(snapshot.month);
        if(!ProgressCore.validDate(endDate)||endDate.slice(0,7)!==snapshot.month||endDate<data.progress.cutoff)throw Error('진행형 예상 종료일을 확인해 주세요.');
        restored={snapshot,mode:data.progress.mode==='manual'?'manual':'auto',cutoff:data.progress.cutoff,endDate,excluded:Array.isArray(data.progress.excluded)?data.progress.excluded.filter(v=>typeof v==='string').slice(0,5000):[],manual:Array.isArray(data.progress.manual)?data.progress.manual.filter(v=>v&&typeof v.templateId==='string'&&ProgressCore.validDate(v.date)).slice(0,5000):[]};
    }
    progressRequest++;progressLoading=false;progressState=restored;progressVerified=false;progressRefreshPending=!!restored.snapshot;progressStatus='저장본의 최신 인트라넷 수업을 확인합니다.';
    const result=progressOriginalApply(data,...args);renderProgress();return result;
};
const progressOriginalClear=clearMonthlyState;
clearMonthlyState=function(...args){progressState={snapshot:null,mode:'auto',cutoff:'',endDate:'',excluded:[],manual:[]};progressRequest++;progressLoading=false;progressVerified=false;progressRefreshPending=false;progressStatus='';return progressOriginalClear(...args);};
const progressOriginalMatch=syncStudentMatch;
syncStudentMatch=function(...args){const result=progressOriginalMatch(...args);renderProgress();return result;};
const progressOriginalAuth=handleStaffAuthState;
handleStaffAuthState=async function(event){progressRequest++;progressLoading=false;if(!event.user || (previousStaffUid && event.user.uid!==previousStaffUid)){progressState={snapshot:null,mode:'auto',cutoff:'',endDate:'',excluded:[],manual:[]};progressVerified=false;progressRefreshPending=false;}return progressOriginalAuth(event);};
const progressOriginalSaveUi=updateServerSaveModeUi;
updateServerSaveModeUi=function(){progressOriginalSaveUi();if(currentTab==='progress'&&!progressReady())document.querySelectorAll('[onclick^="saveServerRecord("]').forEach(b=>{b.disabled=true;b.title='수업을 조회하고 미확인 금액·시간을 해결한 뒤 저장하세요.';});};
for(const name of ['saveServerRecord','downloadImage','copyGeneratedText']){
    const original=window[name];window[name]=function(...args){if(currentTab==='progress'&&!progressReady()){progressStatus='수업을 조회하고 미확인 금액·시간을 해결한 뒤 저장하거나 복사해 주세요.';renderProgress();return;}return original(...args);};
}
