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
    function validateSchedule(value,month){
        const s=value||{},last=daysInMonth(month),valid=d=>Number.isInteger(d)&&d>=1&&d<=last;
        for(const key of ['extraDates','removed'])if(s[key]!==undefined&&(!Array.isArray(s[key])||s[key].some(d=>!valid(d))))throw Error('달력 추가·제외 날짜를 확인해 주세요.');
        for(const [day,v] of Object.entries(s.overrides||{})){
            if(!valid(Number(day))||!v||['hours','rate'].some(k=>v[k]!==undefined&&(!finite(v[k])||Number(v[k])<0)))throw Error('회차별 시수·단가를 확인해 주세요.');
        }
        if(s.additional!==undefined&&(!Array.isArray(s.additional)||s.additional.some(v=>!valid(v.day)||typeof v.id!=='string'||!finite(v.hours)||v.hours<0||!finite(v.rate)||v.rate<0)))throw Error('추가 회차를 확인해 주세요.');
        return JSON.parse(JSON.stringify(s));
    }
    const api={info,expand,groups,hoursBySubject,compareHours,candidates,normalizeSnapshot,daysInMonth,weekday,validateSchedule};
    if(typeof module!=='undefined')module.exports=api;else root.FeeCalendarCore=api;
})(typeof window==='undefined'?{}:window);
