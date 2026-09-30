const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),evidence=process.env.EVIDENCE_ROOT;
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+'/'))return res.writeHead(403).end();try{res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'});
 const page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
 // All private service access is synthetic; never use user accounts or write production data.
 await page.context().route('**/*.cloudfunctions.net/**',r=>r.abort());await page.context().route('**/*.supabase.co/**',r=>r.abort());
 await page.context().route('**/auth-client.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export async function initializeAuth(onState){
 window.testWrites=[];window.testSettings={rateLibrary:[{type:'개별정규',unit:'perClass',amount:62500},{type:'1:1',unit:'perHour',amount:100000}]};
 const gateway={rpc:async(rpc,params)=>{if(window.testFail)return{error:{message:'가상 네트워크 오류'}};
 if(rpc==='feecalc_students')return{data:[{id:'one',name:'검증학생',school:'검증중',grade:'2'},{id:'two',name:'동명학생',school:'가학교',grade:'1'},{id:'three',name:'동명학생',school:'나학교',grade:'2'}]};
 if(rpc==='feecalc_student_memos')return{data:[{memo:'가상 안내 주의 메모 <script>안전한 텍스트</script>',createdAt:'2026-09-07',author:'검증 직원'}]};
 if(rpc==='feecalc_progress'&&window.testProgressSnapshot)return{data:window.testProgressSnapshot};
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
