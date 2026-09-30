// Draft-only calendar editing and explicit next-month planning. No service writes.
(() => {
    const el=id=>document.getElementById(id),esc=escapeHtml,days=['일','월','화','수','목','금','토'];
    const month=()=>`${el('targetYear').value}-${String(el('targetMonth').value).padStart(2,'0')}`;
    const context=()=>`${matchedStudent()?.id||getCurrentStudentName()}|${month()}|${currentTab}`;
    const money=n=>Number(n).toLocaleString('ko-KR')+'원';
    const closeIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    const edit=document.createElement('dialog');edit.id='calendarLessonDialog';edit.className='draft-dialog';edit.setAttribute('aria-labelledby','lessonEditTitle');
    edit.innerHTML=`<form id="lessonEditForm" novalidate><div class="temporary-heading"><div><h2 id="lessonEditTitle">수업 수정</h2><p id="lessonEditContext"></p></div><button type="button" class="temporary-close" aria-label="수업 수정 창 닫기">${closeIcon}</button></div>
      <p class="temporary-intro" id="lessonEditIntro"></p><div class="lesson-edit-course"><strong id="lessonEditCourse"></strong><span id="lessonEditTeacher"></span></div>
      <div class="lesson-edit-fields"><label class="temporary-field">수업 시간<input id="lessonEditHours" type="number" min="0" max="24" step="0.25"><span>시간</span></label><label class="temporary-field"><span id="lessonRateLabel" class="field-title">회당 단가</span><input id="lessonEditRate" type="number" min="0" max="10000000000" step="any"><span>원</span></label><label class="temporary-field">시작 시각<input id="lessonEditStart" type="time"></label><label class="temporary-field">종료 시각<input id="lessonEditEnd" type="time"></label></div>
      <div class="temporary-preview"><strong id="lessonEditPreview"></strong><p>선택한 날짜의 이 회차만 변경합니다. 실행 취소로 복구할 수 있습니다.</p></div><p id="lessonEditError" class="draft-error" role="alert"></p>
      <div class="temporary-footer"><button type="button" id="lessonEditDelete" class="danger">수업 삭제</button><button type="button" id="lessonEditCancel">취소</button><button type="submit" id="lessonEditSave" class="primary">수정 적용</button></div></form>`;
    document.body.append(edit);
    let editing=null,editContext='',editDay=1;
    function openEdit(id){
        const r=FeeCalendar.activeLessons().find(r=>r.id===id);if(!r)return;
        editing=r;editContext=context();editDay=r.day;
        el('lessonEditContext').textContent=`${getCurrentStudentName()} · ${month()}-${String(r.day).padStart(2,'0')} (${days[FeeCalendarCore.weekday(month(),r.day)]})`;
        el('lessonEditIntro').textContent=currentTab==='progress'?'현재 계산에서만 수정·삭제합니다. 인트라넷 원본은 유지됩니다.':'과목의 반복 조건은 유지하고, 선택한 회차만 수정·삭제합니다.';
        el('lessonEditCourse').textContent=r.subject+' · '+r.type;el('lessonEditTeacher').textContent=r.teacher||'강사 미기재';
        el('lessonRateLabel').textContent=currentTab==='progress'?'이 회차 금액':r.rateMode==='perHour'?'시간당 단가':'회당 단가';
        el('lessonEditHours').value=r.hours;el('lessonEditRate').value=currentTab==='progress'?r.amount??'':r.rate??'';
        el('lessonEditStart').value=r.start||'';el('lessonEditEnd').value=r.end||'';previewEdit();
        edit.showModal();el('lessonEditHours').focus();
    }
    function terms(){
        if(editContext!==context()||!FeeCalendar.activeLessons().some(r=>r.id===editing?.id))throw Error('학생·월 또는 수업이 변경되었습니다. 창을 닫고 다시 선택하세요.');
        const hours=Number(el('lessonEditHours').value),rate=Number(el('lessonEditRate').value),start=el('lessonEditStart').value,end=el('lessonEditEnd').value;
        if(el('lessonEditHours').value===''||!Number.isFinite(hours)||hours<0||hours>24||(!['출석','결석예고','당일취소','보충','프리'].some(s=>editing.status.startsWith(s))&&hours===0)||!Number.isInteger(hours*60))throw Error('수업 시간을 확인해 주세요.');
        if(el('lessonEditRate').value===''||!Number.isFinite(rate)||rate<0||rate>1e10)throw Error('단가를 입력해 주세요. 무료 수업은 0원을 입력하세요.');
        if((start||end)&&(!start||!end||end<=start))throw Error('종료 시각은 시작 시각 이후로 선택하세요.');
        return {hours,rate,start,end};
    }
    function previewEdit(){try{const t=terms();el('lessonEditPreview').textContent='변경 후 '+money(Math.round(t.rate*(currentTab!=='progress'&&editing.rateMode==='perHour'?t.hours:1)));el('lessonEditError').textContent='';el('lessonEditSave').disabled=false;}catch(e){el('lessonEditError').textContent=e.message;el('lessonEditPreview').textContent='시간·금액 확인';el('lessonEditSave').disabled=true;}}
    edit.addEventListener('input',previewEdit);
    el('lessonEditForm').onsubmit=e=>{e.preventDefault();try{FeeCalendar.changeLesson(editing.id,terms());edit.close();}catch(e){el('lessonEditError').textContent=e.message;}};
    el('lessonEditDelete').onclick=()=>{try{if(editContext!==context())throw Error('학생·월이 변경되었습니다. 다시 선택하세요.');FeeCalendar.changeLesson(editing.id,null);edit.close();}catch(e){el('lessonEditError').textContent=e.message;}};
    for(const button of edit.querySelectorAll('.temporary-close,#lessonEditCancel'))button.onclick=()=>edit.close();
    edit.addEventListener('close',()=>document.querySelector(`#workCalendar [data-day="${editDay}"] .calendar-event,#workCalendar [data-day="${editDay}"] .calendar-day-head button`)?.focus());
    window.CalendarLessonEditor={open:openEdit};

    // Replace the old settings-style overlay with the shared draft dialog.
    el('nextMonthModal').remove();
    const next=document.createElement('dialog');next.id='nextMonthModal';next.className='draft-dialog';next.setAttribute('aria-labelledby','nextMonthTitle');
    next.innerHTML=`<div class="temporary-heading"><div><h2 id="nextMonthTitle">다음 달 계산</h2><p id="nextMonthContext"></p></div><button type="button" class="temporary-close" aria-label="다음 달 계산 창 닫기">${closeIcon}</button></div>
      <p class="temporary-intro" id="nextMonthIntro"></p><section id="nextMonthPatterns" hidden><div class="next-pattern-heading"><strong>이어받을 반복 수업</strong><span>요일고정으로 계산</span></div><div id="nextMonthRows"></div><div class="temporary-preview"><strong id="nextMonthTotal"></strong><p id="nextMonthSkipped"></p></div></section>
      <div class="next-month-options"><label id="nextSelectedOption"><input id="nextMonthClearSelectedDates" type="checkbox" checked><span><strong>선택형 날짜 비우기</strong><small>반명과 단가는 유지합니다.</small></span></label><label id="nextManualOption"><input id="nextMonthClearManualCounts" type="checkbox" checked><span><strong>변동형 횟수 비우기</strong><small>시간과 단가는 유지합니다.</small></span></label><label><input id="nextMonthClearAdjustments" type="checkbox" checked><span><strong>이월·초과금과 메모 비우기</strong><small>새 달의 조정 내역을 다시 입력합니다.</small></span></label><label><input id="nextMonthKeepSiblingRows" type="checkbox" checked><span><strong>형제/자매 안내 유지</strong><small>함께 안내할 학생과 금액을 유지합니다.</small></span></label></div>
      <p id="nextMonthError" class="draft-error" role="alert"></p><div class="temporary-footer"><button type="button" id="nextMonthCancel">취소</button><button type="button" id="nextMonthConfirm" class="primary">다음 달로 전환</button></div>`;
    document.body.append(next);
    let nextContext='',plan=null;
    const selectedGroups=()=>plan?.groups.filter((_,i)=>el('nextMonthRows').querySelector(`[data-group="${i}"]`)?.checked)||[];
    function previewNext(){const groups=selectedGroups();el('nextMonthTotal').textContent=`${groups.reduce((n,g)=>n+g.count,0)}회 · 수강료 소계 ${money(groups.reduce((n,g)=>n+g.total,0))}`;el('nextMonthConfirm').disabled=currentTab==='progress'&&!groups.length;}
    window.openNextMonthWizard=function(){
        nextContext=context();const d=new Date(Number(el('targetYear').value),Number(el('targetMonth').value),1);const target=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const progress=currentTab==='progress';plan=null;el('nextMonthError').textContent='';
        el('nextMonthContext').textContent=`${getCurrentStudentName()||'학생 선택'} · ${month()} → ${target}`;el('nextMonthPatterns').hidden=!progress;el('nextSelectedOption').hidden=progress;el('nextManualOption').hidden=progress;
        el('nextMonthIntro').textContent=progress?'실제 수업에서 3주 이상 반복된 요일과 단가로 다음 달 초안을 만듭니다. 다음 달 시간표와 변경 사항을 확인해 주세요.':'반 구성과 단가는 유지하고, 새 달에 사용할 날짜와 조정 내역을 정리합니다.';
        el('nextMonthRows').replaceChildren();el('nextMonthConfirm').disabled=false;
        if(progress){
            if(!progressBound()||!progressVerified||progressLoading){el('nextMonthError').textContent='선택한 학생·월의 최신 인트라넷 수업을 먼저 불러오세요.';el('nextMonthConfirm').disabled=true;}
            else{
                const snapshot={...progressState.snapshot,lessons:progressResult().actual.map(({predicted,edited,...r})=>r)};plan=FeeCalendarCore.nextMonthPlan(snapshot,target);
                el('nextMonthRows').innerHTML=plan.groups.map((g,i)=>`<label class="next-pattern"><input type="checkbox" data-group="${i}" checked><span><strong>${esc(g.subject)} · ${esc(g.teacher)}</strong><small>${esc(g.type)} · ${g.hours}시간 · ${g.days.map(d=>days[d]).join('·')}요일</small><small>3주 이상 반복 · ${money(g.amount)}/회</small></span><b>${g.count}회<small>+${money(g.total)}</small></b></label>`).join('');
                el('nextMonthSkipped').textContent=`반영하지 않은 기록 ${plan.skipped}건 · 보충·일회성·3주 미만·단가 미확인 수업은 달력에서 확인 후 추가하세요.`;
                if(!plan.groups.length)el('nextMonthError').textContent='같은 요일·시간·단가로 3주 이상 진행된 수업이 아직 없습니다. 현재 계산은 유지됩니다.';
                previewNext();
            }
        }
        next.showModal();el('nextMonthCancel').focus();
    };
    window.closeNextMonthWizard=()=>next.close();
    const originalPrepare=prepareNextMonthCalculation;
    prepareNextMonthCalculation=function(options={}){
        if(currentTab!=='progress')return originalPrepare(options);
        if(serverSavePending)return originalPrepare(options);
        if(!progressBound()||!progressVerified||progressLoading){setServerRecordStatus('최신 인트라넷 수업을 먼저 불러오세요.','warning');return;}
        const d=new Date(Number(el('targetYear').value),Number(el('targetMonth').value),1),targetMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const source={...progressState.snapshot,lessons:progressResult().actual.map(({predicted,edited,...r})=>r)},available=FeeCalendarCore.nextMonthPlan(source,targetMonth).groups;
        const groups=options.progressGroups?available.filter(g=>options.progressGroups.includes(g.id)):available;
        if(!groups.length){setServerRecordStatus('3주 이상 반복된 수업이 없어 현재 계산을 유지합니다.','warning');return;}
        originalPrepare(options);FeeCalendar.seedNextMonth(groups,source);setServerRecordStatus(`${targetMonth} 요일고정 초안을 만들었습니다. ${groups.length}개 수업의 일정과 금액을 확인하세요.`,'success');
    };
    window.applyNextMonthWizard=function(){
        if(nextContext!==context()){el('nextMonthError').textContent='학생·월이 변경되었습니다. 창을 닫고 다시 시작하세요.';return;}
        if(serverSavePending){el('nextMonthError').textContent='저장이 끝난 후 다시 시도해 주세요.';return;}
        const options={clearSelectedDates:el('nextMonthClearSelectedDates').checked,clearManualCounts:el('nextMonthClearManualCounts').checked,clearAdjustments:el('nextMonthClearAdjustments').checked,keepSiblingRows:el('nextMonthKeepSiblingRows').checked};
        if(currentTab==='progress'){if(!selectedGroups().length)return;options.progressGroups=selectedGroups().map(g=>g.id);}
        prepareNextMonthCalculation(options);next.close();
    };
    next.querySelector('.temporary-close').onclick=closeNextMonthWizard;el('nextMonthCancel').onclick=closeNextMonthWizard;el('nextMonthConfirm').onclick=applyNextMonthWizard;el('nextMonthRows').onchange=previewNext;
})();
