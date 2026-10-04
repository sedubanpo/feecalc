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
 if(rpc==='feecalc_progress'){window.testProgressCalls=(window.testProgressCalls||[]);window.testProgressCalls.push(params);return{data:structuredClone(window.testSnapshots[params.p_month])};}
 if(['feecalc_desk_payments','feecalc_intranet_opening'].includes(rpc)){window.testFinancialCalls=(window.testFinancialCalls||0)+1;if(window.testFinancialDelay)await new Promise(r=>window.testFinancialResolve=r);return{data:structuredClone(window.testFinancialData[rpc])};}
 if(rpc==='feecalc_get_app_settings')return{data:window.testSettings};
 if(rpc==='feecalc_save_app_settings'){window.testSettings=params.p_settings;return{data:{}};}
 if(rpc==='feecalc_save_record'||rpc==='feecalc_update_record'){window.testWrites.push(params);return{data:{record_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',saved_at:new Date().toISOString()}};}
 return{data:[]};}};
 queueMicrotask(()=>onState({state:'ready',actor:{uid:'qa',name:'검증'},user:{uid:'qa'},gateway}));window.testAuthState=onState;window.testGateway=gateway;return{gateway};}` }));
 const check=async(name,fn)=>{await fn();results.push({name,result:'pass'});console.log('PASS',name);};
 try{
 await page.goto(process.env.TEST_URL||`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>registryState==='ready');

 await check('two-month import preserves current month and enables missing prior courses',async()=>{
 await page.evaluate(()=>{
  testNow='2026-10-04T03:00:00Z';
  const lesson=(i)=>({id:'basis-'+i,date:'2026-09-'+String(1+Math.floor(i/3)).padStart(2,'0'),className:['국어','수학','과학'][i%3]+'-개별(기준강사)-3h',teacher:'기준강사',start:['10:00','13:00','16:00'][i%3],end:['13:00','16:00','19:00'][i%3],minutes:180,amount:87500,kind:'regular'});
  testSnapshots={'2026-10':{studentId:'one',month:'2026-10',fetchedAt:'2026-10-04T00:00:00Z',lessons:[]},'2026-09':{studentId:'one',month:'2026-09',fetchedAt:'2026-10-04T00:00:00Z',lessons:Array.from({length:81},(_,i)=>lesson(i))}};
  applyCalculatorState({currentTab:'progress',studentName:'검증학생',studentId:'one',targetYear:2026,targetMonth:10});FeeCalendar.navigate('progress');
 });
 await page.locator('#progressFetch').click();await page.waitForFunction(()=>progressVerified&&!progressLoading);
 await page.locator('#progressBasisFetch').click();await page.waitForFunction(()=>progressVerified&&!progressLoading&&progressState.basis.length===1);
 assert.equal(await page.evaluate(()=>progressState.basis[0].lessons.length),81);assert.equal(await page.evaluate(()=>progressResult().actual.length),0);assert.equal(await page.evaluate(()=>progressResult().predictedAmount),0);
 await page.locator('[name=progressMode][value=manual]').check();assert.equal(await page.locator('#progressTemplate option').count(),3);
 await page.locator('#progressTemplate').selectOption({index:0});await page.locator('#progressDates button[aria-label="2026-10-08 예상 수업"]').click();
 assert.equal(await page.evaluate(()=>progressResult().predictedAmount),87500);assert.equal(await page.evaluate(()=>progressReady()),true);
 assert.ok(await page.evaluate(()=>testProgressCalls.some(p=>p.p_month==='2026-09')));
 });
 await check('manual calendar aligns October Thursday and February Sunday with weekday labels',async()=>{
 const geometry=await page.evaluate(()=>{const host=document.getElementById('progressDates'),day=host.querySelector('button'),thursday=host.querySelectorAll('.progress-weekday')[4];return{dayLeft:day.getBoundingClientRect().left,weekdayLeft:thursday.getBoundingClientRect().left,blanks:host.querySelectorAll('.progress-calendar-blank').length,days:host.querySelectorAll('button').length};});
 assert.ok(Math.abs(geometry.dayLeft-geometry.weekdayLeft)<1);assert.equal(geometry.blanks,4);assert.equal(geometry.days,31);
 if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'planning-desktop.png'),fullPage:true});}
 await page.evaluate(()=>{testOctober=collectCalculatorState();testSnapshots['2026-02']={studentId:'one',month:'2026-02',lessons:[]};applyCalculatorState({currentTab:'progress',studentName:'검증학생',studentId:'one',targetYear:2026,targetMonth:2});});
 await page.locator('#progressFetch').click();await page.waitForFunction(()=>progressVerified&&!progressLoading);await page.locator('[name=progressMode][value=manual]').check();
 assert.equal(await page.locator('#progressDates button').count(),28);assert.equal(await page.locator('#progressDates .progress-calendar-blank').count(),0);
 await page.evaluate(()=>applyCalculatorState(testOctober));await page.waitForFunction(()=>progressVerified&&!progressLoading);

 });
 await check('temporary entry includes prior courses and defaults to selected basis',async()=>{
 await page.evaluate(()=>TemporaryLessons.open(9));assert.equal(await page.locator('#temporaryCourse option').count(),4);
 assert.match(await page.locator('#temporaryCourse option:checked').innerText(),/과학.*09-27 기준/);
 await page.locator('#temporaryLessonDialog [aria-label="임시 수업 창 닫기"]').click();
 });
 await check('payment choices regenerate message and roundtrip draft without changing tuition',async()=>{
 await page.evaluate(()=>FeeCalendar.navigate('notice'));assert.equal(await page.locator('#messageControlArea').isVisible(),true);
 const total=await page.locator('#dispTotal').innerText();
 for(const [value,text] of [['link','결제링크'],['visit','방문 예정'],['transferSchool','992-019767-01-011'],['transferCustom','계좌 정보를 입력']]){await page.locator('#messagePaymentType').selectOption(value);assert.match(await page.locator('#generatedTextArea').inputValue(),new RegExp(text));assert.equal(await page.locator('#dispTotal').innerText(),total);}
 await page.locator('#customTransferAccount').fill('합성은행 / 123-456 / 검증');assert.match(await page.locator('#generatedTextArea').inputValue(),/합성은행/);
 await page.evaluate(()=>{testSaved=collectCalculatorState();applyCalculatorState(testSaved);FeeCalendar.navigate('notice');});await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#messagePaymentType').inputValue(),'transferCustom');assert.match(await page.locator('#generatedTextArea').inputValue(),/합성은행/);assert.equal(await page.evaluate(()=>progressResult().predictedAmount),87500);
 });
 await check('independent calendar-time and detailed-duration hiding survives restoration and real PNG',async()=>{
 await page.locator('#hideNoticeDurations').check();assert.equal(await page.locator('#receiptBody .notice-duration').first().isVisible(),false);assert.equal(await page.locator('#receiptMiniCalGrid .notice-time').first().isVisible(),true);
 await page.locator('#hideNoticeTimes').check();assert.equal(await page.locator('#receiptMiniCalGrid .notice-time').first().isVisible(),false);assert.match(await page.locator('#receiptBody').innerText(),/1회/);
 await page.evaluate(()=>{testSaved=collectCalculatorState();applyCalculatorState(testSaved);FeeCalendar.navigate('notice');});await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#hideNoticeDurations').isChecked(),true);assert.equal(await page.locator('#hideNoticeTimes').isChecked(),true);
 await page.evaluate(()=>{testSmallSnapshot=structuredClone(testSnapshots['2026-10']);testDense=collectCalculatorState();testSnapshots['2026-10']={...testSnapshots['2026-09'],month:'2026-10',lessons:testSnapshots['2026-09'].lessons.map(r=>({...r,date:r.date.replace('2026-09','2026-10')}))};testDense.progress.snapshot=testSnapshots['2026-10'];applyCalculatorState(testDense);FeeCalendar.navigate('notice');});await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#receiptMiniCalGrid .notice-event').count(),81);assert.equal(await page.locator('#receiptBody tr').count(),1);assert.equal(await page.locator('#receiptBody .notice-duration').first().isVisible(),false);
 if(evidence){await page.locator('#captureArea').screenshot({path:path.join(evidence,'hidden-duration.png')});const download=page.waitForEvent('download');await page.locator('#saveNoticeImage').click();const file=await download;await file.saveAs(path.join(evidence,'hidden-duration-export.png'));assert.ok(fs.statSync(path.join(evidence,'hidden-duration-export.png')).size>10000);}
 await page.evaluate(()=>{testSnapshots['2026-10']=testSmallSnapshot;applyCalculatorState(testSaved);FeeCalendar.navigate('notice');});await page.waitForFunction(()=>progressVerified&&!progressLoading);
 });
 await check('absence unknown and old edited charge are excluded; unknown regular charges remain blocked',async()=>{
 await page.evaluate(()=>{
 const absence={id:'absence',date:'2026-10-02',className:'영어-개별(검증)-3h',teacher:'검증',start:'18:00',end:'21:00',minutes:null,amount:null,kind:'absence',forecastMinutes:180,forecastAmount:null};
 testSnapshots['2026-10'].lessons=[absence];testSaved=collectCalculatorState();testSaved.progress.snapshot=testSnapshots['2026-10'];testSaved.progress.edits=[{id:'absence',amount:87500,minutes:0,start:'18:00',end:'21:00'}];applyCalculatorState(testSaved);FeeCalendar.navigate('notice');
 });await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.evaluate(()=>progressResult().actualAmount),0);assert.equal(await page.evaluate(()=>progressResult().pending),0);assert.equal(await page.locator('#dispTotal').innerText(),'87,500원');
 await page.evaluate(()=>{testSnapshots['2026-10'].lessons.push({...testSnapshots['2026-10'].lessons[0],id:'pending',kind:'regular',minutes:180,date:'2026-10-03'});});await page.evaluate(()=>loadProgressLessons({preserveForecast:true}));
 assert.equal(await page.evaluate(()=>progressReady()),false);assert.match(await page.locator('#dispTotal').innerText(),/확인 필요/);
 });
 await check('provisional carry is visible and cannot be imported as confirmed or zero',async()=>{
 await page.evaluate(()=>{testFinancialData={feecalc_intranet_opening:{studentId:'one',month:'2026-10',unresolved:4,rows:[{id:'opening:2026-10',label:'9월 잔액',amount:null,estimateAmount:-237500,kind:'other',fingerprint:'a'.repeat(64),method:'이전 달에서 자동 이월',blocked:'이전 달 수업 4건의 단가·청구 기준을 확인하세요.'}]}};FeeCalendar.navigate('progress');});
 await page.getByRole('button',{name:'인트라넷 잔액 가져오기',exact:true}).click();await page.waitForFunction(()=>document.getElementById('financialSourceRows').textContent.includes('잠정'));
 assert.match(await page.locator('#financialSourceRows').innerText(),/237,500원.*잠정/);assert.equal(await page.locator('#financialSourceRows input').isDisabled(),true);assert.equal(await page.locator('#financialSourceApply').isDisabled(),true);assert.match(await page.locator('#financialSourceRows input').getAttribute('aria-label'),/금액 미확인/);
 if(evidence)await page.screenshot({path:path.join(evidence,'carry-review.png')});await page.getByRole('button',{name:'닫기',exact:true}).click();
 });
 await check('mobile calendar and notice controls fit without page overflow',async()=>{
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(evidence)await page.screenshot({path:path.join(evidence,'planning-mobile.png'),fullPage:true});
 await page.evaluate(()=>FeeCalendar.navigate('notice'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('#messagePaymentType').isVisible(),true);
 });
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>testWrites.length),0);
 if(evidence)fs.writeFileSync(path.join(evidence,'planning-tests.json'),JSON.stringify({browser:browser.version(),results,errors,privateWrites:0},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
