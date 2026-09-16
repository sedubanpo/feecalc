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
        }
        return JSON.parse(JSON.stringify(value));
    }
    function templates(snapshot, cutoff) {
        const latest = new Map();
        for (const row of snapshot.lessons) {
            if (!['regular','late','absenceMakeup'].includes(row.kind) || row.date > cutoff || !row.minutes) continue;
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
        for(const row of [...snapshot.lessons].sort((a,b)=>a.date.localeCompare(b.date))) {
            if(row.date>cutoff || !row.minutes || !['regular','late','absenceMakeup'].includes(row.kind))continue;
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
