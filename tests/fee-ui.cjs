const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),evidence=process.env.EVIDENCE_ROOT;
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+'/'))return res.writeHead(403).end();try{res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'});
 const page=await context.newPage(),errors=[],results=[];
 // Planning fixtures have an explicit academy date, independent of the host clock.
 await context.addInitScript(()=>{const NativeDate=Date;window.testNow='2026-09-29T03:00:00Z';window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.testNow]));}static now(){return new NativeDate(window.testNow).getTime();}};});
 page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
 // All private service access is synthetic; never use user accounts or write production data.
 await page.context().route('**/*.cloudfunctions.net/**',r=>r.abort());await page.context().route('**/*.supabase.co/**',r=>r.abort());
 await page.context().route('**/auth-client.mjs*',r=>r.fulfill({contentType:'text/javascript',body:`export async function initializeAuth(onState){
 window.testWrites=[];window.testSettings={rateLibrary:[{type:'개별정규',unit:'perClass',amount:62500},{type:'1:1',unit:'perHour',amount:100000}]};
 const gateway={rpc:async(rpc,params)=>{if(window.testFail)return{error:{message:'가상 네트워크 오류'}};
 if(rpc==='feecalc_students')return{data:[{id:'one',name:'검증학생',school:'검증중',grade:'2'},{id:'two',name:'동명학생',school:'가학교',grade:'1'},{id:'three',name:'동명학생',school:'나학교',grade:'2'}]};
 if(rpc==='feecalc_student_memos')return{data:[{memo:'가상 안내 주의 메모 <script>안전한 텍스트</script>',createdAt:'2026-09-07',author:'검증 직원'}]};
 if(rpc==='feecalc_progress'&&window.testProgressSnapshot)return{data:window.testProgressSnapshot};
 if(['feecalc_desk_payments','feecalc_intranet_opening'].includes(rpc)){window.testFinancialCalls=(window.testFinancialCalls||0)+1;if(window.testFinancialDelay)await new Promise(r=>window.testFinancialResolve=r);return{data:structuredClone(window.testFinancialData[rpc])};}
 if(rpc==='feecalc_get_app_settings')return{data:window.testSettings};
 if(rpc==='feecalc_save_app_settings'){window.testSettings=params.p_settings;return{data:{}};}
 if(rpc==='feecalc_save_record'||rpc==='feecalc_update_record'){window.testWrites.push(params);return{data:{record_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',saved_at:new Date().toISOString()}};}
 return{data:[]};}};
 queueMicrotask(()=>onState({state:'ready',actor:{uid:'qa',name:'검증'},user:{uid:'qa'},gateway}));window.testAuthState=onState;window.testGateway=gateway;return{gateway};}` }));
 const check=async(name,fn)=>{await fn();results.push({name,result:'pass'});console.log('PASS',name);};
 try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>registryState==='ready');
 await check('horizontal header account, routine copy removed and auth errors visible',async()=>{
 assert.equal(await page.locator('#productHeader #staffLoginForm').count(),1);
 assert.equal(await page.locator('#recordsDock #staffAuthPanel').count(),0);
 assert.equal(await page.locator('#headerStaffName').innerText(),'검증');
 assert.equal(await page.locator('#staffAuthStatus').isVisible(),false);
 await page.evaluate(()=>testAuthState({state:'error',message:'합성 로그인 오류',gateway:testGateway}));
 assert.equal(await page.locator('#staffLoginForm').isVisible(),true);
 assert.equal(await page.locator('#staffAuthStatus').isVisible(),true);
 assert.match(await page.locator('#staffAuthStatus').innerText(),/합성 로그인 오류/);
 await page.evaluate(()=>testAuthState({state:'denied',message:'세션이 만료되었습니다. 다시 로그인해 주세요.',gateway:testGateway}));assert.equal(await page.locator('#staffAuthStatus').isVisible(),true);
 await page.evaluate(()=>testAuthState({state:'ready',actor:{uid:'qa',name:'검증'},user:{uid:'qa'},gateway:testGateway}));
 await page.waitForFunction(()=>registryState==='ready');
 });
 await check('redesigned record card preserves open and delete actions',async()=>{
 await page.evaluate(()=>{window.testLateStudents=studentRegistry;studentRegistry=[];serverRecordHistory=[{recordId:'card-qa',studentName:'검증학생',targetYear:2026,targetMonth:9,currentTab:'auto',totalText:'250,000원',savedAt:'2026-09-30',payload:{studentId:'one'}}];renderServerRecordList();window.testOldOpen=window.open;window.testOldDelete=deleteServerRecord;window.open=(url)=>window.testOpened=url;deleteServerRecord=(id)=>window.testDeleted=id;});
 assert.equal(await page.locator('.record-student').innerText(),'검증학생');
 assert.equal(await page.locator('.record-amount').innerText(),'250,000원');
 await page.locator('.record-open-btn').click();assert.match(await page.evaluate(()=>testOpened),/recordId=card-qa/);
 await page.evaluate(()=>{studentRegistry=testLateStudents;FeeCalendar.refresh();});assert.equal(await page.locator('.school-label').innerText(),'검증중');
 await page.locator('.record-delete-btn').click();assert.equal(await page.evaluate(()=>testDeleted),'card-qa');
 await page.evaluate(()=>{window.open=testOldOpen;deleteServerRecord=testOldDelete;serverRecordHistory=[];renderServerRecordList();});
 });
 await check('deprecated controls removed',async()=>{assert.equal(await page.locator('#recordMemoInput,#coreDataArea').count(),0);});
 await check('temporary name calculates but does not save',async()=>{await page.locator('#studentName').fill('임시학생');await page.evaluate(()=>saveServerRecord());assert.equal(await page.evaluate(()=>testWrites.length),0);assert.match(await page.locator('#studentMatchStatus').innerText(),/임시 학생/);});
 await check('canonical identity, duplicate selection and safe read-only memo',async()=>{
 await page.locator('#studentName').fill('동명학생');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>matchedStudent()),null);await page.locator('#studentMatches button').last().click();assert.equal(await page.evaluate(()=>collectCalculatorState().studentId),'three');
 await page.locator('#studentName').fill('검증학생');await page.waitForFunction(()=>document.getElementById('studentMemoWidgetBody').textContent.includes('가상 안내 주의'));
 assert.equal(await page.locator('#studentMemoWidgetBody script').count(),0);assert.equal(await page.locator('#captureArea #studentMemoWidget').count(),0);
 await page.evaluate(()=>saveServerRecord());assert.equal(await page.evaluate(()=>testWrites.at(-1).p_payload.studentId),'one');
 });
 await check('grouped shared price persistence and per-hour application',async()=>{
 await page.getByRole('button',{name:'설정',exact:true}).click();await page.locator('#settingsTabRates').click();await page.getByRole('button',{name:'단가 편집',exact:true}).click();await page.locator('#pricePresetType').selectOption('컨설팅');await page.locator('#pricePresetUnit').selectOption('perHour');await page.locator('#pricePresetInput').fill('150000');await page.locator('[onclick="addPricePreset()"]').click();await page.evaluate(()=>savePriceLibrary());
 assert.ok(await page.evaluate(()=>testSettings.rateLibrary.some(x=>x.type==='컨설팅'&&x.amount===150000&&x.unit==='perHour')));
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('#tab-auto .new-condition-button').click();await page.locator('.auto-row .sub-name').first().fill('수학-컨설팅(검증)-2h');await page.getByRole('button',{name:'컨설팅 150,000원 · 시간당 적용',exact:true}).click();assert.equal(await page.locator('.auto-row .rate-mode').first().inputValue(),'perHour');assert.equal(await page.locator('.auto-row .sub-rate').first().inputValue(),'150000');
 await page.evaluate(()=>{rateLibrary=[];});await page.evaluate(()=>reloadPriceLibrary());assert.ok(await page.evaluate(()=>rateLibrary.some(x=>x.type==='컨설팅')));
 });
 await check('adjustment type, previous-month rollover, sign and old data roundtrip',async()=>{
 const r=await page.evaluate(()=>{document.getElementById('targetMonth').value=1;addAdjustmentItem();const row=document.querySelector('#adjustmentList .adjustment-item');setAdjustmentKind(row.id,'carry');const input=row.querySelector('.adjustment-amount');input.value=500;normalizeAdjustmentSign(input);const carry=collectAdjustmentItems()[0];setAdjustmentKind(row.id,'extra');const extra=collectAdjustmentItems()[0];setAdjustmentKind(row.id,'other');input.value=-123;normalizeAdjustmentSign(input);const other=collectAdjustmentItems()[0];const saved=collectCalculatorState();applyCalculatorState(saved);return{carry,extra,other,restored:collectAdjustmentItems()[0]};});
 assert.equal(r.carry.label,'12월 이월금');assert.equal(r.carry.amount,-500);assert.equal(r.extra.amount,500);assert.equal(r.other.amount,-123);assert.deepEqual(r.other,r.restored);
 });
 await check('registry and notes failure truth',async()=>{await page.evaluate(()=>{testFail=true;});await page.evaluate(()=>loadStudentRegistry());assert.match(await page.locator('#studentMatchStatus').innerText(),/조회 실패/);await page.evaluate(()=>saveServerRecord());assert.equal(await page.evaluate(()=>testWrites.length),1);await page.evaluate(()=>{testFail=false;});await page.evaluate(()=>loadStudentRegistry());});
 await check('all modes retain new header and adjustment controls',async()=>{
 for(const mode of ['auto','select','manual','guide','first','timetable','history','ai','payment']) {await page.evaluate(m=>switchTab(m),mode);assert.equal(await page.locator('.receipt-header #dispName').count(),1);assert.equal(await page.locator('#dispDate').count(),1);}
 });
 await page.evaluate(()=>{applyCalculatorState({currentTab:'auto',studentName:'검증학생',studentId:'one',targetYear:2026,targetMonth:9,autoRows:[{name:'수학-개별(검증강사)-2h',hours:2,rate:62500,rateMode:'perClass',days:[1,3]}],adjustmentItems:[{label:'8월 이월금',amount:-50000,kind:'carry'}]});});
 await page.waitForTimeout(300);
 await page.getByRole('button',{name:'안내서',exact:true}).click();
 await check('receipt tools sit to the right and remain outside image capture',async()=>{
 assert.equal(await page.locator('#captureArea #noticeTools,#captureArea #staffAuthPanel,#captureArea #generatedTextArea').count(),0);
 const geometry=await page.evaluate(()=>{const paper=document.getElementById('captureArea').getBoundingClientRect(),tools=document.getElementById('noticeTools').getBoundingClientRect();return{right:paper.right,toolsLeft:tools.left,paperTop:paper.top,toolsTop:tools.top};});
 assert.ok(geometry.toolsLeft>=geometry.right+20);assert.ok(Math.abs(geometry.paperTop-geometry.toolsTop)<2);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#captureArea .subject-icon')).every(i=>i.naturalWidth>0&&!i.hidden));
 assert.equal(await page.locator('#dispSubtotal').evaluate(e=>getComputedStyle(e).color),'rgb(9, 94, 184)');
 const font=await page.locator('#captureArea #receiptBody td').first().evaluate(e=>getComputedStyle(e).fontSize);assert.equal(font,'12px');
 });

 await check('compact progress heading, independent variants and horizontal calendar details',async()=>{
 await page.setViewportSize({width:2236,height:1250});
 await page.evaluate(()=>{
 window.testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-09-30T00:00:00Z',lessons:[
 {id:'p1',date:'2026-09-06',className:'국어-1:1(검증강사)-2h',teacher:'검증강사',start:'20:00',end:'22:00',minutes:120,amount:250000,kind:'regular'},
 {id:'p2',date:'2026-09-07',className:'국어-개별(검증강사)-2.5h',teacher:'검증강사',start:'18:00',end:'20:30',minutes:150,amount:78125,kind:'regular'},
 {id:'p3',date:'2026-09-07',className:'국어-1:1(검증강사)-2h',teacher:'검증강사',start:'16:00',end:'18:00',minutes:0,amount:0,kind:'absence'},
 {id:'p4',date:'2026-09-10',className:'수학-개별(다른강사)-1h',teacher:'다른강사',start:'17:00',end:'18:00',minutes:60,amount:29167,kind:'cancel'}]};
 applyCalculatorState({currentTab:'progress',studentName:'검증학생',studentId:'one',targetYear:2026,targetMonth:9,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-09-29',endDate:'2026-09-30',manual:[],excluded:[]}});
 });
 await page.getByRole('button',{name:'안내서',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('receiptBody').textContent.includes('1:1'));
 assert.equal(await page.locator('#receiptSubTitle').innerText(),'수강료 예상 안내서');
 assert.match(await page.locator('#receiptContext').innerText(),/2026-09-29 기준.*2026-09-30/);
 assert.ok(Number(await page.locator('#receiptContext').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)))<=12);
 const layout=await page.evaluate(()=>{const paper=document.getElementById('captureArea').getBoundingClientRect(),variants=[...document.querySelectorAll('.receipt-variants')][0].children;const buttons=['saveNoticeImage','copyNoticeImage'].map(id=>document.getElementById(id).getBoundingClientRect());const event=document.querySelector('.notice-event'),subject=event.querySelector('strong').getBoundingClientRect(),time=event.querySelector('.notice-time').getBoundingClientRect();return{width:paper.width,variantsSameRow:Math.abs(variants[0].getBoundingClientRect().top-variants[1].getBoundingClientRect().top)<2,buttonsEqual:Math.abs(buttons[0].width-buttons[1].width)<1&&buttons[0].height===buttons[1].height&&buttons[0].top===buttons[1].top,horizontal:time.left>=subject.left&&Math.abs(time.top-subject.top)<3};});
 assert.equal(layout.width,1120);assert.ok(layout.variantsSameRow);assert.ok(layout.buttonsEqual);assert.ok(layout.horizontal);
 assert.match(await page.locator('#receiptBody').innerText(),/결석예고/);
 assert.match(await page.locator('#receiptMiniCalGrid').innerText(),/20:30/);
 assert.equal(await page.locator('#dispSubtotal').innerText(),'+357,292원');
 assert.equal(await page.locator('#dispSubtotal').evaluate(e=>getComputedStyle(e).fontWeight),'700');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('img[src*="sedu-warm"]')).every(i=>i.naturalWidth>0));
 if(evidence&&!process.env.SKIP_VISUAL){fs.mkdirSync(evidence,{recursive:true});await page.locator('#captureArea').screenshot({path:path.join(evidence,'progress-notice.png')});await page.screenshot({path:path.join(evidence,'progress-wide.png'),fullPage:true});}
 await page.evaluate(()=>switchTab('auto'));await page.getByRole('button',{name:'안내서',exact:true}).click();assert.equal(await page.locator('#receiptContext').isVisible(),false);
 });
 await check('guide and voucher settings persist safely and keep billing unchanged',async()=>{
 const before=await page.locator('#dispTotal').innerText();
 await page.getByRole('button',{name:'안내 문구 편집',exact:true}).click();
 assert.equal(await page.locator('#settingsPanelGuides').isVisible(),true);
 await page.locator('.guide-text-input').first().fill('검증 취소 안내');
 await page.locator('#voucherGuideText').fill('이월금 <img src=x onerror=alert(1)> 검증');
 await page.locator('#voucherGuideExample').fill('검증 바우처 예시');
 await page.locator('[onclick="saveAppSettings()"]').click();
 await page.waitForFunction(()=>testSettings.voucherGuide.example==='검증 바우처 예시');
 assert.equal(await page.evaluate(()=>testSettings.voucherGuide.example),'검증 바우처 예시');
 assert.match(await page.locator('#receiptGuideList').innerText(),/검증 취소 안내/);
 assert.equal(await page.locator('#voucherGuideBox .voucher-guide-title img').count(),0);
 assert.match(await page.locator('#voucherGuideBox .voucher-guide-title').innerText(),/<img/);
 assert.equal(await page.locator('#dispTotal').innerText(),before);
 await page.getByRole('button',{name:'설정',exact:true}).click();await page.locator('#settingsTabGuides').click();assert.equal(await page.locator('#voucherGuideExample').inputValue(),'검증 바우처 예시');
 await page.evaluate(()=>resetGuideMessages());await page.getByRole('button',{name:'닫기',exact:true}).click();
 });

 await check('lesson setup layout, subject tabs and header options retain behavior',async()=>{
 await page.setViewportSize({width:1920,height:1100});
 await page.evaluate(()=>{
 testProgressSnapshot={studentId:'one',month:'2026-08',lessons:[1,8,15,22].flatMap((d,i)=>[{id:'layout-m'+i,date:'2026-08-'+String(d).padStart(2,'0'),className:'수학-개별(검증강사)-3h',teacher:'검증강사',start:'14:00',end:'17:00',minutes:180,amount:87500,kind:'regular'},{id:'layout-k'+i,date:'2026-08-'+String(d+1).padStart(2,'0'),className:'국어-개별(다른강사)-3h',teacher:'다른강사',start:'14:00',end:'17:00',minutes:180,amount:87500,kind:'regular'}])};
 applyCalculatorState({version:8,currentTab:'auto',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,autoRows:[],adjustmentItems:[{label:'8월 초과금',amount:380000,kind:'extra'}],calendarWorkspace:{showComparison:true,previous:{studentId:'one',month:'2026-08',hours:{수학:18,국어:15}}}});
 FeeCalendar.navigate('calculate');
 });
 await page.locator('#loadSource').click();await page.locator('#sourceSubjectTabs [role=tab]').first().waitFor();
 assert.equal(await page.locator('#controlColumn #sourceTools').count(),1);
 assert.equal(await page.locator('#calendarWorkspace #adjustmentArea').count(),1);
 assert.equal(await page.locator('#sourceSubjectTabs [role=tab]').count(),2);
 assert.equal(await page.locator('#sourceCandidates [data-source-group]:visible').count(),1);
 await page.locator('#sourceSubjectTabs [role=tab]').last().click();
 await page.locator('#sourceCandidates [data-source-group]:visible [data-source-weekday="3"]').click();
 assert.equal(await page.locator('#workCalendar .calendar-event').count(),5);
 const total=await page.locator('#dispTotal').innerText();
 await page.locator('#toggleCalendarDetails').click();assert.equal(await page.locator('#hideReceiptCalendarDetails').isChecked(),true);
 assert.equal(await page.locator('#toggleCalendarDetails').getAttribute('aria-pressed'),'true');
 await page.locator('#toggleCalendarDetails').click();
 await page.locator('#toggleSiblingNotice').click();assert.equal(await page.locator('#siblingPanel').isVisible(),true);
 await page.locator('#toggleSiblingNotice').click();assert.equal(await page.locator('#siblingPanel').isVisible(),false);
 assert.equal(await page.locator('#dispTotal').innerText(),total);
 await page.locator('#tab-auto .new-condition-button').click();
 assert.equal(await page.locator('#autoList .condition-expanded .sub-name').last().isVisible(),true);
 assert.equal(await page.locator('#autoList .condition-expanded .sub-name').last().inputValue(),'');
 await page.locator('#sourceSubjectTabs [role=tab]').first().click();
 await page.locator('#sourceCandidates [data-source-group]:visible [data-source-weekday="2"]').click();
 if(evidence&&!process.env.SKIP_VISUAL){await page.screenshot({path:path.join(evidence,'layout-work-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'layout-work-mobile.png'),fullPage:true});await page.setViewportSize({width:1920,height:1100});}
 await page.locator('#viewNotice').click();
 assert.equal(await page.locator('#voucherGuideBox + #monthComparison').count(),1);
 assert.equal(await page.locator('#monthComparison').isVisible(),true);
 assert.ok(await page.locator('#dispName').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=26));
 assert.ok(await page.locator('#dispDate').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
 assert.match(await page.locator('link[rel=icon]').getAttribute('href'),/feecalc-favicon.svg/);
 if(evidence&&!process.env.SKIP_VISUAL)await page.screenshot({path:path.join(evidence,'layout-notice-desktop.png'),fullPage:true});
 });

 if(evidence && !process.env.SKIP_VISUAL){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'desktop.png'),fullPage:true});await page.locator('#captureArea').screenshot({path:path.join(evidence,'receipt.png')});}
 await page.setViewportSize({width:390,height:844});
 if(evidence && !process.env.SKIP_VISUAL)await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
 await check('mobile no horizontal page overflow',async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
 await check('intermediate and breakpoint overflow',async()=>{for(const width of [600,601,768,1279,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),String(width));}});
 await check('calculator brand, compact signed adjustments and temporary lesson popup lifecycle',async()=>{
 await page.setViewportSize({width:1920,height:1100});
 await page.evaluate(()=>{
 window.testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-09-30T00:00:00Z',lessons:[{id:'qa-source',date:'2026-09-01',className:'수학-개별정규(검증강사)-2h',teacher:'검증강사',start:'16:00',end:'18:00',minutes:120,amount:62500,kind:'regular'}]};
 applyCalculatorState({currentTab:'progress',studentName:'검증학생',studentId:'one',targetYear:2026,targetMonth:9,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-09-29',endDate:'2026-09-30',excluded:[],manual:[]},adjustmentItems:[{label:'8월 이월금',amount:-50000,kind:'carry'},{label:'8월 초과금',amount:10000,kind:'extra'}]});
 FeeCalendar.navigate('progress');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.match(await page.locator('.product-brand img').getAttribute('src'),/feecalc-favicon/);
 assert.equal(await page.locator('.adjustment-kinds button').count(),0);
 assert.equal(await page.locator('.adjustment-kinds select').count(),2);
 assert.equal(await page.locator('[data-kind=carry] .adjustment-amount').evaluate(n=>getComputedStyle(n).color),'rgb(186, 48, 56)');
 assert.equal(await page.locator('[data-kind=extra] .adjustment-plus').innerText(),'+');
 assert.equal(await page.locator('[data-kind=extra] .adjustment-amount').evaluate(n=>getComputedStyle(n).color),'rgb(9, 94, 184)');
 const source=await page.evaluate(()=>JSON.stringify(progressState.snapshot)),writes=await page.evaluate(()=>testWrites.length);
 await page.locator('#workCalendar [data-day="2"]').click({position:{x:70,y:110}});
 assert.equal(await page.locator('#temporaryLessonDialog').evaluate(n=>n.open),true);
 assert.equal(await page.locator('#temporaryCourse').evaluate(n=>document.activeElement===n),true);
 await page.locator('[name=temporaryScope][value=repeat]').check();
 await page.locator('#temporaryWeekdays [data-weekday="1"]').click();
 assert.match(await page.locator('#temporaryPreview').innerText(),/9회.*562,500원/);
 if(process.env.TEMP_VISUAL&&evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'temporary-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'temporary-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1920,height:1100});}
 await page.locator('#temporaryConfirm').click();
 assert.equal(await page.evaluate(()=>progressState.temporary.length),9);
 assert.equal(await page.evaluate(()=>progressResult().predictedAmount),562500);
 assert.equal(await page.evaluate(()=>JSON.stringify(progressState.snapshot)),source);
 assert.equal(await page.evaluate(()=>testWrites.length),writes);
 assert.match(await page.locator('#workCalendar [data-day="2"] .calendar-event').innerText(),/임시/);
 await page.locator('#workCalendar [data-day="2"] .calendar-event').click();
 await page.locator('#lessonEditDelete').click();
 assert.equal(await page.evaluate(()=>progressState.temporary.length),8);
 await page.locator('#undoCalendar').click();await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressState.temporary.length),9);
 await page.locator('#undoCalendar').click();await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressState.temporary.length),0);
 // Blank space on an occupied day opens the popup; the existing slot is excluded.
 await page.locator('#workCalendar [data-day="1"]').click({position:{x:70,y:130}});
 assert.equal(await page.locator('#temporaryConfirm').isDisabled(),true);assert.match(await page.locator('#temporarySkipped').innerText(),/1일/);
 await page.locator('#temporaryStart').fill('18:00');
 assert.equal(await page.locator('#temporaryConfirm').isDisabled(),false);await page.locator('#temporaryConfirm').click();
 assert.equal(await page.evaluate(()=>progressResult().actual.length),1);assert.equal(await page.evaluate(()=>progressState.temporary.length),1);
 const saved=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>applyCalculatorState(s),saved);await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressState.temporary.length),1);assert.equal(await page.evaluate(()=>progressResult().predictedAmount),62500);
 await page.locator('#workCalendar').getByRole('button',{name:'3일 임시 수업 추가',exact:true}).focus();await page.keyboard.press('Enter');
 await page.locator('#temporaryCourse').selectOption('custom');await page.locator('#temporaryName').fill('국어-1:1');await page.locator('#temporaryTeacher').fill('추가강사');await page.locator('#temporaryStart').fill('22:00');await page.locator('#temporaryHours').fill('3');await page.locator('#temporaryAmount').fill('0');
 assert.match(await page.locator('#temporaryError').innerText(),/자정/);assert.equal(await page.locator('#temporaryConfirm').isDisabled(),true);
 await page.locator('#temporaryHours').fill('1');assert.equal(await page.locator('#temporaryConfirm').isDisabled(),false);await page.locator('#temporaryConfirm').click();
 assert.equal(await page.evaluate(()=>progressState.temporary.length),2);assert.equal(await page.evaluate(()=>progressResult().predictedAmount),62500);
 await page.locator('#workCalendar').getByRole('button',{name:'4일 임시 수업 추가',exact:true}).focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');assert.equal(await page.locator('#temporaryLessonDialog').evaluate(n=>n.open),false);
 assert.equal(await page.evaluate(()=>testWrites.length),writes);
 if(process.env.TEMP_VISUAL&&evidence){await page.screenshot({path:path.join(evidence,'progress-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'progress-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1920,height:1100});}
 await page.locator('#viewNotice').click();assert.match(await page.locator('#receiptBody').innerText(),/임시/);
 await page.locator('#returnWork').click();await page.locator('#workCalendar').getByRole('button',{name:'4일 임시 수업 추가',exact:true}).click();
 await page.evaluate(()=>{document.getElementById('targetMonth').value=10;});await page.locator('#temporaryLessonForm').evaluate(n=>n.requestSubmit());
 assert.match(await page.locator('#temporaryError').innerText(),/学生|학생/);await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.getElementById('targetMonth').value=9;applyCalculatorState({currentTab:'auto',studentName:'검증학생',studentId:'one',targetYear:2026,targetMonth:9,autoRows:[]});});
 });
 await check('IME composition does not match or fetch partial names',async()=>{await page.evaluate(()=>{beginStudentNameComposition();handleStudentNameInput();});assert.equal(await page.evaluate(()=>matchedStudent()),null);await page.evaluate(()=>{studentNameComposing=false;handleStudentNameInput();});assert.equal(await page.evaluate(()=>matchedStudent().id),'one');});

 await check('shifted Saturday lesson transfers all five dates after review',async()=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{
 testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-09-30T00:00:00Z',lessons:['05','12','19','26'].map(d=>({id:'sat'+d,date:'2026-09-'+d,className:(d==='05'?'지리':'사회')+'-1:1(검증강사)-3h',teacher:'검증강사',minutes:180,amount:375000,start:d==='26'?'14:00':'13:00',end:d==='26'?'17:00':'16:00',kind:'regular'}))};
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-09-30',endDate:'2026-09-30'}});FeeCalendar.navigate('progress');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 const writes=await page.evaluate(()=>testWrites.length);
 await page.locator('[onclick="openNextMonthWizard()"]').click();
 assert.equal(await page.locator('#nextMonthRows [data-group]').count(),1);
 assert.match(await page.locator('#nextMonthRows').innerText(),/사회.*검증강사/s);
 assert.match(await page.locator('#nextMonthTotal').innerText(),/5회.*1,875,000원/);
 if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'saturday-next-month.png')});}
 await page.locator('#nextMonthConfirm').click();
 assert.equal(await page.locator('#workCalendar .calendar-event').count(),5);
 assert.match(await page.locator('#workCalendar [data-day="3"] .calendar-event').innerText(),/14:00–17:00/);
 assert.equal(await page.locator('#dispTotal').innerText(),'1,875,000원');assert.equal(await page.evaluate(()=>testWrites.length),writes);
 });
 await check('progress edits and next-month drafts preserve source, confirmation, totals and undo',async()=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{
 const source=(id,day,name,teacher,hours,amount,start,end)=>({id,date:'2026-09-'+String(day).padStart(2,'0'),className:name,teacher,minutes:hours*60,amount,start,end,kind:'regular'});
 testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-09-30T00:00:00Z',lessons:[...[1,8,15,22].map((d,i)=>source('next-m'+i,d,'수학-개별(검증강사)-2h','검증강사',2,62500,'16:00','18:00')),...[3,10,17].map((d,i)=>source('next-k'+i,d,'국어-개별(다른강사)-3h','다른강사',3,87500,'18:00','21:00')),source('one-off',25,'영어-개별(검증강사)-2h','검증강사',2,62500,'16:00','18:00')]};
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-09-29',endDate:'2026-09-30'},adjustmentItems:[{label:'8월 이월금',amount:-50000,kind:'carry'}]});FeeCalendar.navigate('progress');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 const original=await page.evaluate(()=>JSON.stringify(progressState.snapshot)),writes=await page.evaluate(()=>testWrites.length);
 await page.locator('#workCalendar [data-day="15"] .calendar-event').click();
 assert.equal(await page.locator('#calendarLessonDialog').evaluate(n=>n.open),true);
 await page.locator('#lessonEditHours').fill('1.5');await page.locator('#lessonEditRate').fill('50000');await page.locator('#lessonEditEnd').fill('17:30');
 if(evidence&&process.env.NEXT_VISUAL){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'edit-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'edit-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1440,height:1000});}
 await page.locator('#lessonEditSave').click();
 assert.equal(await page.evaluate(()=>progressResult().actual.find(r=>r.id==='next-m2').amount),50000);
 assert.equal(await page.evaluate(()=>JSON.stringify(progressState.snapshot)),original);
 const saved=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>applyCalculatorState(s),saved);await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressResult().actual.find(r=>r.id==='next-m2').minutes),90);
 await page.locator('#workCalendar [data-day="22"] .calendar-event').click();await page.locator('#lessonEditDelete').click();
 assert.equal(await page.evaluate(()=>progressResult().actual.length),7);
 assert.equal(await page.evaluate(()=>JSON.stringify(progressState.snapshot)),original);
 await page.locator('#undoCalendar').click();await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressResult().actual.length),8);
 await page.locator('[onclick="openNextMonthWizard()"]').click();
 assert.equal(await page.locator('#nextMonthModal').evaluate(n=>n.open),true);
 assert.equal(await page.locator('#nextMonthRows [data-group]').count(),2);
 assert.match(await page.locator('#nextMonthTotal').innerText(),/9회.*687,500원/);
 assert.match(await page.locator('#nextMonthSkipped').innerText(),/2건/);
 await page.locator('#nextMonthRows [data-group]').last().uncheck();assert.ok(!/687,500/.test(await page.locator('#nextMonthTotal').innerText()));await page.locator('#nextMonthRows [data-group]').last().check();
 if(evidence&&process.env.NEXT_VISUAL){await page.screenshot({path:path.join(evidence,'next-month-desktop.png')});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.locator('#nextMonthConfirm').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'next-month-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1440,height:1000});}
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>currentTab),'progress');assert.equal(await page.evaluate(()=>progressMonth()),'2026-09');
 await page.locator('[onclick="openNextMonthWizard()"]').click();await page.locator('#nextMonthConfirm').click();
 assert.equal(await page.evaluate(()=>currentTab),'auto');assert.equal(await page.locator('#targetMonth').inputValue(),'10');
 assert.equal(await page.locator('#autoList .auto-row').count(),2);assert.equal(await page.locator('#workCalendar .calendar-event').count(),9);
 assert.equal(await page.locator('#dispTotal').innerText(),'687,500원');assert.equal(await page.evaluate(()=>collectCalculatorState().progress),null);
 assert.equal(await page.evaluate(()=>collectAdjustmentItems().length),0);assert.equal(await page.evaluate(()=>testWrites.length),writes);
 assert.match(await page.locator('#workCalendar [data-day="6"] .calendar-event').innerText(),/16:00–18:00/);
 await page.locator('#workCalendar [data-day="6"] .calendar-event').click();await page.locator('#lessonEditRate').fill('40000');await page.locator('#lessonEditHours').fill('1');await page.locator('#lessonEditEnd').fill('17:00');await page.locator('#lessonEditSave').click();
 assert.equal(await page.locator('#dispTotal').innerText(),'665,000원');
 await page.locator('#loadSource').click();assert.equal(await page.locator('#autoList .auto-row').count(),2);
 const autoSaved=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>applyCalculatorState(s),autoSaved);assert.equal(await page.locator('#dispTotal').innerText(),'665,000원');
 await page.locator('#workCalendar [data-day="6"] .calendar-event').click();await page.locator('#lessonEditDelete').click();
 assert.equal(await page.locator('#workCalendar .calendar-event').count(),8);assert.equal(await page.locator('#dispTotal').innerText(),'625,000원');
 await page.locator('#undoCalendar').click();assert.equal(await page.locator('#dispTotal').innerText(),'665,000원');
 // An unverified or insufficient month must leave the current draft intact.
 await page.evaluate(()=>{switchTab('progress');window.nextInsufficient=collectCalculatorState();prepareNextMonthCalculation();});
 assert.equal(await page.locator('#targetMonth').inputValue(),'10');assert.equal(await page.evaluate(()=>currentTab),'progress');assert.equal(await page.evaluate(()=>testWrites.length),writes);
 await page.evaluate(()=>{switchTab('auto');openNextMonthWizard();});await page.keyboard.press('Escape');
 });


 await check('review imports only checked payments, preserves provenance, supports undo and no source writes',async()=>{
 await page.evaluate(()=>{applyCalculatorState({currentTab:'auto',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,adjustmentItems:[{label:'수동 차감',amount:-50000,kind:'carry'}]});testFinancialData={feecalc_desk_payments:{studentId:'one',month:'2026-10',rows:[{id:'pay',label:'10월 기수납액',date:'2026-09-30',method:'계좌',amount:-200000,kind:'other',fingerprint:'a'.repeat(64)},{id:'refund',label:'10월 환불액',date:'2026-09-30',amount:30000,kind:'other',fingerprint:'b'.repeat(64)},{id:'blocked',label:'교재비',amount:-10000,kind:'other',blocked:'수납 항목 확인 필요',fingerprint:'c'.repeat(64)}]},feecalc_intranet_opening:{studentId:'one',month:'2026-10',rows:[{id:'opening:2026-10',label:'9월 초과금',amount:200000,kind:'extra',method:'이전 달에서 자동 이월',fingerprint:'d'.repeat(64)}]}};testFinancialCalls=0;});
 const writes=await page.evaluate(()=>testWrites.length);await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===3);assert.equal(await page.locator('#financialSourceApply').isEnabled(),false);assert.equal(await page.locator('.financial-source-row input:checked').count(),0);assert.equal(await page.locator('.financial-source-row input:disabled').count(),1);assert.equal(await page.evaluate(()=>getAdjustmentTotal()),-50000);
 await page.locator('.financial-source-row input').first().check();assert.match(await page.locator('#financialSourcePreview').innerText(),/250,000/);await page.locator('#financialSourceApply').click();await page.waitForFunction(()=>!document.getElementById('financialSourceDialog'));assert.equal(await page.evaluate(()=>getAdjustmentTotal()),-250000);assert.equal(await page.evaluate(()=>testFinancialCalls),2);assert.equal(await page.evaluate(()=>testWrites.length),writes);
 const source=await page.evaluate(()=>{testImportedState=collectCalculatorState();return collectAdjustmentItems().at(-1).source;});assert.equal(source.provider,'desk');assert.equal(source.originalAmount,-200000);assert.equal(await page.locator('.adjustment-source').count(),1);await page.locator('#undoCalendar').click();assert.equal(await page.evaluate(()=>getAdjustmentTotal()),-50000);await page.evaluate(()=>applyCalculatorState(testImportedState));assert.equal(await page.evaluate(()=>collectAdjustmentItems().at(-1).source.provider),'desk');
 await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===3);assert.equal(await page.locator('.financial-source-row input:disabled').count(),2);await page.keyboard.press('Escape');await page.evaluate(()=>setAdjustmentItems([{label:'수동 차감',amount:-50000,kind:'carry'}]));
 });
 await check('intranet opening selection applies signed adjustment to receipt and refund remains positive',async()=>{
 await page.getByRole('button',{name:'인트라넷 잔액 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===1);assert.match(await page.locator('.financial-help').innerText(),/자동 이월/);await page.locator('.financial-source-row input').check();await page.locator('#financialSourceApply').click();await page.waitForFunction(()=>!document.getElementById('financialSourceDialog'));assert.equal(await page.evaluate(()=>getAdjustmentTotal()),150000);assert.equal(await page.evaluate(()=>collectAdjustmentItems().at(-1).kind),'extra');assert.equal(await page.locator('.adjustment-item[data-tone="positive"]').count(),1);
 await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===3);await page.locator('.financial-source-row input').nth(1).check();await page.locator('#financialSourceApply').click();await page.waitForFunction(()=>!document.getElementById('financialSourceDialog'));assert.equal(await page.evaluate(()=>getAdjustmentTotal()),180000);await page.getByRole('button',{name:'안내서',exact:true}).click();assert.match(await page.locator('#captureArea').innerText(),/기수납액|환불액/);await page.getByRole('button',{name:'계산 작업',exact:true}).click();
 });
 await check('changed source during review, failures and wrong student responses preserve calculation',async()=>{
 await page.evaluate(()=>setAdjustmentItems([]));await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===3);await page.locator('.financial-source-row input').first().check();await page.evaluate(()=>{testFinancialData.feecalc_desk_payments.rows[0].amount=-100000;testFinancialData.feecalc_desk_payments.rows[0].fingerprint='e'.repeat(64);});await page.locator('#financialSourceApply').click();await page.waitForFunction(()=>document.querySelector('#financialSourceDialog .draft-error').textContent.includes('変更')||document.querySelector('#financialSourceDialog .draft-error').textContent.includes('변경'));assert.equal(await page.evaluate(()=>getAdjustmentTotal()),0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{testFinancialData.feecalc_desk_payments.studentId='other';});await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#financialSourceDialog .draft-error').textContent.includes('일치'));assert.equal(await page.locator('.financial-source-row').count(),0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{testFinancialData.feecalc_desk_payments.studentId='one';testFail=true;});await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#financialSourceDialog .draft-error').textContent.includes('오류'));assert.equal(await page.evaluate(()=>getAdjustmentTotal()),0);await page.keyboard.press('Escape');await page.evaluate(()=>{testFail=false;});
 });
 // Native dialog close events remove the element in a later browser task.
 await check('stale request cannot apply after month change or expose receipts after signout',async()=>{
 await page.evaluate(()=>{testFinancialDelay=true;});await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>!!window.testFinancialResolve);await page.evaluate(()=>{document.getElementById('targetMonth').value=11;document.getElementById('targetMonth').dispatchEvent(new Event('input',{bubbles:true}));testFinancialDelay=false;testFinancialResolve();});await page.waitForFunction(()=>!document.getElementById('financialSourceDialog'));assert.equal(await page.locator('#financialSourceDialog').count(),0);assert.equal(await page.evaluate(()=>getAdjustmentTotal()),0);
 await page.evaluate(()=>{document.getElementById('targetMonth').value=10;});await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===3);await page.evaluate(()=>testAuthState({state:'anonymous',gateway:testGateway}));await page.waitForFunction(()=>!document.getElementById('financialSourceDialog'));assert.equal(await page.locator('#financialSourceDialog').count(),0);await page.evaluate(()=>testAuthState({state:'ready',actor:{uid:'qa',name:'검증'},user:{uid:'qa'},gateway:testGateway}));await page.waitForFunction(()=>registryState==='ready');
 });
 await check('financial review desktop and mobile layout fits with readable signed amounts',async()=>{
 await page.locator('#studentName').fill('검증학생');await page.evaluate(()=>{document.getElementById('targetMonth').value=10;});await page.getByRole('button',{name:'데스크 수납 가져오기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.financial-source-row').length===3);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>{const d=document.getElementById('financialSourceDialog');return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().width<=innerWidth;}));if(evidence)await page.screenshot({path:path.join(evidence,'funds-'+width+'.png')});}
 await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
 });

 await check('notice attendance labels preserve source and totals, private borders and teacher chips export',async()=>{
 await page.evaluate(()=>{applyCalculatorState({currentTab:'history',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,historyData:[{year:2026,month:9,day:14,subject:'국어-1:1(검증강사)-2h',teacher:'검증강사',attend:'당일취소',hours:2,amount:250000,originalAmount:250000,startTime:'18:00',endTime:'20:00'}]});FeeCalendar.navigate('notice');});
 const before=await page.evaluate(()=>({source:JSON.stringify(historyData),total:document.getElementById('dispTotal').textContent}));
 assert.match(await page.locator('#receiptBody').innerText(),/당일취소/);
 assert.equal(await page.locator('#captureArea .notice-private').count(),1);
 assert.equal(await page.locator('#captureArea .notice-teacher-badge').count(),2);
 await page.locator('#noticeCancelAsAttendance').check();
 assert.doesNotMatch(await page.locator('#receiptBody').innerText(),/당일취소/);assert.match(await page.locator('#receiptBody').innerText(),/출석/);
 assert.doesNotMatch(await page.locator('#receiptMiniCalGrid').innerText(),/당일취소/);
 assert.deepEqual(await page.evaluate(()=>({source:JSON.stringify(historyData),total:document.getElementById('dispTotal').textContent})),before);
 const state=await page.evaluate(()=>collectCalculatorState());assert.equal(state.calendarWorkspace.cancelAsAttendance,true);
 await page.evaluate(s=>{applyCalculatorState(s);FeeCalendar.navigate('notice');},state);
 assert.equal(await page.locator('#noticeCancelAsAttendance').isChecked(),true);
 if(evidence){fs.mkdirSync(evidence,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#captureArea').screenshot({path:path.join(evidence,'notice-labels-'+width+'.png')});}await page.setViewportSize({width:1440,height:1000});}
 await page.locator('#noticeCancelAsAttendance').uncheck();assert.match(await page.locator('#receiptBody').innerText(),/당일취소/);
 });
 await check('notice absence, time visibility and real PNG clipboard export',async()=>{
 await page.evaluate(()=>{
 testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-10-02T00:00:00Z',lessons:[{id:'absent',date:'2026-09-26',className:'사회-개별(검증강사)-3h',teacher:'검증강사',minutes:0,amount:0,start:'16:00',end:'19:00',kind:'absence'},{id:'private',date:'2026-09-12',className:'국어-1:1(다른강사)-3h',teacher:'다른강사',minutes:180,amount:375000,start:'13:00',end:'16:00',kind:'regular'}]};
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,progress:{snapshot:testProgressSnapshot,mode:'manual',cutoff:'2026-09-30',endDate:'2026-09-30'}});FeeCalendar.navigate('notice');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#receiptBody .notice-absence').count(),1);
 assert.equal(await page.locator('#receiptMiniCalGrid .notice-absence').count(),1);
 const before=await page.evaluate(()=>JSON.stringify(progressState.snapshot));
 await page.locator('#hideNoticeTimes').check();assert.equal(await page.locator('.notice-time:visible').count(),0);
 const saved=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>{applyCalculatorState(s);FeeCalendar.navigate('notice');},saved);await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#hideNoticeTimes').isChecked(),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(progressState.snapshot)),before);
 await page.locator('#hideNoticeTimes').uncheck();assert.equal(await page.locator('.notice-time:visible').count(),2);
 await page.evaluate(()=>{window.copiedNotice=null;Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:async items=>{window.copiedNotice=await items[0].getType('image/png');}});});
 await page.locator('#copyNoticeImage').click();await page.waitForFunction(()=>window.copiedNotice,{timeout:30000});
 const png=await page.evaluate(async()=>Array.from(new Uint8Array(await copiedNotice.arrayBuffer())));assert.ok(png.length>10000);
 if(evidence){fs.writeFileSync(path.join(evidence,'clipboard-export.png'),Buffer.from(png));await page.locator('#captureArea').screenshot({path:path.join(evidence,'export-preview.png')});}
 assert.match(await page.locator('#imageOutputStatus').innerText(),/복사했습니다/);
 assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('workspace-loading')),false);
 });
 await check('previous notice reconciles actual tuition, opening and receipts independently with editable persistent draft',async()=>{
 await page.setViewportSize({width:1800,height:1100});
 await context.route('https://school.example/logo.svg',r=>r.fulfill({contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="56" fill="#204c73"/><text x="40" y="78" font-size="50" fill="white">S</text></svg>'}));
 await page.evaluate(()=>{
 applyCalculatorState({currentTab:'auto',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,adjustmentItems:[{label:'9월 초과금',amount:906250,kind:'extra'}]});
 testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-10-03T00:00:00Z',lessons:Array.from({length:81},(_,i)=>({id:'prior-'+i,date:'2026-09-'+String(1+Math.floor(i/3)).padStart(2,'0'),className:['사회','사탐','통사'][i%3]+'-1:1(검증강사)-3h',teacher:i%2?'다른강사':'검증강사',minutes:180,amount:i===0?193750:37500,start:['10:00','13:00','16:00'][i%3],end:['13:00','16:00','19:00'][i%3],kind:'regular'}))};
 testFinancialData={feecalc_desk_payments:{studentId:'one',month:'2026-09',rows:[{id:'receipt',label:'9월 기수납액',amount:-2287500,kind:'other',fingerprint:'a'.repeat(64)}]},feecalc_intranet_opening:{studentId:'one',month:'2026-09',rows:[{id:'opening',label:'8월 잔액',amount:0,kind:'other',fingerprint:'b'.repeat(64)}]}};
 studentRegistry.find(s=>s.id==='one').schoolLogoUrl='https://school.example/logo.svg';FeeCalendar.navigate('notice');window.priorWrites=testWrites.length;
 });
 assert.match(await page.locator('#captureArea .notice-school-meta').innerText(),/검증중 · 2학년/);
 await page.locator('#loadPriorNotice').click();await page.waitForFunction(()=>document.querySelector('#priorNoticePaper .prior-total')?.textContent.includes('906,250'));
 assert.equal(await page.evaluate(()=>getAdjustmentTotal()),906250);
 await page.getByLabel('잔액·수납 1 금액 (원)',{exact:true}).fill('-2200000');await page.getByLabel('잔액·수납 1 금액 (원)',{exact:true}).press('Tab');
 assert.match(await page.locator('#priorNoticePaper .prior-total').innerText(),/993,750/);
 await page.evaluate(()=>{window.priorState=collectCalculatorState();applyCalculatorState(priorState);FeeCalendar.navigate('notice');});
 assert.equal(await page.getByLabel('잔액·수납 1 금액 (원)',{exact:true}).inputValue(),'-2200000');
 assert.equal(await page.evaluate(()=>getAdjustmentTotal()),906250);assert.equal(await page.evaluate(()=>testWrites.length),await page.evaluate(()=>priorWrites));
 assert.ok(await page.locator('#priorNoticePaper').evaluate(e=>e.getBoundingClientRect().width>900));assert.ok(await page.evaluate(()=>{const p=document.getElementById('priorNoticePaper').getBoundingClientRect(),s=document.getElementById('priorNoticeSettings').getBoundingClientRect();return s.left>=p.right&&Math.abs(s.top-p.top)<2;}));assert.equal(await page.locator('#priorNoticePaper tbody tr').count(),2);assert.equal(await page.locator('#priorNoticePaper .notice-event').count(),81);assert.match(await page.locator('#priorNoticePaper .receipt-document-title').innerText(),/이전 달/);
 assert.equal(await page.locator('#noticeTools').evaluate(e=>getComputedStyle(e).position),'static');
 await page.waitForFunction(()=>document.querySelector('#captureArea .notice-school-emblem')?.naturalWidth>0);
 if(evidence){await page.locator('#captureArea .receipt-student').screenshot({path:path.join(evidence,'school-identity.png')});await page.locator('#priorNoticeSection').screenshot({path:path.join(evidence,'prior-desktop.png')});}
 await page.evaluate(()=>{window.copiedNotice=null;});await page.locator('[data-prior-export="copy"]').click();await page.waitForFunction(()=>!!window.copiedNotice,{timeout:30000});
 if(evidence){const png=await page.evaluate(async()=>Array.from(new Uint8Array(await copiedNotice.arrayBuffer())));fs.writeFileSync(path.join(evidence,'prior-export.png'),Buffer.from(png));}
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(evidence)await page.locator('#priorNoticeSection').screenshot({path:path.join(evidence,'prior-mobile.png')});
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{testFail=true;});await page.locator('#loadPriorNotice').click();await page.waitForFunction(()=>document.getElementById('priorNoticeStatus').textContent.includes('조회하지 못했습니다'));assert.match(await page.locator('#priorNoticePaper .prior-total').innerText(),/993,750/);await page.evaluate(()=>{testFail=false;});
 await page.locator('#priorEditors details').first().evaluate(e=>e.open=true);
 await page.getByLabel('실제 수업 1 수업일',{exact:true}).fill('2026-09-19');await page.getByLabel('실제 수업 1 수업일',{exact:true}).press('Tab');assert.equal(await page.locator('#priorNoticePaper .notice-event').count(),81);
 await page.evaluate(()=>{testFinancialData.feecalc_intranet_opening.rows[0].amount=null;testFinancialData.feecalc_intranet_opening.rows[0].blocked='시작 잔액 확인 필요';});await page.locator('#loadPriorNotice').click();await page.waitForFunction(()=>document.querySelector('#priorSourceIssue')?.textContent.includes('확인 필요'));assert.equal(await page.locator('[data-prior-export="copy"]').isDisabled(),true);
 await page.evaluate(()=>{applyCalculatorState({...priorState,studentId:'two',studentName:'동명학생'});FeeCalendar.navigate('notice');});assert.equal(await page.locator('#priorNoticePaper').isVisible(),false);
 });
 await check('past-month saved notice drops automatic final-day charge and reflects latest deleted lesson',async()=>{
 await page.setViewportSize({width:1920,height:1100});
 await page.evaluate(()=>{
 const otherDates=[1,8,14,17,19,21,22,26,28,29];
 window.settlementSource={studentId:'one',month:'2026-09',fetchedAt:'2026-10-03T00:00:00Z',lessons:[
 ...Array.from({length:15},(_,i)=>({id:'settlement-other-'+i,date:'2026-09-'+String(otherDates[i%otherDates.length]).padStart(2,'0'),className:'국어-1:1-검증국어',teacher:'검증국어',minutes:120,amount:i===14?306250:175000,start:i>=10?'16:00':'13:00',end:i>=10?'18:00':'15:00',kind:'regular'})),
 ...[2,9,16,23].map(day=>({id:'settlement-math-'+day,date:'2026-09-'+String(day).padStart(2,'0'),className:'수학-개별-검증수학',teacher:'검증수학',minutes:180,amount:87500,start:'18:00',end:'21:00',kind:'regular'}))]};
 testProgressSnapshot=structuredClone(settlementSource);
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-09-29',endDate:'2026-09-30',manual:[],excluded:[]},adjustmentItems:[{label:'9월 기수납액',amount:-1000000,kind:'other'},{label:'9월 기수납액',amount:-700000,kind:'other'},{label:'9월 기수납액',amount:-587500,kind:'other'}]});FeeCalendar.navigate('notice');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#dispTotal').innerText(),'906,250원');assert.equal(await page.evaluate(()=>progressResult().predictedAmount),87500);
 await page.evaluate(()=>{window.testNow='2026-09-30T14:59:59Z';renderProgress();FeeCalendar.refresh();});assert.equal(await page.evaluate(()=>progressToday()),'2026-09-30');assert.equal(await page.locator('#dispTotal').innerText(),'906,250원');
 await page.evaluate(()=>{window.testNow='2026-09-30T15:00:00Z';renderProgress();FeeCalendar.refresh();});assert.equal(await page.evaluate(()=>progressToday()),'2026-10-01');assert.equal(await page.locator('#dispTotal').innerText(),'818,750원');
 // A previously saved snapshot still includes a source lesson later deleted.
 await page.evaluate(()=>{window.testNow='2026-10-03T02:30:00Z';const saved=collectCalculatorState();saved.progress.snapshot.lessons.push({id:'settlement-deleted',date:'2026-09-15',className:'국어-1:1-검증국어',teacher:'검증국어',minutes:60,amount:87500,start:'13:00',end:'14:00',kind:'regular'});window.settlementSaved=saved;window.settlementWrites=testWrites.length;applyCalculatorState(saved);FeeCalendar.navigate('notice');});
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressResult().actual.length),19);assert.equal(await page.evaluate(()=>progressResult().actualAmount),3106250);
 assert.equal(await page.evaluate(()=>progressResult().predicted.length),0);assert.equal(await page.locator('#dispTotal').innerText(),'818,750원');assert.equal(await page.locator('#labelTotal').innerText(),'잔여 수강료');assert.equal(await page.locator('#receiptSubTitle').innerText(),'수강료 정산 안내서');
 assert.match(await page.locator('#receiptContext').innerText(),/자동 예상 수업 제외/);assert.match(await page.locator('#generatedTextArea').inputValue(),/잔여 수강료: 818,750원/);assert.doesNotMatch(await page.locator('#generatedTextArea').inputValue(),/월 예상 납부액|예상 종료일/);
 assert.equal(await page.locator('#captureArea .notice-event.predicted').count(),0);assert.equal(await page.locator('#captureArea .notice-event').count(),19);
 await page.evaluate(()=>{FeeCalendar.navigate('progress');setProgressCutoff('2026-09-23');restoreProgressForecast();});assert.equal(await page.evaluate(()=>progressResult().predicted.length),0);await page.evaluate(()=>FeeCalendar.navigate('notice'));
 const restored=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>{applyCalculatorState(s);FeeCalendar.navigate('notice');},restored);await page.waitForFunction(()=>progressVerified&&!progressLoading);assert.equal(await page.locator('#dispTotal').innerText(),'818,750원');
 if(evidence)await page.locator('#captureArea').screenshot({path:path.join(evidence,'settlement-desktop.png')});
 await page.evaluate(()=>{window.copiedNotice=null;});await page.locator('#copyNoticeImage').click();await page.waitForFunction(()=>!!copiedNotice,{timeout:30000});
 const png=await page.evaluate(async()=>Array.from(new Uint8Array(await copiedNotice.arrayBuffer())));assert.ok(png.length>10000);if(evidence)fs.writeFileSync(path.join(evidence,'settlement-export.png'),Buffer.from(png));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(evidence)await page.locator('#captureArea').screenshot({path:path.join(evidence,'settlement-mobile.png')});await page.setViewportSize({width:1440,height:1000});
 assert.equal(await page.evaluate(()=>JSON.stringify(testProgressSnapshot)),await page.evaluate(()=>JSON.stringify(settlementSource)));assert.equal(await page.evaluate(()=>testWrites.length),await page.evaluate(()=>settlementWrites));
 });
 await check('past-month explicit manual dates and temporary drafts remain separately marked',async()=>{
 await page.evaluate(()=>{const saved=collectCalculatorState();saved.progress.mode='manual';saved.progress.cutoff='2026-09-29';saved.progress.manual=[{templateId:'settlement-math-23',date:'2026-09-30'}];saved.progress.temporary=[{id:'local:settlement',date:'2026-09-25',className:'영어-개별-임시강사',teacher:'임시강사',minutes:60,amount:0,start:'15:00',end:'16:00',kind:'regular'}];applyCalculatorState(saved);FeeCalendar.navigate('notice');});await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressResult().predicted.length),2);assert.equal(await page.evaluate(()=>progressResult().predictedAmount),87500);assert.equal(await page.locator('#dispTotal').innerText(),'906,250원');assert.match(await page.locator('#receiptContext').innerText(),/직접 추가·임시/);assert.match(await page.locator('#generatedTextArea').inputValue(),/별도 예상분/);
 await page.evaluate(()=>{window.testNow='2026-09-29T03:00:00Z';});
 });
 await check('forecast lessons seed next month before three actual weeks, with preview selection and no source writes',async()=>{
 await page.evaluate(()=>{
 window.testNow='2026-10-10T03:00:00Z';
 testProgressSnapshot={studentId:'one',month:'2026-10',fetchedAt:'2026-10-10T00:00:00Z',lessons:[{id:'early',date:'2026-10-02',className:'과학-개별(검증)-3h',teacher:'검증',minutes:180,amount:87500,start:'19:00',end:'22:00',kind:'regular'}]};
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-10-02',endDate:'2026-10-31'}});FeeCalendar.navigate('progress');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 const before=await page.evaluate(()=>JSON.stringify(progressState.snapshot)),writes=await page.evaluate(()=>testWrites.length);
 assert.ok(await page.evaluate(()=>progressResult().predicted.length>0));
 await page.locator('[onclick="openNextMonthWizard()"]').click();
 assert.equal(await page.locator('#nextMonthRows [data-group]').count(),1);assert.match(await page.locator('#nextMonthRows').innerText(),/예상 수업 기준/);assert.match(await page.locator('#nextMonthTotal').innerText(),/4회.*350,000원/);
 await page.locator('#nextMonthRows input').uncheck();assert.equal(await page.locator('#nextMonthConfirm').isDisabled(),true);await page.locator('#nextMonthRows input').check();
 if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'forecast-next-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(evidence,'forecast-next-mobile.png')});await page.setViewportSize({width:1440,height:1000});}
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify(progressState.snapshot)),before);
 await page.locator('[onclick="openNextMonthWizard()"]').click();await page.locator('#nextMonthConfirm').click();assert.equal(await page.locator('#targetMonth').inputValue(),'11');assert.equal(await page.locator('#workCalendar .calendar-event').count(),4);assert.equal(await page.locator('#dispTotal').innerText(),'350,000원');assert.equal(await page.evaluate(()=>testWrites.length),writes);
 });
 await check('signed-out account controls fit narrow and intermediate headers',async()=>{
 await page.evaluate(()=>testAuthState({state:'anonymous',gateway:testGateway}));
 for(const width of [390,600,768,1050,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),String(width));assert.equal(await page.locator('#staffLoginForm').isVisible(),true);}
 await page.evaluate(()=>{document.getElementById('staffAuthStatus').textContent='비밀번호를 다시 확인하세요.';});assert.equal(await page.locator('#staffAuthStatus').isVisible(),true);
 });
 if(evidence && !process.env.SKIP_VISUAL){
 const fixtures=require('./fixtures/calendar.cjs'),a=fixtures.planned(),b=fixtures.historical();
 await page.evaluate(()=>testAuthState({state:'ready',actor:{uid:'qa',name:'검증'},user:{uid:'qa'},gateway:testGateway}));
 const makeA={currentTab:'select',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,selectRows:a.templates.map(t=>({name:`${t.subject}-개별(${t.teacher})-${t.hours}h`,hours:t.hours,rate:t.rate,dates:t.dates,rateMode:'perClass'})),adjustmentItems:a.adjustments};
 await page.evaluate(f=>applyCalculatorState(f),makeA);await page.getByRole('button',{name:'안내서',exact:true}).click();await page.setViewportSize({width:2236,height:1250});
 await page.locator('#captureArea').screenshot({path:path.join(evidence,'notice-a.png')});await page.screenshot({path:path.join(evidence,'wide.png'),fullPage:true});
 const mobile=await page.context().newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>registryState==='ready');await mobile.evaluate(f=>applyCalculatorState(f),makeA);await mobile.getByRole('button',{name:'안내서',exact:true}).click();await mobile.evaluate(()=>window.scrollTo(0,0));await mobile.screenshot({path:path.join(evidence,'mobile.png')});await mobile.locator('#captureArea').screenshot({path:path.join(evidence,'mobile-notice.png')});await mobile.close();
 assert.equal(await page.locator('#productHeader').count(),1);assert.equal(await page.locator('#captureArea #productHeader').count(),0);
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(f=>applyCalculatorState(f),{currentTab:'history',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:8,historyData:b.events.map(r=>({year:2026,month:8,day:r.day,subject:`${r.subject}-${r.type}(${r.teacher})-${r.sourceHours||r.hours}h`,teacher:r.teacher,attend:r.status,hours:r.hours,amount:r.amount,originalAmount:r.amount,startTime:r.start+':00',endTime:r.end+':00'})),adjustmentItems:b.adjustments});
 await page.getByRole('button',{name:'안내서',exact:true}).click();await page.evaluate(()=>FeeCalendar.refresh());await page.locator('#captureArea').screenshot({path:path.join(evidence,'notice-b.png')});
 await page.getByRole('button',{name:'계산 작업',exact:true}).click();await page.screenshot({path:path.join(evidence,'work-b.png'),fullPage:true});
 }
 assert.deepEqual(errors,[]);
 if(evidence)fs.writeFileSync(path.join(evidence,'ui-tests.json'),JSON.stringify({browser:browser.version(),results,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
