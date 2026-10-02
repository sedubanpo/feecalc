// Read-only transformations of lesson records and local draft schedules.
(function(root){
    const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    const daysInMonth = month => new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
    const weekday = (month,day) => new Date(`${month}-${String(day).padStart(2,'0')}T00:00:00Z`).getUTCDay();
    function info(name,teacher='') {
        const text=String(name||'').trim(),parts=text.split('-'),subject=parts[0]||'미분류';
        const tail=parts.slice(1).filter(p=>!/^\d+(\.\d+)?h$/i.test(p));
        const paren=/^(.*?)\((.*?)\)$/.exec(tail[0]||'');
        return {subject,teacher:String(teacher||paren?.[2]||tail[1]||'').replace(/T$/i,'').trim(),type:(paren?.[1]||tail[0]||'수업').replace(/^개별$/,'개별정규')};
    }
    function expand(rows,mode,month,globalExcluded=[]) {
        const out=[],last=daysInMonth(month),excluded=new Set(globalExcluded);
        rows.forEach((row,index)=>{
            const dates=mode==='auto'?Array.from({length:last},(_,i)=>i+1).filter(d=>(row.days||[]).includes(weekday(month,d)) && !(row.excludedDates||[]).includes(d)):[...(row.dates||[])];
            const schedule=row.schedule||{};
            const selected=[...new Set([...dates,...(schedule.extraDates||[])])].filter(d=>Number.isInteger(d)&&d>=1&&d<=last&&!excluded.has(d)&&!(schedule.removed||[]).includes(d));
            const rowStart=out.length;
            for(const day of selected){
                const override=schedule.overrides?.[day]||{},hours=override.hours??row.hours,rate=override.rate??row.rate;
                const known=override.rate!==undefined?finite(override.rate):row.rateKnown!==false;
                const amount=known&&finite(rate)&&finite(hours)?Math.round(Number(rate)*(row.rateMode==='perHour'?Number(hours):1)):null;
                out.push({...info(row.name),row:index,id:`${mode}:${index}:${day}`,day,hours:Number(hours)||0,rate:known?Number(rate):null,rateMode:row.rateMode||'perClass',amount,rawName:row.name,status:'예정',start:override.start||'',end:override.end||''});
            }
            // Old snapshots retain their aggregate-rounded total until this condition is edited.
            if(row.legacyAggregate && selected.length && !Object.keys(schedule.overrides||{}).length){
                const lessons=out.slice(rowStart),raw=Number(row.rate)*(row.rateMode==='perHour'?Number(row.hours):1);
                if(lessons.every(r=>r.amount!==null))lessons.at(-1).amount+=Math.round(raw*selected.length)-lessons.reduce((n,r)=>n+r.amount,0);
            }
            for(const extra of schedule.additional||[]){
                if(!Number.isInteger(extra.day)||extra.day<1||extra.day>last||excluded.has(extra.day))continue;
                const hours=extra.hours??row.hours,rate=extra.rate??row.rate;
                const amount=finite(rate)&&finite(hours)?Math.round(rate*(row.rateMode==='perHour'?hours:1)):null;
                out.push({...info(row.name),...extra,row:index,id:`${mode}:${index}:extra:${extra.id}`,hours,rate,amount,rateMode:row.rateMode,rawName:row.name,status:'예정'});
            }
        });
        return out.sort((a,b)=>a.day-b.day||(a.start||'').localeCompare(b.start||'')||a.subject.localeCompare(b.subject,'ko'));
    }
    function groups(lessons) {
        const map=new Map();
        for(const r of lessons){
            const key=JSON.stringify([r.subject,r.teacher]);
            if(!map.has(key))map.set(key,{subject:r.subject,teacher:r.teacher,total:0,pending:false,variants:new Map()});
            const g=map.get(key);g.total+=r.amount||0;g.pending ||= r.amount===null;
            const vkey=JSON.stringify([r.type,r.hours,r.rate,r.rateMode,r.amount,r.status]);
            if(!g.variants.has(vkey))g.variants.set(vkey,{...r,count:0,totalHours:0});
            const v=g.variants.get(vkey);v.count++;v.totalHours+=r.hours||0;
        }
        return [...map.values()].sort((a,b)=>a.subject.localeCompare(b.subject,'ko')||a.teacher.localeCompare(b.teacher,'ko'));
    }
    function hoursBySubject(lessons){const totals={};for(const r of lessons)totals[r.subject]=(totals[r.subject]||0)+(r.hours||0);return totals;}
    function compareHours(current,previous){
        return [...new Set([...Object.keys(current),...Object.keys(previous||{})])].map(subject=>{
            const now=current[subject]||0,prior=previous?.[subject];
            const known=finite(prior)&&Number(prior)>=0;
            return {subject,current:now,previous:known?Number(prior):null,percent:known&&Number(prior)>0?(now-Number(prior))/Number(prior)*100:null,label:!known?'비교 자료 없음':Number(prior)===0?(now>0?'신규':'변동 없음'):null};
        });
    }
    function normalizeSnapshot(snapshot){
        return snapshot.lessons.map(r=>({...info(r.className,r.teacher),id:r.id,day:Number(r.date.slice(-2)),date:r.date,hours:(r.minutes||0)/60,amount:r.amount,rate:null,rawName:r.className,start:r.start,end:r.end,status:({regular:'출석',late:'지각',cancel:'당일취소',absence:'결석예고',absenceMakeup:'결석보강',cancelMakeup:'보충',lateMakeup:'보충',free:'프리'})[r.kind]||'확인 필요',kind:r.kind,note:r.note||r.memo||r.reference||'',source:r}));
    }
    // Patterns are candidates only. Staff must confirm each against change notices.
    function candidates(snapshot){
        const map=new Map(),excluded=[];
        for(const r of normalizeSnapshot(snapshot)){
            if(r.kind!=='regular'||/오늘만|보충|일회|변경|특강|대체/.test(`${r.note} ${r.type}`)||r.hours<=0){excluded.push(r);continue;}
            const key=JSON.stringify([r.subject,r.teacher,r.type,weekday(snapshot.month,r.day),r.hours,r.amount,r.start,r.end]);
            if(!map.has(key))map.set(key,{id:key,...r,weekday:weekday(snapshot.month,r.day),sourceIds:[],sourceDates:[],reasons:[]});
            const c=map.get(key);c.sourceIds.push(r.id);c.sourceDates.push(r.date);
        }
        const rows=[...map.values()];
        for(const c of rows){
            if(c.sourceDates.length<2)c.reasons.push('1회 기록 · 일회성 여부 확인');
            if(c.amount===null)c.reasons.push('단가 미확인');
            if(rows.some(other=>other!==c&&other.subject===c.subject&&other.teacher===c.teacher&&other.weekday===c.weekday))c.reasons.push('같은 요일에 다른 시간·단가 조건');
            c.reasons.push('다음 달 시간표·변경 안내 대조');
        }
        return {rows,excluded};
    }
    // Present one billable condition across weekdays. Keep genuinely separate
    // same-day sessions apart, even when their subject, duration and rate match.
    function groupCandidates(rows){
        const buckets=new Map();
        for(const row of rows){
            const key=JSON.stringify([row.subject,row.teacher,row.type,row.hours,row.amount]);
            if(!buckets.has(key))buckets.set(key,[]);
            buckets.get(key).push(row);
        }
        const groups=[];
        for(const [key,bucket] of buckets){
            const seenDates=new Set();
            const overlaps=bucket.some(row=>row.sourceDates.some(date=>seenDates.has(date)||(seenDates.add(date),false)));
            for(const members of overlaps?bucket.map(row=>[row]):[bucket]){
                const dates=[...new Set(members.flatMap(row=>row.sourceDates))].sort();
                const weekdays=[...new Set(members.map(row=>row.weekday))].sort((a,b)=>a-b).map(day=>{
                    const count=dates.filter(date=>weekday(date.slice(0,7),Number(date.slice(-2)))===day).length;
                    const conflict=rows.some(row=>!members.includes(row)&&row.subject===members[0].subject&&row.teacher===members[0].teacher&&row.weekday===day);
                    return {day,count,suggested:count>=2&&!conflict};
                });
                groups.push({id:JSON.stringify([key,...members.map(row=>row.id).sort()]),subject:members[0].subject,teacher:members[0].teacher,type:members[0].type,hours:members[0].hours,amount:members[0].amount,separateSession:overlaps,sourceIds:[...new Set(members.flatMap(row=>row.sourceIds))],sourceDates:dates,weekdays,times:[...new Set(members.map(row=>[row.start,row.end].filter(Boolean).join('–')).filter(Boolean))],reasons:[...new Set(members.flatMap(row=>row.reasons))]});
            }
        }
        return groups;
    }
    // Three distinct weekly occurrences with known terms can seed a next-month draft.
    function nextMonthPlan(snapshot,targetMonth){
        const result=candidates(snapshot);
        // Count repeated weekdays before splitting by clock time. A shifted
        // start time does not change a lesson's duration or tuition condition.
        const stableGroups=groupCandidates(result.rows).flatMap(group=>{
            if(!finite(group.amount))return [];
            const days=group.weekdays.filter(({day})=>{
                const dates=group.sourceDates.filter(date=>weekday(snapshot.month,Number(date.slice(-2)))===day).sort();
                return dates.length>=3 && (Date.parse(dates.at(-1))-Date.parse(dates[0]))/86400000>=14;
            }).map(w=>w.day);
            const members=result.rows.filter(r=>days.includes(r.weekday)&&group.sourceIds.some(id=>r.sourceIds.includes(id)));
            return groupCandidates(members);
        });
        const groups=stableGroups.map(group=>{
            const members=result.rows.filter(r=>group.sourceIds.some(id=>r.sourceIds.includes(id)))
                .sort((a,b)=>[...b.sourceDates].sort().at(-1).localeCompare([...a.sourceDates].sort().at(-1)));
            const days=group.weekdays.map(w=>w.day),dates=Array.from({length:daysInMonth(targetMonth)},(_,i)=>i+1).filter(d=>days.includes(weekday(targetMonth,d)));
            const overrides={};
            for(const day of dates){const r=members.find(r=>r.weekday===weekday(targetMonth,day));if(/^([01]\d|2[0-3]):[0-5]\d$/.test(r?.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r?.end)&&r.end>r.start)overrides[day]={start:r.start,end:r.end};}
            return {...group,days,dates,count:dates.length,total:dates.length*Math.round(group.amount),schedule:{overrides}};
        });
        return {groups,skipped:normalizeSnapshot(snapshot).filter(r=>!groups.some(g=>g.sourceIds.includes(r.id))).length};
    }
    function validateSchedule(value,month){
        const s=value||{},last=daysInMonth(month),valid=d=>Number.isInteger(d)&&d>=1&&d<=last;
        for(const key of ['extraDates','removed'])if(s[key]!==undefined&&(!Array.isArray(s[key])||s[key].some(d=>!valid(d))))throw Error('달력 추가·제외 날짜를 확인해 주세요.');
        for(const [day,v] of Object.entries(s.overrides||{})){
            if(!valid(Number(day))||!v||['hours','rate'].some(k=>v[k]!==undefined&&(!finite(v[k])||Number(v[k])<0)))throw Error('회차별 시수·단가를 확인해 주세요.');
        }
        if(s.additional!==undefined&&(!Array.isArray(s.additional)||s.additional.some(v=>!valid(v.day)||typeof v.id!=='string'||!finite(v.hours)||v.hours<0||!finite(v.rate)||v.rate<0)))throw Error('추가 회차를 확인해 주세요.');
        const clock=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
        for(const v of [...Object.values(s.overrides||{}),...(s.additional||[])])if((v.start||v.end)&&(!clock(v.start)||!clock(v.end)||v.end<=v.start))throw Error('회차별 시작·종료 시각을 확인해 주세요.');
        return JSON.parse(JSON.stringify(s));
    }
    const api={nextMonthPlan,info,expand,groups,hoursBySubject,compareHours,candidates,groupCandidates,normalizeSnapshot,daysInMonth,weekday,validateSchedule};
    if(typeof module!=='undefined')module.exports=api;else root.FeeCalendarCore=api;
})(typeof window==='undefined'?{}:window);
