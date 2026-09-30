// Temporary lessons are local calculation drafts. This module has no service calls.
(() => {
    const el=id=>document.getElementById(id), esc=escapeHtml, weekdays=['일','월','화','수','목','금','토'];
    let courses=[],context='',focusReturn=null,focusDay=1;
    const dialog=document.createElement('dialog');dialog.id='temporaryLessonDialog';dialog.setAttribute('aria-labelledby','temporaryTitle');
    dialog.innerHTML=`<form id="temporaryLessonForm" novalidate>
      <div class="temporary-heading"><div><h2 id="temporaryTitle">임시 수업 추가</h2><p id="temporaryContext"></p></div><button type="button" class="temporary-close" aria-label="임시 수업 창 닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <p class="temporary-intro">현재 계산에만 반영됩니다. 인트라넷에 등록되지는 않습니다.</p>
      <label class="temporary-field">수업 선택<select id="temporaryCourse"></select></label>
      <div class="temporary-custom"><label class="temporary-field">과목·수업 유형<input id="temporaryName" maxlength="120" placeholder="예: 수학-개별정규"></label><label class="temporary-field">강사<input id="temporaryTeacher" maxlength="60" placeholder="강사 이름"></label></div>
      <div class="temporary-terms"><label class="temporary-field">시작 시각<input id="temporaryStart" type="time" value="16:00"></label><label class="temporary-field">수업 시간<input id="temporaryHours" type="number" min="0.25" max="24" step="0.25" value="2"><span>시간</span></label><label class="temporary-field">회당 수강료<input id="temporaryAmount" type="number" min="0" max="10000000000" step="any" placeholder="금액 입력"><span>원</span></label></div>
      <fieldset class="temporary-scope"><legend>언제 진행하나요?</legend><div class="temporary-scope-options"><label><input type="radio" name="temporaryScope" value="date" checked> 이 날짜만</label><label><input type="radio" name="temporaryScope" value="repeat"> 요일 반복</label></div></fieldset>
      <div id="temporaryRepeat" hidden><div class="temporary-range"><label class="temporary-field">시작일<input id="temporaryFrom" type="date"></label><label class="temporary-field">종료일<input id="temporaryUntil" type="date"></label></div><div id="temporaryWeekdays" role="group" aria-label="임시 수업 반복 요일">${weekdays.map((d,i)=>`<button type="button" data-weekday="${i}" aria-label="${d}요일 임시 수업" aria-pressed="false">${d}</button>`).join('')}</div></div>
      <div class="temporary-preview"><strong id="temporaryPreview"></strong><p id="temporaryDates"></p><p id="temporarySkipped"></p></div><p id="temporaryError" role="alert" hidden></p>
      <div class="temporary-footer"><button type="button" id="temporaryCancel">취소</button><button type="submit" id="temporaryConfirm" class="primary">수업 추가</button></div>
    </form>`;
    document.body.append(dialog);
    const scope=()=>dialog.querySelector('[name="temporaryScope"]:checked').value;
    const identity=()=>matchedStudent()?.id+'|'+progressMonth();
    function close(){dialog.close();focusReturn?.isConnected&&focusReturn.focus();}
    dialog.querySelector('.temporary-close').onclick=close;el('temporaryCancel').onclick=close;
    dialog.addEventListener('cancel',()=>{queueMicrotask(()=>focusReturn?.isConnected&&focusReturn.focus());});
    function terms(){
        const custom=el('temporaryCourse').value==='custom',base=custom?{}:courses[Number(el('temporaryCourse').value)]||{};
        const className=custom?el('temporaryName').value.trim():base.className,teacher=custom?el('temporaryTeacher').value.trim():base.teacher;
        const start=el('temporaryStart').value,hours=Number(el('temporaryHours').value),minutes=Math.round(hours*60),amount=Number(el('temporaryAmount').value);
        if(!className||!teacher)throw Error('과목과 강사 이름을 입력해 주세요.');
        if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!Number.isFinite(hours)||hours<=0||hours>24||hours*60!==minutes)throw Error('시작 시각과 수업 시간을 확인해 주세요.');
        const endMinutes=Number(start.slice(0,2))*60+Number(start.slice(3))+minutes;
        if(endMinutes>=1440)throw Error('수업 종료 시각은 같은 날 자정 이전이어야 합니다.');
        if(el('temporaryAmount').value===''||!Number.isFinite(amount)||amount<0||amount>1e10)throw Error('회당 수강료를 입력해 주세요. 무료 수업은 0원으로 입력하세요.');
        return {className,teacher,start,end:String(Math.floor(endMinutes/60)).padStart(2,'0')+':'+String(endMinutes%60).padStart(2,'0'),minutes,amount,kind:'regular'};
    }
    function requestedDates(){
        const from=el('temporaryFrom').value,until=scope()==='date'?from:el('temporaryUntil').value;
        if(!ProgressCore.validDate(from)||!ProgressCore.validDate(until)||from.slice(0,7)!==progressMonth()||until.slice(0,7)!==progressMonth()||from>until)throw Error('날짜는 선택한 월 안에서 시작일 순서로 지정해 주세요.');
        const selected=[...el('temporaryWeekdays').querySelectorAll('[aria-pressed="true"]')].map(b=>Number(b.dataset.weekday));
        if(scope()==='repeat'&&!selected.length)throw Error('반복할 요일을 선택해 주세요.');
        const dates=[];for(let d=1;d<=ProgressCore.daysInMonth(progressMonth());d++){
            const date=progressMonth()+'-'+String(d).padStart(2,'0');
            if(date>=from&&date<=until&&(scope()==='date'||selected.includes(ProgressCore.dayOfWeek(date))))dates.push(date);
        }
        if(!dates.length)throw Error('선택한 기간에 해당 요일이 없습니다. 기간이나 요일을 바꿔 주세요.');
        return dates;
    }
    function plan(){
        if(currentTab!=='progress'||context!==identity()||!progressBound()||progressLoading)throw Error('학생·월의 수업을 먼저 불러온 뒤 추가해 주세요.');
        const row=terms(),requested=requestedDates(),existing=progressResult(),all=[...existing.actual,...existing.predicted];
        const dates=requested.filter(date=>!all.some(r=>ProgressCore.overlaps(r,{...row,date})));
        return {row,dates,skipped:requested.filter(date=>!dates.includes(date))};
    }
    function preview(){
        el('temporaryRepeat').hidden=scope()!=='repeat';
        const custom=el('temporaryCourse').value==='custom';dialog.querySelector('.temporary-custom').hidden=!custom;
        el('temporaryError').hidden=true;el('temporarySkipped').textContent='';el('temporaryDates').textContent='';
        try{
            const {row,dates,skipped}=plan();
            el('temporaryPreview').textContent=`${dates.length}회 · ${Number((dates.length*row.minutes/60).toFixed(2))}시간 · +${(dates.length*row.amount).toLocaleString('ko-KR')}원`;
            el('temporaryDates').textContent=dates.length?`${dates.map(d=>Number(d.slice(8))+'일').join(' · ')} / ${row.start}–${row.end}`:'추가할 수업이 없습니다.';
            el('temporarySkipped').textContent=skipped.length?`같은 수업의 시간이 겹치는 ${skipped.map(d=>Number(d.slice(8))+'일').join(', ')}은 제외합니다.`:'';
            el('temporaryConfirm').disabled=!dates.length;el('temporaryConfirm').textContent=dates.length>1?`${dates.length}회 수업 추가`:'수업 추가';
        }catch(error){el('temporaryPreview').textContent='수업 조건을 선택해 주세요.';el('temporaryError').textContent=error.message;el('temporaryError').hidden=false;el('temporaryConfirm').disabled=true;}
    }
    function selectCourse(){
        const row=courses[Number(el('temporaryCourse').value)];
        if(row){el('temporaryStart').value=row.start||'16:00';el('temporaryHours').value=(row.minutes||row.forecastMinutes||120)/60;el('temporaryAmount').value=row.amount??row.forecastAmount??'';}
        else{el('temporaryAmount').value='';el('temporaryName').value='';el('temporaryTeacher').value='';}
        preview();
    }
    el('temporaryCourse').onchange=selectCourse;
    dialog.addEventListener('input',preview);dialog.addEventListener('change',preview);
    el('temporaryWeekdays').querySelectorAll('button').forEach(b=>b.onclick=()=>{b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));preview();});
    el('temporaryLessonForm').onsubmit=e=>{
        e.preventDefault();
        try{
            const {row,dates}=plan();if(!dates.length)return;
            const additions=dates.map(date=>({...row,date,id:'local:'+crypto.randomUUID()}));
            const next=ProgressCore.validateTemporary([...(progressState.temporary||[]),...additions],progressMonth());
            FeeCalendar.remember();progressState.temporary=next;progressStatus=`임시 수업 ${dates.length}회를 현재 계산에 추가했습니다.`;close();renderProgress();FeeCalendar.commit();queueMicrotask(()=>el('workCalendar').querySelector(`[data-day="${focusDay}"] .calendar-add-lesson`)?.focus());
        }catch(error){el('temporaryError').textContent=error.message;el('temporaryError').hidden=false;}
    };
    function open(day){
        if(dialog.open)return;
        context=identity();focusDay=day;FeeCalendar.focusDay(day);focusReturn=el('workCalendar').querySelector(`[data-day="${day}"] .calendar-add-lesson`)||document.activeElement;
        const date=progressMonth()+'-'+String(day).padStart(2,'0');
        const distinct=new Map();
        for(const row of progressBound()?progressState.snapshot.lessons:[]){
            if(!['regular','late','absenceMakeup'].includes(row.kind)||!row.minutes)continue;
            distinct.set(JSON.stringify([ProgressCore.courseKey(row),row.minutes,row.amount,row.start,row.end]),row);
        }
        courses=[...distinct.values()].sort((a,b)=>a.className.localeCompare(b.className,'ko'));
        el('temporaryCourse').innerHTML=courses.map((r,i)=>`<option value="${i}">${esc(FeeCalendarCore.info(r.className,r.teacher).subject)} · ${esc(r.teacher)} · ${r.minutes/60}시간 · ${esc(r.start)} · ${r.amount===null?'금액 확인 필요':r.amount.toLocaleString('ko-KR')+'원'}</option>`).join('')+'<option value="custom">새 수업 직접 입력</option>';
        el('temporaryContext').textContent=`${getCurrentStudentName()||'학생 선택'} · ${Number(date.slice(5,7))}월 ${day}일 (${weekdays[ProgressCore.dayOfWeek(date)]})`;
        dialog.querySelector('[name="temporaryScope"][value="date"]').checked=true;
        for(const id of ['temporaryFrom','temporaryUntil']){el(id).min=progressMonth()+'-01';el(id).max=ProgressCore.monthEnd(progressMonth());}
        el('temporaryFrom').value=date;el('temporaryUntil').value=ProgressCore.monthEnd(progressMonth());
        el('temporaryWeekdays').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.weekday)===ProgressCore.dayOfWeek(date))));
        selectCourse();dialog.showModal();el('temporaryCourse').focus();
    }
    window.TemporaryLessons={open};
})();
