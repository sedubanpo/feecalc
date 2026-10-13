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


 for(const mode of ['auto','progress','payment','guide'])await check('new calculation clears '+mode,async()=>{
 await page.evaluate(mode=>{switchTab(mode);setAdjustmentItems([{label:'9월 이월금',amount:-50000,kind:'carry'},{label:'초과금',amount:10000,kind:'extra'}]);handleAdjustmentInput();},mode);
 await page.getByRole('button',{name:'새 계산',exact:true}).click();
 await page.waitForTimeout(100);
 const state=await page.evaluate(()=>({items:collectAdjustmentItems(true),total:document.getElementById('adjustment').value,summary:document.getElementById('dispAdjRow').innerText,saved:collectCalculatorState()}));
 assert.deepEqual(state.items,[]);assert.equal(state.total,'0');assert.doesNotMatch(state.summary,/50,000|10,000/);assert.deepEqual(state.saved.adjustmentItems,[]);
 });
 await check('reset cancels in-flight carry import even when same student is selected again',async()=>{
 await page.evaluate(()=>{applyCalculatorState({studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,currentTab:'auto'});window.testFinancialData={feecalc_intranet_opening:{studentId:'one',month:'2026-09',rows:[{id:'opening',label:'8월 이월금',amount:-50000,kind:'carry',fingerprint:'a'.repeat(64)}]}};});
 await page.getByRole('button',{name:'인트라넷 잔액 가져오기',exact:true}).click();
 await page.locator('#financialSourceRows input').check();
 await page.evaluate(()=>{testFinancialDelay=true;});
 await page.locator('#financialSourceApply').click();
 await page.waitForFunction(()=>typeof testFinancialResolve==='function');
 await page.evaluate(()=>{resetCalculatorForNewStart();applyCalculatorState({studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:9,currentTab:'auto'});testFinancialResolve();});
 await page.waitForTimeout(100);
 assert.deepEqual(await page.evaluate(()=>collectAdjustmentItems()),[]);assert.equal(await page.locator('#financialSourceDialog').count(),0);
 });
 await check('message hides zero discount and preserves real discounts',async()=>{
 const texts=await page.evaluate(()=>{const result={actual:[],predicted:[],actualAmount:100000,predictedAmount:0};return [buildProgressMessage(result,100000,{amount:0,rate:0}),buildProgressMessage(result,90000,{amount:10000,rate:10}),buildProgressMessage({...result,actual:[{amount:70000,discountParts:[{base:100000,amount:70000,percent:30,special:false}]}]},70000,{amount:0,rate:0})];});
 assert.doesNotMatch(texts[0],/할인/);assert.match(texts[1],/추가 할인.*10,000원/);assert.match(texts[2],/30% 할인/);assert.doesNotMatch(texts[2],/추가 할인/);
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));
 }finally{await browser.close();server.close();}
})();
