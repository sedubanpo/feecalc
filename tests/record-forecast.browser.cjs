// Isolated browser + mocked authentication/RPC. External app services are blocked.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUTPUT||'/tmp/feecalc-record-forecast';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':/\.(m?js)$/.test(file)?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 }).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'}),page=await context.newPage(),errors=[],blocked=[];
 await context.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-10-09T03:00:00Z']));}static now(){return new D('2026-10-09T03:00:00Z').getTime();}};});
 const allowed=['127.0.0.1','cdn.tailwindcss.com','html2canvas.hertzen.com','fonts.googleapis.com','fonts.gstatic.com'];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(allowed.includes(url.hostname))return route.continue();
  blocked.push(url.hostname);return route.abort();
 });
 await context.route('**/auth-client.mjs*',r=>r.fulfill({contentType:'text/javascript',body:`export async function initializeAuth(onState){
  window.qaCalls=[];const gateway={rpc:async(name,params)=>{qaCalls.push({name,params});
  if(name==='feecalc_students')return{data:[{id:'one',name:'검증학생',school:'가학교'},{id:'two',name:'동명학생',school:'나학교'},{id:'three',name:'동명학생',school:'다학교'}]};
  if(name==='feecalc_progress')return{data:window.qaSnapshot||{studentId:params.p_student_id,month:params.p_month,lessons:[]}};
  if(name==='feecalc_get_app_settings')return{data:{rateLibrary:[]}};
  return{data:[]};}};
  queueMicrotask(()=>onState({state:'ready',actor:{uid:'qa',name:'검증 직원'},user:{uid:'qa'},gateway}));return{gateway};}` }));
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>registryState==='ready'&&typeof FeeCalendar!=='undefined');
  await page.evaluate(()=>{
   const row=(recordId,studentName,savedAt,totalText,payload=null)=>({recordId,studentName,savedAt,totalText,payload,targetYear:2026,targetMonth:10,currentTab:'progress'});
   window.qaRecords=[row('v1','검증학생','2026-10-09T05:00:00Z','360,000원',{studentId:'one'}),row('v2','검증학생','2026-10-08T05:00:00Z','300,000원',{studentId:'one'}),row('v3','검증학생','2026-10-07T05:00:00Z','280,000원',{studentId:'one'}),row('dup-a','동명학생','2026-10-06','100,000원',{studentId:'two'}),row('dup-b','동명학생','2026-10-05','200,000원',{studentId:'three'}),row('dup-c','동명학생','2026-10-04','90,000원')];
   serverRecordHistory=qaRecords;renderServerRecordList();
   window.open=url=>window.qaOpened=new URL(url).searchParams.get('recordId');
  });
  assert.equal(await page.locator('.record-folder').count(),2);
  const first=page.locator('.record-folder').first(),tabs=first.getByRole('tab');
  const calls=await page.evaluate(()=>qaCalls.length);
  await tabs.nth(1).click();assert.equal(await first.locator('.record-amount').innerText(),'300,000원');
  await first.locator('.record-open-btn').click();assert.equal(await page.evaluate(()=>qaOpened),'v2');
  assert.equal(await page.evaluate(()=>qaCalls.length),calls);
  await tabs.nth(1).focus();await page.keyboard.press('End');assert.equal(await tabs.last().getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await tabs.first().getAttribute('aria-selected'),'true');
  await page.evaluate(()=>{currentLoadedRecordId='v3';renderServerRecordList();});
  assert.equal(await first.locator('.record-amount').innerText(),'280,000원');
  // Same names remain independent records; school follows the selected payload.
  const duplicate=page.locator('.record-folder').nth(1);
  assert.equal(await duplicate.locator('.school-label').innerText(),'나학교');
  await duplicate.getByRole('tab').nth(1).click();assert.equal(await duplicate.locator('.school-label').innerText(),'다학교');
  await duplicate.getByRole('tab').nth(2).click();assert.match(await duplicate.locator('.school-label').innerText(),/동명이인/);
  await first.locator('.record-delete-btn').click();
  assert.equal(await page.evaluate(()=>qaCalls.filter(c=>c.name==='feecalc_delete_record').at(-1).params.p_record_id),'v3');
  assert.equal(await first.getByRole('tab').count(),2);assert.equal(await page.evaluate(()=>serverRecordHistory.some(r=>r.recordId==='v2')),true);
  // Source search narrows folders; restored results retain each surviving version.
  await page.evaluate(()=>{serverRecordHistory=qaRecords.filter(r=>r.studentName==='동명학생');renderServerRecordList();});
  assert.equal(await page.locator('.record-folder').count(),1);
  await page.evaluate(()=>{serverRecordHistory=qaRecords;renderServerRecordList();});
  assert.equal(await page.locator('.record-folder').count(),2);
  await page.evaluate(()=>{
   const row=(id,date,extra={})=>({id,date,className:'수학-개별-검증강사',teacher:'검증강사',kind:'regular',start:'16:00',end:'18:00',minutes:120,amount:60000,...extra});
   qaSnapshot={studentId:'one',month:'2026-10',fetchedAt:'2026-10-09T03:00:00Z',lessons:[row('mon','2026-10-05'),row('wed','2026-10-07'),row('fri','2026-10-09'),row('makeup','2026-10-06',{kind:'absenceMakeup',start:'13:00',end:'15:00',amount:45000})]};
   applyCalculatorState({currentTab:'progress',studentId:'one',studentName:'검증학생',targetYear:2026,targetMonth:10,progress:{snapshot:qaSnapshot,mode:'auto',cutoff:'2026-10-09',endDate:'2026-10-16'}});FeeCalendar.navigate('progress');
  });
  await page.waitForFunction(()=>progressVerified&&!progressLoading);
  assert.deepEqual(await page.evaluate(()=>progressResult().predicted.map(r=>r.date)),['2026-10-12','2026-10-14','2026-10-16']);
  assert.equal(await page.evaluate(()=>progressResult().actualAmount),225000);
  assert.match(await page.locator('#progressMakeupNotice').innerText(),/보강·보충 1건/);
  await page.evaluate(()=>{document.getElementById('recordsDock').scrollTop=0;window.scrollTo(0,0);});
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  assert.equal(await page.locator('.record-folder').first().evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  for(let i=0;i<3;i++){
   const tab=page.locator('.record-folder').first().getByRole('tab').nth(i);await tab.click();assert.equal(await tab.getAttribute('aria-selected'),'true');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'pass',checks:['folders + version metadata','open/delete exact version','zero RPC for tab switches','keyboard and loaded selection','same-name identity labels','search/rerender','makeup forecast + actual amount','desktop/mobile layout'],pageErrors:errors,blockedHosts:[...new Set(blocked)]},null,2));
  console.log('PASS isolated browser checks; screenshots: '+out);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
