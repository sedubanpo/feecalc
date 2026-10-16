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
