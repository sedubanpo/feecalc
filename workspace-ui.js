// View-only grouping and rate suggestions. Hidden rows remain in the calculator.
const FeeWorkspace = (() => {
    function lessonType(name) {
        const part=String(name||'').split('-')[1]?.split('(')[0].trim();
        return part==='개별' || part==='개별정규' ? '개별정규' : ['1:1','2:1','3:1','4:1','특강','컨설팅','수행평가','기타'].includes(part) ? part : '';
    }
    function subject(name) { return String(name||'').split('-')[0].trim() || '미분류'; }
    function fingerprint(state) {
        const {currentTab,pricePresets,adNotices,adText,guideMessages,studentId,...calculation}=state;
        return JSON.stringify(calculation);
    }
    return {lessonType,subject,fingerprint};
})();
if(typeof module!=='undefined') module.exports=FeeWorkspace;
if(typeof document!=='undefined') (()=>{
    const lists=['autoList','selectList','manualList','firstRegList'];
    const selected=new Map(), signatures=new WeakMap();
    let baseline='', touched=false, settingsDirty=false, settingsRevision=0, queued=false;
    const snapshot=()=>FeeWorkspace.fingerprint(collectCalculatorState());
    window.markCalculatorSaved=state=>{baseline=state?FeeWorkspace.fingerprint(state):snapshot();touched=snapshot()!==baseline;};
    window.hasUnsavedCalculatorChanges=()=>rateLibraryDirty || settingsDirty || (!!baseline && touched && snapshot()!==baseline);
    window.addEventListener('beforeunload',event=>{
        if(!window.hasUnsavedCalculatorChanges())return;
        event.preventDefault();event.returnValue='';
    });
    document.addEventListener('input',event=>{
        if(event.target.closest('#staffAuthPanel,#serverRecordArea'))return;
        touched=true;
        if(event.target.closest('#appSettingsModal')){settingsDirty=true;settingsRevision++;}
        if(event.target.matches('.sub-name')) {
            const list=event.target.closest(lists.map(id=>'#'+id).join(','));
            if(list && selected.get(list.id)!=='전체')selected.set(list.id,FeeWorkspace.subject(event.target.value));
            schedule();
        }
    });
    document.addEventListener('change',event=>{
        if(!event.target.closest('#staffAuthPanel,#serverRecordArea'))touched=true;
    });
    document.addEventListener('click',event=>{
        if(event.target.closest('main') && !event.target.closest('#serverRecordArea,#staffAuthPanel,.subject-tabs,.top-tab-button'))touched=true;
    });
    const originalApply=applyCalculatorState;
    applyCalculatorState=function(...args){const result=originalApply(...args);selected.clear();window.markCalculatorSaved();schedule();return result;};
    const originalSharedSave=saveSharedAppSettingsToServer;
    saveSharedAppSettingsToServer=async function(...args){
        const revision=settingsRevision,result=await originalSharedSave(...args);
        if(result && revision===settingsRevision)settingsDirty=false;
        return result;
    };
    function schedule(){if(!queued){queued=true;queueMicrotask(()=>{queued=false;refresh();});}}
    function suggestions(row) {
        const presets=row.querySelector('.rate-preset-row'),input=row.querySelector('.sub-rate');
        if(!presets||!input)return;
        const type=FeeWorkspace.lessonType(row.querySelector('.sub-name')?.value);
        const rates=rateLibrary.filter(rate=>rate.type===type);
        const signature=JSON.stringify([type,rates]);
        if(!row.querySelector('.rate-choice-grid')){
            const grid=document.createElement('div');grid.className='rate-choice-grid';
            input.before(grid);grid.append(presets,input);
            input.setAttribute('aria-label','수강료 단가 직접 입력');
            presets.className='rate-preset-row rate-suggestions';
        }
        if(signatures.get(presets)===signature && !presets.querySelector('select'))return;
        signatures.set(presets,signature);presets.replaceChildren();
        const title=document.createElement('span');title.className='rate-suggestion-title';title.textContent=type?type+' 저장 단가':'저장 단가';presets.append(title);
        for(const rate of rates){
            const button=document.createElement('button');button.type='button';button.className='ui-button rate-suggestion';
            button.textContent=`${rate.amount.toLocaleString()}원 · ${rate.unit==='perHour'?'시간당':'회당'}`;
            button.setAttribute('aria-label',`${type} ${button.textContent} 적용`);
            button.onclick=event=>{
                const unit=row.querySelector('.rate-mode');if(unit)unit.value=rate.unit;
                touched=true;applyRatePreset(button,rate.amount,event);
            };presets.append(button);
        }
        if(!rates.length){const empty=document.createElement('span');empty.className='rate-suggestion-empty';empty.textContent=type?'등록된 단가 없음 · 직접 입력':'반명에 수업 유형을 입력하세요';presets.append(empty);}
    }
    function groupList(list) {
        const rows=[...list.children].filter(row=>row.querySelector('.sub-name'));
        const subjects=[...new Set(rows.map(row=>FeeWorkspace.subject(row.querySelector('.sub-name').value)))];
        let active=selected.get(list.id)||'전체';if(active!=='전체'&&!subjects.includes(active))active='전체';selected.set(list.id,active);
        let nav=document.getElementById(list.id+'Subjects');
        if(!nav){nav=document.createElement('div');nav.id=list.id+'Subjects';nav.className='subject-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','과목별 수업');list.before(nav);}
        const signature=JSON.stringify([active,rows.map(row=>FeeWorkspace.subject(row.querySelector('.sub-name').value))]);
        if(nav.dataset.signature!==signature){
            nav.dataset.signature=signature;nav.replaceChildren();
            ['전체',...subjects].forEach((name,index)=>{
                const button=document.createElement('button');button.type='button';button.id=list.id+'Subject'+index;
                button.setAttribute('role','tab');button.setAttribute('aria-selected',String(name===active));button.setAttribute('aria-controls',list.id);button.tabIndex=name===active?0:-1;
                button.textContent=`${name} ${name==='전체'?rows.length:rows.filter(row=>FeeWorkspace.subject(row.querySelector('.sub-name').value)===name).length}`;
                button.onclick=()=>{selected.set(list.id,name);groupList(list);document.getElementById(button.id)?.focus();};
                button.onkeydown=event=>{
                    const buttons=[...nav.children],at=buttons.indexOf(button);
                    const next=event.key==='ArrowRight'?(at+1)%buttons.length:event.key==='ArrowLeft'?(at+buttons.length-1)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;
                    if(next>=0){event.preventDefault();buttons[next].click();}
                };nav.append(button);
            });
        }
        list.setAttribute('role','tabpanel');list.setAttribute('aria-labelledby',nav.querySelector('[aria-selected="true"]')?.id||'');
        for(const row of rows){row.hidden=active!=='전체' && FeeWorkspace.subject(row.querySelector('.sub-name').value)!==active;suggestions(row);}
        // The date picker must not keep editing a row hidden by a subject tab.
        if(list.id==='selectList' && activeSelectRowId){
            const current=document.getElementById('srow-'+activeSelectRowId);
            if(current?.hidden){activeSelectRowId=rows.find(row=>!row.hidden)?.id.replace('srow-','')||null;renderCalendar();}
        }
    }
    function refresh(){for(const id of lists){const list=document.getElementById(id);if(list)groupList(list);}}
    const oldRefreshPrices=refreshRatePresetRows;
    refreshRatePresetRows=function(){oldRefreshPrices();refresh();};
    function setupSettings(){
        const area=document.getElementById('pricePresetArea'),guides=document.getElementById('settingsPanelGuides');
        const panel=document.createElement('div');panel.id='settingsPanelRates';panel.className='hidden';guides.after(panel);panel.append(area);area.classList.remove('hidden');
        const button=document.createElement('button');button.type='button';button.id='settingsTabRates';button.className='settings-tab-btn';button.textContent='수업 단가';button.onclick=()=>switchSettingsTab('rates');document.getElementById('settingsTabGuides').after(button);
        const previous=switchSettingsTab;
        switchSettingsTab=function(tab){
            previous(tab==='rates'?'notices':tab);activeSettingsTab=tab;
            panel.classList.toggle('hidden',tab!=='rates');
            if(tab==='rates')document.getElementById('settingsPanelNotices').classList.add('hidden');
            for(const [id,value] of [['settingsTabNotices','notices'],['settingsTabGuides','guides'],['settingsTabRates','rates']])document.getElementById(id).classList.toggle('active',tab===value);
            document.getElementById('settingsResetButton').hidden=tab==='rates';
            document.querySelector('[onclick="saveAppSettings()"]').hidden=tab==='rates';
            area.classList.remove('hidden');
        };
        const oldCore=updateCoreDataArea;updateCoreDataArea=function(tab){oldCore(tab);area.classList.remove('hidden');};
        document.querySelector('#appSettingsModal h3 + p').textContent='수업 단가와 안내 이미지의 공지·안내 문구를 관리합니다.';
    }
    function setupIcons(){
        const paths={auto:'M5 3v4m14-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',select:'m5 12 4 4L19 6',manual:'M4 7h16M4 17h16M8 4v6m8 4v6',guide:'M4 4h16v13H9l-5 4V4',first:'M12 4v16M4 12h16',timetable:'M3 3h18v18H3V3m0 6h18M9 3v18',history:'M4 8a9 9 0 1 1-1 7M4 3v5h5m3 0v5l3 2',progress:'M4 20V10m8 10V4m8 16v-7',ai:'m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6',payment:'M3 6h18v13H3V6m0 4h18m-6 5h3'};
        for(const [mode,path] of Object.entries(paths)){
            const button=document.getElementById('btn-'+mode);if(!button)continue;
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','menu-icon');
            const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.append(line);button.prepend(svg);
        }
    }
    setupSettings();setupIcons();
    for(const id of lists){const list=document.getElementById(id);if(list)new MutationObserver(()=>{selected.set(id,'전체');schedule();}).observe(list,{childList:true});}
    const previousLoad=window.onload;
    window.onload=async function(...args){const result=await previousLoad.apply(this,args);refresh();if(!touched)window.markCalculatorSaved();return result;};
})();
