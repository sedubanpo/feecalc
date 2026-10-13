// Discount evidence is already included in lesson amounts. Never subtract it again.
(function(root){
    const money=n=>Number(n).toLocaleString('ko-KR')+'원';
    function valid(parts,amount){
        return Array.isArray(parts)&&parts.length<=1000&&parts.every(p=>p&&[p.base,p.amount,p.percent].every(n=>typeof n==='number'&&Number.isFinite(n))&&p.base>=0&&p.base<=1e10&&p.amount>=0&&p.amount<=1e10&&p.percent>=0&&p.percent<=100&&typeof p.special==='boolean')&&(parts.length===0||typeof amount==='number'&&parts.reduce((n,p)=>n+p.amount,0)<=amount);
    }
    function parts(row){return valid(row?.discountParts,row?.amount)?row.discountParts:[];}
    function label(values){
        const rates=[...new Set(values.map(p=>p.percent))].sort((a,b)=>a-b);
        return (values.some(p=>p.special)?'특별 단가 · ':'')+(rates.some(n=>n>0)?rates.map(n=>n+'%').join('·')+' 할인':'할인 단가');
    }
    function describe(row){
        const values=parts(row);if(!values.length)return '';
        const base=values.reduce((n,p)=>n+p.base,0),amount=values.reduce((n,p)=>n+p.amount,0);
        return `${label(values)} 적용 · ${money(base)} → ${money(amount)}${amount!==row.amount?' (해당 부분)':''}`;
    }
    function summary(rows){
        const values=rows.flatMap(parts);if(!values.length)return '';
        const base=values.reduce((n,p)=>n+p.base,0),amount=values.reduce((n,p)=>n+p.amount,0);
        return `인트라넷 ${label(values)} 반영: ${money(base)} → ${money(amount)} (대상 수업 합계 · 위 금액에 포함)`;
    }
    const api={valid,parts,describe,summary};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FeeDiscount=api;
})(typeof window==='undefined'?{}:window);
