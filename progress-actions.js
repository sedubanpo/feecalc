// Calculator-only calendar actions. Source snapshots are never mutated.
(() => {
 const el=id=>document.getElementById(id), money=n=>Number(n).toLocaleString('ko-KR')+'원';
 const rows=()=>{const r=progressResult();return [...r.actual,...r.predicted];};
 function guard(){if(currentTab!=='progress'||!progressBound()||progressLoading)throw Error('학생·월의 수업 조회를 먼저 확인하세요.');}
 function remove(state,r){
  if(r.temporary)state.temporary=(state.temporary||[]).filter(x=>x.id!==r.id);
  else if(!r.predicted)state.removedActual=[...new Set([...(state.removedActual||[]),r.id])];
  else if(state.mode==='auto'||state.planned?.some(x=>x.id===r.id))state.excluded=[...new Set([...(state.excluded||[]),r.id])];
  else state.manual=(state.manual||[]).filter(x=>x.templateId+'@'+x.date!==r.id);
  state.edits=(state.edits||[]).filter(x=>x.id!==r.id);
 }
 function commit(state){FeeCalendar.remember();progressState=state;renderProgress();FeeCalendar.commit();}
 function deleteDay(day){guard();const list=rows().filter(r=>Number(r.date.slice(-2))===day);if(!list.length)return;
  const next=structuredClone(progressState);list.forEach(r=>remove(next,r));commit(next);
 }
 function move(id,day){guard();const all=rows(),r=all.find(x=>x.id===id);if(!r)throw Error('수업을 다시 선택하세요.');
  if(!Number.isInteger(day)||day<1||day>FeeCalendarCore.daysInMonth(progressMonth()))throw Error('이달의 날짜를 선택하세요.');
  const date=progressMonth()+'-'+String(day).padStart(2,'0');if(date===r.date)return;
  if(r.amount===null||r.minutes===null)throw Error('금액·시간을 확인한 후 이동하세요.');
  if(all.some(x=>x.id!==id&&ProgressCore.overlaps(x,{...r,date})))throw Error('이동할 날짜에 같은 수업의 시간이 겹칩니다.');
  const next=structuredClone(progressState);
  if(r.temporary)next.temporary=next.temporary.map(x=>x.id===id?{...x,date}:x);
  else {const patch={id,movedDate:date,minutes:r.minutes,amount:r.amount,start:r.start,end:r.end,kind:r.kind};ProgressCore.validateEdits([patch]);next.edits=[...(next.edits||[]).filter(x=>x.id!==id),patch];}
  commit(next);
 }
 function repeat(id){guard();const all=rows(),r=all.find(x=>x.id===id);if(!r)throw Error('수업을 다시 선택하세요.');
  if(r.amount===null||!r.minutes||!r.start||!r.end)throw Error('수업의 시간·금액을 먼저 확인하세요.');
  const added=[];for(let d=Number(r.date.slice(-2))+7;d<=FeeCalendarCore.daysInMonth(progressMonth());d+=7){
   const row={...r,id:'local:'+crypto.randomUUID(),date:progressMonth()+'-'+String(d).padStart(2,'0')};
   if(!all.some(x=>ProgressCore.overlaps(x,row)))added.push(row);
  }
  if(!added.length)throw Error('월말까지 추가할 수업이 없습니다. 겹치는 수업은 유지됩니다.');
  if(!confirm(`같은 요일로 월말까지 ${added.length}회 · ${money(added.reduce((n,r)=>n+r.amount,0))}를 추가할까요? 기존 수업과 겹치는 날짜는 제외합니다.`))return;
  const next=structuredClone(progressState);next.temporary=ProgressCore.validateTemporary([...(next.temporary||[]),...added],progressMonth());commit(next);
 }
 function run(fn){try{fn();}catch(e){alert(e.message);}}
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>';
 function button(label,fn){const b=document.createElement('button');b.type='button';b.className='calendar-delete';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon;b.onclick=e=>{e.stopPropagation();run(fn);};return b;}
 let drag=null;
 function decorate(){
  if(currentTab!=='progress')return;
  const all=FeeCalendar.activeLessons();
  document.querySelectorAll('#workCalendar .calendar-day[data-day]').forEach(cell=>{
   const day=Number(cell.dataset.day),daily=all.filter(r=>r.day===day);
   if(daily.length)cell.querySelector('.calendar-day-head').append(button(`${day}일 수업 전체 삭제`,()=>deleteDay(day)));
   cell.ondragover=e=>{if(drag){e.preventDefault();cell.classList.add('drop-target');}};
   cell.ondragleave=()=>cell.classList.remove('drop-target');
   cell.ondrop=e=>{e.preventDefault();cell.classList.remove('drop-target');const item=drag;drag=null;if(item&&item.context===progressState.snapshot.studentId+'|'+progressMonth())run(()=>move(item.id,day));};
   cell.querySelectorAll('.calendar-event').forEach(b=>{
    const r=all.find(x=>x.id===b.dataset.lessonId);if(!r)return;
    const wrap=document.createElement('div');wrap.className='calendar-event-wrap';b.before(wrap);wrap.append(b,button(`${day}일 ${r.subject} ${r.teacher} 수업 삭제`,()=>FeeCalendar.changeLesson(r.id,null)));
    b.draggable=true;b.ondragstart=e=>{drag={id:r.id,context:progressState.snapshot.studentId+'|'+progressMonth()};e.dataTransfer.setData('text/plain',r.id);e.dataTransfer.effectAllowed='move';};b.ondragend=()=>{drag=null;document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));};
   });
  });
 }
 function pending(){
  el('pendingLessons')?.remove();if(currentTab!=='progress')return;
  const all=rows(),list=all.filter(r=>r.amount===null||r.minutes===null);if(!list.length)return;
  const panel=document.createElement('section');panel.id='pendingLessons';const h=document.createElement('h3');h.textContent=`확인 필요 ${list.length}건`;panel.append(h);
  for(const r of list){const box=document.createElement('div');box.className='day-lesson';const title=document.createElement('strong');title.textContent=`${r.date.slice(5)} · ${r.className}`;box.append(title);
   const history=[...(progressState.basis||[]).flatMap(s=>s.lessons||[]),...(progressState.snapshot?.lessons||[])].filter(x=>x.id!==r.id&&x.date<r.date&&ProgressCore.courseKey(x)===ProgressCore.courseKey(r)&&x.minutes===r.minutes&&x.amount>0&&['regular','late'].includes(x.kind)).sort((a,b)=>b.date.localeCompare(a.date));
   const hint=document.createElement('p');hint.textContent=history.length?`추천 ${money(history[0].amount)}/회 · ${history[0].date} 동일 수업·시수 기준 (확인 후 입력)`:'동일 수업·시수의 과거 금액이 없어 직접 확인이 필요합니다.';box.append(hint);
   const edit=document.createElement('button');edit.type='button';edit.textContent='금액·시간 확인';edit.onclick=()=>CalendarLessonEditor.open(r.id);box.append(edit);panel.append(box);
  }el('dayDetail').append(panel);
 }
 function explanation(){
  el('noticeBalanceExplanation')?.remove();if(currentTab!=='progress')return;
  const adjustments=collectAdjustmentItems();if(!adjustments.length)return;
  const box=document.createElement('section');box.id='noticeBalanceExplanation';
  const title=document.createElement('strong');title.textContent='현재까지 정산';box.append(title);
  const line=(label,amount)=>{const p=document.createElement('p');p.append(document.createTextNode(label));if(amount!==undefined){const value=document.createElement('span');value.className=amount<0?'negative':amount>0?'positive':'neutral';value.textContent=(amount<0?'−':amount>0?'+':'')+money(Math.abs(amount));p.append(value);}box.append(p);};
  const result=progressResult(),groups=new Map();for(const r of result.actual){const name=[r.subject||r.className?.split('-')[0],r.teacher].filter(Boolean).join(' · ')||r.className;const key=JSON.stringify([name,r.amount]);const g=groups.get(key)||{name,amount:r.amount,count:0};g.count++;groups.set(key,g);}
  const details=document.createElement('div');details.className='balance-lesson-grid';
  for(const g of groups.values()){line(`${g.name} ${g.count}회 · 회당 ${g.amount===null?'금액 확인 필요':money(g.amount)}`);details.append(box.lastElementChild);}
  box.append(details);
  const unknown=result.actual.some(r=>r.amount===null||r.minutes===null);
  const billed=getPercentDiscountInfo(result.actualAmount).discountedBase;
  if(unknown)line('진행한 수업료: 확인 필요');else line(`진행한 수업료${billed!==result.actualAmount?' (할인 반영)':''}`,billed);
  for(const a of adjustments)line(a.label|| (a.amount<0?'이월·차감':'초과·추가'),a.amount);
  if(unknown)line('수업 금액·시간 확인 후 잔액을 계산합니다.');
  else {const balance=billed+adjustments.reduce((n,a)=>n+a.amount,0);line(balance<0?'남은 이월금':balance>0?'현재 초과금':'현재 잔액',balance);box.lastElementChild.classList.add('balance-result');}
  const note=document.createElement('small');note.textContent='앞으로의 수업료는 제외한 금액입니다.';box.append(note);
  el('dispTotal')?.parentElement.after(box);
 }
 window.ProgressActions={deleteDay,move,repeat,decorate,pending,explanation,run};
 FeeCalendar.refresh();
})();
