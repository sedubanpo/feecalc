// Pure calendar calculation. No database writes or implicit local clock.
(function(root) {
    const validMonth = value => /^20\d{2}-(0[1-9]|1[0-2])$/.test(value || '');
    const validDate = value => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
    const dayOfWeek = date => new Date(date + 'T00:00:00Z').getUTCDay();
    const daysInMonth = month => new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
    const courseKey = row => {
        const teacher = String(row.teacher || '').trim().replace(/\s+/g,'').replace(/T$/i,'');
        let course = String(row.className || '').replace(/\s+/g,'').replace(/개별정규/g,'개별').replace(/-?\d+(?:\.\d+)?h$/i,'');
        if (teacher) course = course.split(teacher + 'T').join('').split(teacher).join('');
        return JSON.stringify([course.replace(/[()]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,''),teacher]);
    };
    function validateSnapshot(value) {
        if (!value || typeof value.studentId !== 'string' || !value.studentId || !validMonth(value.month) || !Array.isArray(value.lessons) || value.lessons.length > 1000) throw Error('진행형 수업 데이터 형식을 확인해 주세요.');
        const ids = new Set();
        for (const row of value.lessons) {
            if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || !validDate(row.date) || row.date.slice(0,7) !== value.month || typeof row.className !== 'string' || typeof row.teacher !== 'string' || typeof row.start !== 'string' || typeof row.end !== 'string' || (row.minutes !== null && (!Number.isInteger(row.minutes) || row.minutes < 0 || row.minutes > 1440)) || (row.amount !== null && (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount < 0 || row.amount > 1e10))) throw Error('진행형 수업 날짜·시간·금액을 확인해 주세요.');
            ids.add(row.id);
            if (row.forecastMinutes !== undefined && row.forecastMinutes !== null && (!Number.isInteger(row.forecastMinutes) || row.forecastMinutes <= 0 || row.forecastMinutes > 1440)) throw Error('예상 수업 시간을 확인해 주세요.');
            if (row.forecastAmount !== undefined && row.forecastAmount !== null && (typeof row.forecastAmount !== 'number' || !Number.isFinite(row.forecastAmount) || row.forecastAmount < 0 || row.forecastAmount > 1e10)) throw Error('예상 수업 금액을 확인해 주세요.');
        }
        return JSON.parse(JSON.stringify(value));
    }
    function templateRows(snapshot, cutoff) {
        return snapshot.lessons.filter(r=>r.date<=cutoff).flatMap(row=>{
            if (['regular','late','absenceMakeup'].includes(row.kind) && row.minutes) return [row];
            if (row.kind !== 'absence') return [];
            const clock = value => {const m=/^(\d{1,2}):(\d{2})$/.exec(value);return m && +m[1]<24 && +m[2]<60 ? +m[1]*60 + +m[2] : null;};
            const start=clock(row.start),end=clock(row.end);
            const minutes=row.forecastMinutes ?? (start!==null && end!==null && end>start ? end-start : null);
            const prior=snapshot.lessons.filter(r=>r.date<row.date && dayOfWeek(r.date)===dayOfWeek(row.date) && courseKey(r)===courseKey(row) && ['regular','late','absenceMakeup'].includes(r.kind) && r.minutes===minutes).sort((a,b)=>b.date.localeCompare(a.date))[0];
            return [{...row,minutes,amount:row.forecastAmount ?? prior?.amount ?? null}];
        });
    }
    function templates(snapshot, cutoff) {
        const latest = new Map();
        for (const row of templateRows(snapshot,cutoff)) {
            const key = courseKey(row) + '|' + dayOfWeek(row.date), old = latest.get(key);
            if (!old || row.date > old.date) latest.set(key,{date:row.date,rows:[row]});
            else if (old.date === row.date) old.rows.push(row);
        }
        return [...latest.values()].flatMap(v=>v.rows).sort((a,b)=>a.className.localeCompare(b.className,'ko') || a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    }
    function defaultCutoff(snapshot, today) {
        const dates = snapshot.lessons.filter(r=>r.date <= today).map(r=>r.date).sort();
        return dates.at(-1) || snapshot.month + '-01';
    }
    function manualTemplates(snapshot,cutoff) {
        const distinct=new Map();
        for(const row of templateRows(snapshot,cutoff).sort((a,b)=>a.date.localeCompare(b.date))) {
            distinct.set(JSON.stringify([courseKey(row),row.minutes,row.amount,row.start,row.end]),row);
        }
        return [...distinct.values()];
    }
    function calculate(state) {
        const snapshot = state?.snapshot;
        if (!snapshot) return {actual:[],predicted:[],templates:[],actualAmount:0,predictedAmount:0,pending:0};
        const cutoff = validDate(state.cutoff) && state.cutoff.slice(0,7) === snapshot.month ? state.cutoff : snapshot.month + '-01';
        const choices = state.mode === 'manual' ? manualTemplates(snapshot,cutoff) : templates(snapshot,cutoff), excluded = new Set(state.excluded || []);
        const actual = snapshot.lessons.map(r=>({...r,predicted:false}));
        const occupied = new Set(actual.map(r=>courseKey(r)+'|'+r.date));
        const predicted = [], seen = new Set(), slots = new Set();
        function add(template,date) {
            if (!template || !validDate(date) || date.slice(0,7) !== snapshot.month || date <= cutoff || occupied.has(courseKey(template)+'|'+date)) return;
            const id = template.id + '@' + date;
            const slot = courseKey(template)+'|'+date+'|'+template.start+'|'+template.end;
            if (state.mode === 'manual' && (slots.has(slot) || predicted.some(r=>courseKey(r)===courseKey(template) && r.date===date && r.start<template.end && template.start<r.end))) return;
            if (seen.has(id)) return;
            seen.add(id);
            slots.add(slot);
            if (state.mode === 'auto' && excluded.has(id)) return;
            predicted.push({...template,id,date,kind:'regular',predicted:true,templateId:template.id});
        }
        if (state.mode === 'manual') {
            for (const item of state.manual || []) add(choices.find(r=>r.id===item.templateId),item.date);
        } else {
            for (let d=1; d<=daysInMonth(snapshot.month); d++) {
                const date = snapshot.month + '-' + String(d).padStart(2,'0');
                for (const row of choices) if (dayOfWeek(date) === dayOfWeek(row.date)) add(row,date);
            }
        }
        predicted.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.className.localeCompare(b.className));
        return {actual,predicted,templates:choices,actualAmount:actual.reduce((s,r)=>s+(r.amount || 0),0),predictedAmount:predicted.reduce((s,r)=>s+(r.amount || 0),0),pending:[...actual,...predicted].filter(r=>r.amount===null || r.minutes===null).length};
    }
    const api = {validMonth,validDate,daysInMonth,dayOfWeek,courseKey,validateSnapshot,templates,defaultCutoff,calculate};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ProgressCore = api;
})(typeof window === 'undefined' ? {} : window);
