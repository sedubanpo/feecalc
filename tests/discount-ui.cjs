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
 await check('applied intranet discount is visible without double deduction',async()=>{
 await page.evaluate(()=>{
 window.testNow='2026-10-13T03:00:00Z';
 const dates=[['과학','김이천','02'],['과학','김이천','09'],['국어','배유진','07'],['수학','김광수','03'],['수학','김광수','05'],['수학','김광수','10'],['수학','김광수','12']];
 testProgressSnapshot={studentId:'one',month:'2026-10',fetchedAt:'2026-10-13',lessons:dates.map(([subject,teacher,day],i)=>({id:'lesson'+i,date:'2026-10-'+day,className:subject+'-개별-'+teacher,teacher,start:'10:00',end:'13:00',minutes:180,amount:59063,kind:'regular',discountParts:[{base:84375,amount:59063,percent:30,special:false}]}))};
 applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,progress:{snapshot:testProgressSnapshot,mode:'auto',cutoff:'2026-10-12',endDate:'2026-10-31'}});FeeCalendar.navigate('progress');
 });
 await page.waitForFunction(()=>progressVerified&&!progressLoading);
 assert.equal(await page.locator('#dispTotal').innerText(),'1,063,134원');
 assert.match(await page.locator('#workCalendar').innerText(),/30% 할인 적용 · 84,375원 → 59,063원/);
 await page.getByRole('button',{name:'안내서',exact:true}).click();
 assert.match(await page.locator('#receiptBody').innerText(),/30% 할인 적용/);
 assert.match(await page.locator('#sourceDiscountSummary').innerText(),/1,518,750원 → 1,063,134원/);
 assert.match(await page.locator('#generatedTextArea').inputValue(),/인트라넷 30% 할인 반영/);
 assert.doesNotMatch(await page.locator('#generatedTextArea').inputValue(),/추가 할인 \(계산기\)/);
 assert.match(await page.locator('#generatedTextArea').inputValue(),/월 예상 납부액: 1,063,134원/);
 await page.evaluate(()=>{window.copiedNotice=null;Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:async items=>{window.copiedNotice=await items[0].getType('image/png');}});});
 await page.locator('#copyNoticeImage').click();await page.waitForFunction(()=>!!window.copiedNotice);
 if(evidence){fs.mkdirSync(evidence,{recursive:true});const png=await page.evaluate(async()=>Array.from(new Uint8Array(await copiedNotice.arrayBuffer())));fs.writeFileSync(path.join(evidence,'discount-export.png'),Buffer.from(png));}
 const saved=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>applyCalculatorState(s),saved);await page.waitForFunction(()=>progressVerified&&!progressLoading);assert.equal(await page.locator('#dispTotal').innerText(),'1,063,134원');
 await page.evaluate(()=>{document.getElementById('discountRate').value=10;updateAll();FeeCalendar.refresh();});
 assert.equal(await page.locator('#dispTotal').innerText(),'956,821원');assert.match(await page.locator('#sourceDiscountSummary').innerText(),/1,063,134원/);
 });
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>testWrites.length),0);
 if(evidence)fs.writeFileSync(path.join(evidence,'discount-ui-tests.json'),JSON.stringify({results,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
