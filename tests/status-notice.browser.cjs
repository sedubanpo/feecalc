const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+'/'))return res.writeHead(403).end();try{res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'});
 const page=await context.newPage(),errors=[],results=[];
 // Planning fixtures have an explicit academy date, independent of the host clock.
 await context.addInitScript(()=>{const NativeDate=Date;window.testNow='2026-09-29T03:00:00Z';window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.testNow]));}static now(){return new NativeDate(window.testNow).getTime();}};});
 page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
 await page.context().route('https://firebasestorage.googleapis.com/test-photo',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'assets/subjects/korean.png'))}));
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
 await page.goto(process.env.TEST_URL || 'http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>registryState==='ready');



 await page.evaluate(()=>{
 window.testNow='2026-10-16T03:00:00Z';
 const row={id:'source',date:'2026-10-09',className:'국어-개별-배유진',teacher:'배유진',start:'15:00',end:'18:00',minutes:180,amount:87500,kind:'regular'};
 testProgressSnapshot={studentId:'one',month:'2026-10',lessons:[row]};
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-10-15',endDate:'2026-10-31',temporary:[{...row,id:'local:math',date:'2026-10-18',className:'수학-개별-검증강사',teacher:'검증강사',amount:62500,minutes:120,start:'12:00',end:'14:00'}]}});FeeCalendar.navigate('progress');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 await check('readable lesson totals and account profile photos',async()=>{
 await page.evaluate(async()=>{
  await FeeTeacherProfiles.load({teacherProfiles:async()=>[{name:'배유진',url:'https://firebasestorage.googleapis.com/test-photo'}]});
  FeeCalendar.navigate('notice');
 });
 assert.ok(await page.locator('.notice-teacher-avatar').count()>0);
 const details=await page.locator('#receiptBody').innerText();
 assert.match(details,/개별 3시간/);assert.doesNotMatch(details,/예상|3h|×/);
 const combined=await page.evaluate(()=>{const row={subject:'국어',teacher:'검증',type:'개별정규',hours:2,rate:62500,amount:62500,rateMode:'perClass',status:'출석'};return FeeCalendar.noticeRows([row,{...row,status:'예상'},{...row,status:'예상'}]);});
 assert.match(combined,/2시간 <\/span>3회/);
 await page.evaluate(()=>FeeCalendar.navigate('progress'));
 });
 await check('notice calendar duration and concise attendance labels',async()=>{
 const result=await page.evaluate(()=>{
  const base={subject:'국어',teacher:'검증강사',type:'개별정규',day:1,hours:0,start:'15:00',end:'18:00'};
  const host=document.createElement('div');host.innerHTML=FeeCalendar.noticeCalendar(['출석','예상','당취보충','당일취소','결석예고','휴강','지각','확인 필요'].map(status=>({...base,status})),'2026-10');
  return {times:[...host.querySelectorAll('.notice-time')].map(e=>e.textContent),statuses:[...host.querySelectorAll('.notice-status')].map(e=>e.textContent),pairs:[...host.querySelectorAll('.notice-status')].every(e=>e.previousElementSibling?.classList.contains('notice-teacher-name'))};
 });
 assert.deepEqual(result.times,Array(8).fill('3시간'));
 assert.deepEqual(result.statuses,['정규','정규','보충','당취','결석','휴강','지각','확인 필요']);assert.ok(result.pairs);
 await page.evaluate(()=>FeeCalendar.navigate('notice'));
 await page.locator('#noticeCancelAsAttendance').check();
 assert.match(await page.evaluate(()=>FeeCalendar.noticeCalendar([{subject:'국어',teacher:'검증',day:1,hours:2,status:'당일취소'}],'2026-10')),/notice-status">정규/);
 await page.locator('#noticeCancelAsAttendance').uncheck();await page.evaluate(()=>FeeCalendar.navigate('progress'));
 });
 await check('delete, move, repeat, pending recommendations and adjustment explanation',async()=>{
 const initial=await page.evaluate(()=>collectCalculatorState());
 await page.locator('[data-lesson-id="source"]').dragTo(page.locator('#workCalendar [data-day="10"]'));
 assert.equal(await page.evaluate(()=>progressResult().actual[0].date),'2026-10-10');
 await page.evaluate(()=>CalendarLessonEditor.open('local:math'));await page.locator('#lessonRepeat').click();await page.locator('#lessonEditCancel').click();
 assert.equal(await page.evaluate(()=>progressResult().predicted.filter(r=>r.temporary).length),2);
 await page.locator('[aria-label="25일 수업 전체 삭제"]').click();
 assert.equal(await page.evaluate(()=>progressResult().predicted.some(r=>r.date==='2026-10-25')),false);
 await page.locator('#undoCalendar').click();
 assert.equal(await page.evaluate(()=>progressResult().predicted.some(r=>r.date==='2026-10-25')),true);
 await page.screenshot({path:'/tmp/feecalc-actions-work.png',fullPage:true});
 await page.locator('[aria-label="18일 수학 검증강사 수업 삭제"]').click();
 assert.equal(await page.evaluate(()=>progressResult().predicted.some(r=>r.id==='local:math')),false);
 await page.evaluate(()=>{addAdjustmentItem('기수납',-100000);FeeCalendar.navigate('notice');});
 assert.match(await page.locator('#noticeBalanceExplanation').innerText(),/남은 이월금\s*−12,500원/);
 assert.equal(await page.locator('#noticeBalanceExplanation .balance-result .negative').evaluate(e=>getComputedStyle(e).color),'rgb(189, 51, 64)');
 assert.doesNotMatch(await page.locator('#captureArea').innerText(),/수정/);
 await page.locator('#hideBalanceExplanation').check();
 assert.equal(await page.locator('#noticeBalanceExplanation').isVisible(),false);
 assert.equal(await page.evaluate(()=>collectCalculatorState().calendarWorkspace.hideBalanceExplanation),true);
 await page.evaluate(()=>{const saved=collectCalculatorState();applyCalculatorState(saved);FeeCalendar.navigate('notice');});
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#hideBalanceExplanation').isChecked(),true);
 assert.equal(await page.locator('#noticeBalanceExplanation').isVisible(),false);
 await page.locator('#hideBalanceExplanation').uncheck();
 assert.equal(await page.locator('#noticeBalanceExplanation').isVisible(),true);
 await page.locator('#captureArea').screenshot({path:'/tmp/feecalc-readable-balance.png'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'이미지 저장',exact:true}).click();
 await (await download).saveAs('/tmp/feecalc-readable-export.png');
 assert.match(await page.locator('#imageOutputStatus').innerText(),/파일 저장/);


 await page.evaluate(()=>FeeCalendar.navigate('progress'));
 await page.evaluate(()=>{const row={...progressState.snapshot.lessons[0],id:'pending',date:'2026-10-13',amount:null};progressState.snapshot.lessons.push(row);FeeCalendar.commit();});
 assert.match(await page.locator('#pendingLessons').innerText(),/추천 87,500원/);
 await page.evaluate(()=>{addAdjustmentItem('9월 기수납 차감',-50000);FeeCalendar.navigate('notice');});
 assert.match(await page.locator('#noticeBalanceExplanation').innerText(),/9월 기수납 차감/);
 assert.match(await page.locator('#noticeBalanceExplanation').innerText(),/금액 확인 필요/);
 await page.evaluate(state=>applyCalculatorState(state),initial);
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 await page.evaluate(()=>FeeCalendar.navigate('progress'));
 });
 await check('temporary dialog includes entered custom lessons',async()=>{
 await page.evaluate(()=>TemporaryLessons.open(21));
 assert.match(await page.locator('#temporaryCourse').innerText(),/검증강사/);
 await page.locator('#temporaryCancel').click();
 });
 await check('actual absence and priced makeup persist',async()=>{
 await page.evaluate(()=>CalendarLessonEditor.open('source'));
 await page.locator('#lessonEditKind').selectOption('absence');
 assert.match(await page.locator('#lessonEditPreview').innerText(),/0원/);
 await page.locator('#lessonEditSave').click();
 assert.equal(await page.evaluate(()=>progressResult().actual[0].amount),0);
 await page.evaluate(()=>CalendarLessonEditor.open('source'));
 await page.locator('#lessonEditKind').selectOption('cancelMakeup');
 await page.locator('#lessonEditHours').fill('3');await page.locator('#lessonEditRate').fill('50000');
 await page.locator('#lessonEditSave').click();
 assert.deepEqual(await page.evaluate(()=>{const r=progressResult().actual[0];return [r.kind,r.amount]}),['cancelMakeup',50000]);
 assert.match(await page.locator('#workCalendar').innerText(),/당취보충/);
 });
 await check('forecast and temporary absence keep zero amount after restore',async()=>{
 for(const id of [await page.evaluate(()=>progressResult().predicted.find(r=>!r.temporary).id),'local:math']){
 await page.evaluate(id=>CalendarLessonEditor.open(id),id);await page.locator('#lessonEditKind').selectOption('absence');await page.locator('#lessonEditSave').click();
 }
 await page.evaluate(()=>{window.savedTest=collectCalculatorState();applyCalculatorState(savedTest);});
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 const absent=await page.evaluate(()=>progressResult().predicted.filter(r=>r.kind==='absence').map(r=>r.amount));assert.deepEqual(absent,[0,0]);
 });
 await check('notice teacher toggle preserves details and saved option',async()=>{
 await page.getByRole('button',{name:'안내서',exact:true}).click();
 await page.locator('#hideNoticeTeachers').check();
 assert.equal(await page.locator('#captureArea .notice-teacher-name:visible').count(),0);
 assert.ok(await page.locator('#captureArea .receipt-teacher:visible').count()>0);
 assert.equal(await page.evaluate(()=>collectCalculatorState().calendarWorkspace.hideNoticeTeachers),true);
 await page.screenshot({path:'/private/tmp/feecalc-status-desktop.png',fullPage:true});
 await page.locator('#hideNoticeTeachers').uncheck();assert.ok(await page.locator('#captureArea .notice-teacher-name:visible').count()>0);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.locator('#captureArea').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/feecalc-status-mobile.png'});
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));
 }finally{await browser.close();server.close();}
})();
