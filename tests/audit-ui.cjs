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
 const check=async(name,fn)=>{try{await fn();results.push({name,result:'pass'});console.log('PASS',name);}catch(e){results.push({name,result:'fail',error:e.message});console.log('FAIL',name,e.message);}};
 try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>registryState==='ready');

 await check('percentage labels never get concatenated into discount amounts',async()=>{
 for(const rate of [10,2.5]){
 await page.evaluate(rate=>{applyCalculatorState({version:8,currentTab:'select',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,discountRate:rate,selectRows:[{name:'수학-개별(A)-2h',hours:2,rate:100000,dates:[1]}]});FeeCalendar.navigate('notice');},rate);
 assert.equal(await page.locator('#dispDiscount').innerText(),rate===10?'−10,000원 (10%)':'−2,500원 (2.5%)');
 assert.equal(await page.locator('#dispTotal').innerText(),rate===10?'90,000원':'97,500원');
 await page.evaluate(()=>FeeCalendar.refresh());
 assert.equal(await page.locator('#dispDiscount').innerText(),rate===10?'−10,000원 (10%)':'−2,500원 (2.5%)');
 }
 });
 await check('unknown scheduled rates cannot produce or copy a partial payment notice',async()=>{
 for(const mode of ['auto','select']){
 await page.evaluate(mode=>{applyCalculatorState({version:8,currentTab:mode,studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,[mode+'Rows']:[{name:'수학-개별(A)-2h',hours:2,rate:50000,rateKnown:true,days:[1],dates:[1]},{name:'영어-개별(B)-2h',hours:2,rate:0,rateKnown:false,days:[1],dates:[1]}]});FeeCalendar.navigate('notice');},mode);
 assert.match(await page.locator('#generatedTextArea').inputValue(),/확인/);
 assert.equal(await page.locator('[onclick="copyGeneratedText()"]').isDisabled(),true);
 assert.match(await page.locator('#dispSubtotal').innerText(),/확인/);
 }
 });
 await check('unknown history charges cannot produce or copy a partial settlement message',async()=>{
 await page.evaluate(()=>{applyCalculatorState({currentTab:'history',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,historyData:[{year:2026,month:10,day:1,subject:'수학-개별(A)-2h',teacher:'A',attend:'출석',hours:2,amount:null,amountPending:true,originalAmount:null,startTime:'12:00',endTime:'14:00'}]});FeeCalendar.navigate('notice');});
 assert.match(await page.locator('#generatedTextArea').inputValue(),/확인/);
 assert.equal(await page.locator('[onclick="copyGeneratedText()"]').isDisabled(),true);
 });
 await page.evaluate(()=>{
 window.auditLessons=Array.from({length:81},(_,i)=>({id:'audit-'+i,date:'2026-09-'+String(1+Math.floor(i/3)).padStart(2,'0'),className:['사회','사탐','통합사회'][i%3]+'-1:1(긴이름검증강사)-2h',teacher:i%2?'다른강사':'긴이름검증강사',minutes:120,amount:37500,start:['10:00','13:00','16:00'][i%3],end:['12:00','15:00','18:00'][i%3],kind:'regular'}));
 window.testProgressSnapshot={studentId:'one',month:'2026-09',fetchedAt:'2026-10-03T00:00:00Z',lessons:auditLessons};
 window.testFinancialData={feecalc_desk_payments:{studentId:'one',month:'2026-09',rows:[{id:'receipt',label:'9월 기수납액',amount:-2287500,kind:'other',fingerprint:'a'.repeat(64)}]},feecalc_intranet_opening:{studentId:'one',month:'2026-09',rows:[{id:'opening',label:'8월 잔액',amount:0,kind:'other',fingerprint:'b'.repeat(64)}]}};
 applyCalculatorState({currentTab:'auto',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,autoRows:[{name:'수학-개별(A)-2h',rate:50000,hours:2,days:[1]}]});FeeCalendar.navigate('notice');window.auditWrites=testWrites.length;
 });
 await page.locator('#loadPriorNotice').click();await page.waitForFunction(()=>document.querySelectorAll('#priorNoticePaper .notice-event').length===81);
 await check('previous-month edits preserve expanded editor and keyboard focus',async()=>{
 await page.locator('#priorEditors details').first().evaluate(e=>e.open=true);
 const amount=page.getByLabel('실제 수업 1 금액 (원)',{exact:true});await amount.fill('40000');await amount.press('Tab');
 await page.waitForTimeout(100);
 assert.equal(await page.getByLabel('실제 수업 1 과목',{exact:true}).evaluate(e=>document.activeElement===e),true);
 await page.locator('#hideNoticeTimes').check();
 assert.equal(await page.locator('#priorEditors details').first().evaluate(e=>e.open),true);
 await page.locator('#hideNoticeTimes').uncheck();
 });
 await check('previous-month schedule edits preserve independent billed hours and reject reversed times',async()=>{
 await page.locator('#priorEditors details').first().evaluate(e=>e.open=true);
 const start=page.getByLabel('실제 수업 1 시작 시간',{exact:true});await start.fill('11:00');await start.press('Tab');await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>collectCalculatorState().calendarWorkspace.priorNotice.lessons[0].hours),2);
 await page.locator('#priorEditors details').first().evaluate(e=>e.open=true);
 const end=page.getByLabel('실제 수업 1 종료 시간',{exact:true});await end.fill('09:00');await end.press('Tab');await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>collectCalculatorState().calendarWorkspace.priorNotice.lessons[0].end),'12:00');
 });
 await check('unknown previous-month duration remains unknown and does not become zero hours',async()=>{
 await page.evaluate(()=>{testProgressSnapshot.lessons[0].minutes=null;testProgressSnapshot.lessons[0].start='';testProgressSnapshot.lessons[0].end='';});
 await page.locator('#loadPriorNotice').click();await page.waitForFunction(()=>document.querySelector('#priorNoticeStatus').textContent.includes('원본 조회 완료'));
 assert.equal(await page.evaluate(()=>collectCalculatorState().calendarWorkspace.priorNotice.lessons[0].hours),null);
 assert.match(await page.locator('#priorNoticePaper .notice-event').first().innerText(),/시간 확인 필요/);
 assert.equal(await page.locator('[data-prior-export=copy]').isDisabled(),true);
 });
 await check('previous-month calendar cards fit on mobile with long subjects and teachers',async()=>{
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('#priorNoticePaper').evaluate(host=>[...host.querySelectorAll('.notice-event')].every(e=>e.scrollWidth<=e.clientWidth+1)));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.locator('#priorNoticeSection').screenshot({path:path.join(evidence,'audit-prior-mobile.png')});}
 const scroll=page.locator('#priorNoticePaper .notice-calendar-scroll');await scroll.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert.ok(await scroll.evaluate(e=>e.scrollLeft>0));
 await page.setViewportSize({width:1920,height:1100});
 if(evidence)await page.locator('#priorNoticeSection').screenshot({path:path.join(evidence,'audit-prior-desktop.png')});
 });
 await check('previous-month source records remain unchanged through editing',async()=>{
 assert.equal(await page.evaluate(()=>testProgressSnapshot.lessons[0].amount),37500);
 assert.equal(await page.evaluate(()=>testWrites.length),await page.evaluate(()=>auditWrites));
 });

 await check('explicit zero rate enables accurate text copying without clearing the other course',async()=>{
 await page.evaluate(()=>{applyCalculatorState({version:8,currentTab:'select',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,selectRows:[{name:'수학-개별(A)-2h',hours:2,rate:50000,rateKnown:true,dates:[1]},{name:'영어-개별(B)-2h',hours:2,rate:0,rateKnown:false,dates:[1]}]});FeeCalendar.navigate('notice');window.auditTextCopies=[];Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>auditTextCopies.push(text)});});
 await page.evaluate(()=>copyGeneratedText());assert.equal(await page.evaluate(()=>auditTextCopies.length),0);
 await page.evaluate(()=>{const input=document.querySelectorAll('#selectList .sub-rate')[1];input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));updateAll();FeeCalendar.refresh();});
 assert.equal(await page.locator('[onclick="copyGeneratedText()"]').isEnabled(),true);
 assert.match(await page.locator('#generatedTextArea').inputValue(),/50,000/);await page.locator('[onclick="copyGeneratedText()"]').click();assert.equal(await page.evaluate(()=>auditTextCopies.length),1);
 });
 await check('previous-month edits have one-step undo and restored drafts do not alias caller data',async()=>{
 await page.evaluate(()=>{testProgressSnapshot.lessons=structuredClone(auditLessons);FeeCalendar.navigate('notice');});
 await page.locator('#loadPriorNotice').click();await page.waitForFunction(()=>document.querySelectorAll('#priorNoticePaper .notice-event').length===81);
 const before=await page.evaluate(()=>JSON.stringify(collectCalculatorState().calendarWorkspace.priorNotice));
 await page.locator('#priorEditors details').first().evaluate(e=>e.open=true);
 const amount=page.getByLabel('실제 수업 1 금액 (원)',{exact:true});await amount.fill('44000');await amount.press('Tab');
 await page.evaluate(()=>FeeCalendar.navigate('calculate'));await page.locator('#undoCalendar').click();await page.evaluate(()=>FeeCalendar.navigate('notice'));
 assert.equal(await page.evaluate(()=>JSON.stringify(collectCalculatorState().calendarWorkspace.priorNotice)),before);
 await page.evaluate(()=>{window.auditSaved=collectCalculatorState();applyCalculatorState(auditSaved);FeeCalendar.navigate('notice');});
 await page.locator('#priorEditors details').first().evaluate(e=>e.open=true);await amount.fill('45000');await amount.press('Tab');
 assert.equal(await page.evaluate(()=>auditSaved.calendarWorkspace.priorNotice.lessons[0].amount),37500);
 });

 await check('previous-month query date uses the academy Korean date',async()=>{
 await page.evaluate(()=>{const data=collectCalculatorState();data.calendarWorkspace.priorNotice.fetchedAt='2026-10-02T16:00:00Z';applyCalculatorState(data);FeeCalendar.navigate('notice');});
 assert.match(await page.locator('#priorNoticePaper .prior-context').innerText(),/2026-10-03 조회/);
 });
 await check('malformed previous-month drafts are rejected before changing the calculator',async()=>{
 const result=await page.evaluate(()=>{const before=JSON.stringify(collectCalculatorState()),dirty=hasUnsavedCalculatorChanges(),bad=collectCalculatorState();bad.studentName='INVALID';bad.calendarWorkspace.priorNotice.lessons=[null];let rejected=false;try{applyCalculatorState(bad);}catch{rejected=true;}return{rejected,preserved:JSON.stringify(collectCalculatorState())===before,dirtyPreserved:dirty===hasUnsavedCalculatorChanges()};});
 assert.deepEqual(result,{rejected:true,preserved:true,dirtyPreserved:true});
 });
 await check('previous-month paper does not inherit current progress forecast totals',async()=>{
 await page.evaluate(()=>{const data=collectCalculatorState();data.currentTab='progress';data.progress={snapshot:{studentId:'one',month:'2026-10',fetchedAt:'2026-10-03T00:00:00Z',lessons:[]},mode:'auto',cutoff:'2026-10-01',endDate:'2026-10-31',excluded:[],manual:[]};testProgressSnapshot=structuredClone(data.progress.snapshot);applyCalculatorState(data);FeeCalendar.navigate('notice');});
 assert.equal(await page.locator('#priorNoticePaper [data-receipt-part=progressCalendarLegend]').count(),0);
 assert.equal(await page.locator('#priorNoticePaper .notice-event').count(),81);
 });

 await check('timetable view keeps the independent previous-month fee summary visible',async()=>{
 await page.evaluate(()=>{FeeCalendar.navigate('timetable');document.getElementById('viewNotice').click();});
 assert.equal(await page.locator('#priorNoticePaper .receipt-left').isVisible(),true);
 assert.equal(await page.locator('#priorNoticePaper .notice-event').count(),81);
 });
 await check('state changes during PNG encoding cannot release a stale notice',async()=>{
 await page.evaluate(()=>{window.auditOriginalCanvas=html2canvas;window.auditOriginalBlob=HTMLCanvasElement.prototype.toBlob;window.auditImageCopies=0;html2canvas=async()=>{const c=document.createElement('canvas');c.width=10;c.height=10;return c;};HTMLCanvasElement.prototype.toBlob=function(callback){document.getElementById('studentName').value='변경학생';auditOriginalBlob.call(this,callback,'image/png');};Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:async()=>auditImageCopies++});});
 await page.evaluate(()=>FeeCalendar.exportNotice(document.getElementById('priorNoticePaper'),'copy'));
 assert.match(await page.locator('#imageOutputStatus').innerText(),/바뀌었/);assert.equal(await page.evaluate(()=>auditImageCopies),0);
 await page.evaluate(()=>{html2canvas=auditOriginalCanvas;HTMLCanvasElement.prototype.toBlob=auditOriginalBlob;document.getElementById('studentName').value='검증학생';syncStudentMatch(false);FeeCalendar.refresh();});
 });
 assert.deepEqual(errors,[]);
 if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'audit-ui-tests.json'),JSON.stringify({browser:browser.version(),results,errors},null,2));}
 assert.ok(results.every(r=>r.result==='pass'),'Audit regressions failed');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
