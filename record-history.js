// A view over the already fetched history. Switching versions performs no RPC.
(function(root){
    const nameKey=record=>String(record.studentName||'').trim().normalize('NFC');
    function groupRecords(records){
        const groups=new Map();
        const sorted=records.map((record,index)=>({record,index})).sort((a,b)=>(Date.parse(b.record.savedAt)||0)-(Date.parse(a.record.savedAt)||0)||a.index-b.index);
        for(const {record} of sorted){
            // This groups display names, never student identities or payloads.
            const name=nameKey(record),key=name?'name:'+name:'record:'+record.recordId;
            if(!groups.has(key))groups.set(key,{key,name:name||'학생명 없음',records:[]});
            groups.get(key).records.push(record);
        }
        return [...groups.values()];
    }
    const selections=new Map();let previousLoadedId='';
    function reset(){selections.clear();previousLoadedId='';}
    function render({list,records,loadedId,labels,formatTime,onOpen,onDelete,onSelect}){
        const doc=list.ownerDocument,groups=groupRecords(records);
        const node=(tag,className,text)=>{const el=doc.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};
        if(loadedId!==previousLoadedId){
            const active=groups.find(g=>g.records.some(r=>r.recordId===loadedId));
            if(active)selections.set(active.key,loadedId);
            previousLoadedId=loadedId;
        }
        list.replaceChildren();
        groups.forEach((group,groupIndex)=>{
            const card=node('section','record-item record-folder');
            card.classList.toggle('record-item-active',group.records.some(r=>r.recordId===loadedId));
            const heading=node('div','record-folder-heading');
            const name=node('strong','record-student',group.name);heading.append(name);
            heading.append(node('span','record-version-count',group.records.length+'개 버전'));
            const tabs=node('div','record-version-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',group.name+' 저장 버전');
            const panel=node('div','record-version-panel');panel.id='record-panel-'+groupIndex;panel.setAttribute('role','tabpanel');
            let selected=group.records.find(r=>r.recordId===selections.get(group.key))||group.records[0];
            const buttons=[];
            function select(record,index){
                selected=record;selections.set(group.key,record.recordId);card.dataset.recordId=record.recordId;card.dataset.mode=record.currentTab||'auto';
                buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
                panel.setAttribute('aria-labelledby','record-tab-'+groupIndex+'-'+index);
                const open=node('button','record-open-btn');open.type='button';
                open.append(node('span','record-kind',labels[record.currentTab]||'수강료 기록'));
                open.append(node('span','record-month',`${record.targetYear||'—'}년 ${record.targetMonth||'—'}월`));
                open.append(node('b','record-amount',record.totalText||'0원'));
                open.append(node('span','record-open-label',record.recordId===loadedId?'열려 있는 저장본 다시 열기':'저장본 열기'));
                open.append(node('time','record-saved-at',formatTime(record.savedAt)));
                open.setAttribute('aria-label',`${group.name} ${index===0?'최신':'이전 '+index} 버전 · ${record.targetYear}년 ${record.targetMonth}월 · ${record.totalText} · ${formatTime(record.savedAt)} 저장본 열기`);
                open.onclick=()=>onOpen(record.recordId);
                const remove=node('button','record-delete-btn','삭제');remove.type='button';
                remove.title=`${group.name} ${formatTime(record.savedAt)} 저장 버전 삭제`;
                remove.setAttribute('aria-label',remove.title);remove.onclick=event=>onDelete(record.recordId,event);
                panel.replaceChildren(open,remove);onSelect?.(card,record);
            }
            group.records.forEach((record,index)=>{
                const tab=node('button','record-version-tab',index===0?'최신':'이전 '+index);tab.type='button';tab.id='record-tab-'+groupIndex+'-'+index;
                tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);
                tab.title=`${record.targetYear}년 ${record.targetMonth}월 · ${formatTime(record.savedAt)} · ${record.totalText}`;
                tab.setAttribute('aria-label',(index===0?'최신':'이전 '+index)+' 버전 · '+tab.title);
                tab.onclick=()=>select(record,index);
                tab.onkeydown=event=>{
                    let next;
                    if(event.key==='ArrowRight')next=(index+1)%buttons.length;
                    else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
                    else if(event.key==='Home')next=0;
                    else if(event.key==='End')next=buttons.length-1;
                    else return;
                    event.preventDefault();buttons[next].focus();select(group.records[next],next);
                };
                buttons.push(tab);tabs.append(tab);
            });
            card.append(heading,tabs,panel);list.append(card);select(selected,group.records.indexOf(selected));
        });
    }
    const api={groupRecords,render,reset};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FeeRecordHistory=api;
})(typeof window==='undefined'?{}:window);
