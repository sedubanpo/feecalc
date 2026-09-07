const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),evidence=process.env.EVIDENCE_ROOT;
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+'/'))return res.writeHead(403).end();try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ko-KR'}),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
 // All private service access is synthetic; never use user accounts or write production data.
 await page.route('**/*.cloudfunctions.net/**',r=>r.abort());await page.route('**/*.supabase.co/**',r=>r.abort());
 await page.route('**/auth-client.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export async function initializeAuth(onState){
 window.testWrites=[];window.testSettings={rateLibrary:[{type:'개별정규',unit:'perClass',amount:62500},{type:'1:1',unit:'perHour',amount:100000}]};
 const gateway={rpc:async(rpc,params)=>{if(window.testFail)return{error:{message:'가상 네트워크 오류'}};
 if(rpc==='feecalc_students')return{data:[{id:'one',name:'검증학생',school:'검증중',grade:'2'},{id:'two',name:'동명학생',school:'가학교',grade:'1'},{id:'three',name:'동명학생',school:'나학교',grade:'2'}]};
 if(rpc==='feecalc_student_memos')return{data:[{memo:'가상 안내 주의 메모 <script>안전한 텍스트</script>',createdAt:'2026-09-07',author:'검증 직원'}]};
 if(rpc==='feecalc_get_app_settings')return{data:window.testSettings};
 if(rpc==='feecalc_save_app_settings'){window.testSettings=params.p_settings;return{data:{}};}
 if(rpc==='feecalc_save_record'||rpc==='feecalc_update_record'){window.testWrites.push(params);return{data:{record_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',saved_at:new Date().toISOString()}};}
 return{data:[]};}};
 queueMicrotask(()=>onState({state:'ready',actor:{uid:'qa',name:'검증'},user:{uid:'qa'},gateway}));return{gateway};}` }));
 const check=async(name,fn)=>{await fn();results.push({name,result:'pass'});console.log('PASS',name);};
 try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>registryState==='ready');
 await check('deprecated controls removed',async()=>{assert.equal(await page.locator('#recordMemoInput,#coreDataArea').count(),0);});
 await check('temporary name calculates but does not save',async()=>{await page.locator('#studentName').fill('임시학생');await page.evaluate(()=>saveServerRecord());assert.equal(await page.evaluate(()=>testWrites.length),0);assert.match(await page.locator('#studentMatchStatus').innerText(),/임시 학생/);});
 await check('canonical identity, duplicate selection and safe read-only memo',async()=>{
 await page.locator('#studentName').fill('동명학생');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>matchedStudent()),null);await page.locator('#studentMatches button').last().click();assert.equal(await page.evaluate(()=>collectCalculatorState().studentId),'three');
 await page.locator('#studentName').fill('검증학생');await page.waitForFunction(()=>document.getElementById('studentMemoWidgetBody').textContent.includes('가상 안내 주의'));
 assert.equal(await page.locator('#studentMemoWidgetBody script').count(),0);assert.equal(await page.locator('#captureArea #studentMemoWidget').count(),0);
 await page.evaluate(()=>saveServerRecord());assert.equal(await page.evaluate(()=>testWrites.at(-1).p_payload.studentId),'one');
 });
 await check('grouped shared price persistence and per-hour application',async()=>{
 await page.locator('[onclick="togglePricePresetSettings()"]').click();await page.locator('#pricePresetType').selectOption('컨설팅');await page.locator('#pricePresetUnit').selectOption('perHour');await page.locator('#pricePresetInput').fill('150000');await page.locator('[onclick="addPricePreset()"]').click();await page.evaluate(()=>savePriceLibrary());
 assert.ok(await page.evaluate(()=>testSettings.rateLibrary.some(x=>x.type==='컨설팅'&&x.amount===150000&&x.unit==='perHour')));
 await page.locator('.auto-row .row-price-type').first().selectOption('컨설팅');await page.locator('.auto-row .row-price-value').first().selectOption({label:'150,000원 · 시간당'});assert.equal(await page.locator('.auto-row .rate-mode').first().inputValue(),'perHour');assert.equal(await page.locator('.auto-row .sub-rate').first().inputValue(),'150000');
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
 if(evidence && !process.env.SKIP_VISUAL){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'desktop.png'),fullPage:true});await page.locator('#captureArea').screenshot({path:path.join(evidence,'receipt.png')});}
 await page.setViewportSize({width:390,height:844});
 if(evidence && !process.env.SKIP_VISUAL)await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
 await check('mobile no horizontal page overflow',async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
 await check('intermediate and breakpoint overflow',async()=>{for(const width of [600,601,768,1279,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),String(width));}});
 await check('IME composition does not match or fetch partial names',async()=>{await page.evaluate(()=>{beginStudentNameComposition();handleStudentNameInput();});assert.equal(await page.evaluate(()=>matchedStudent()),null);await page.evaluate(()=>{studentNameComposing=false;handleStudentNameInput();});assert.equal(await page.evaluate(()=>matchedStudent().id),'one');});
 assert.deepEqual(errors,[]);
 if(evidence)fs.writeFileSync(path.join(evidence,'ui-tests.json'),JSON.stringify({browser:browser.version(),results,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
