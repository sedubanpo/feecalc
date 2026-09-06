// Run with Node and Playwright available in NODE_PATH. Never uses a real student record.
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const evidence = process.env.EVIDENCE_ROOT;

(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/baseline') { res.setHeader('Content-Type','text/html'); res.end(execFileSync('git',['show','5571e45:index.html'],{cwd:root})); return; }
    const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { res.end(fs.readFileSync(file)); } catch { res.writeHead(404).end(); }
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, locale: 'ko-KR'});
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*.supabase.co/**', route => route.fulfill({status: 200, contentType: 'application/json', body: '[]'}));
  // Exercise calculator regressions with a synthetic authorized session only.
  await page.route('**/auth-client.mjs', route => route.fulfill({status: 200, contentType: 'text/javascript', body: `
    export async function initializeAuth(onState) {
      const gateway = {rpc: async () => ({data: [], error: null})};
      const notify = () => onState({state:'ready', actor:{uid:'synthetic',name:'검증'}, user:{uid:'synthetic'}, gateway});
      queueMicrotask(notify);
      return {gateway,retry:notify,logout:async()=>{},login:async()=>{}};
    }
  `}));
  const check = async (name, fn) => { await fn(); results.push({name, result: 'pass'}); console.log('PASS', name); };
  try {
    await page.goto(process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`, {waitUntil: 'networkidle'});
    await check('confirmed zero, missing amount, time parsing', async () => {
      assert.deepEqual(await page.evaluate(() => [getHistoryCharge('regular', 0, 100000, 2, '12:00','14:00'), getHistoryCharge('regular', null, 100000, 2, '', ''), parseAccessTime('12:30'), parseAccessTime('오전 12:30'), parseAccessTime('오후 12:30'), parseAccessTime('bad'), getAccessScheduledHours('', ''), getAccessScheduledHours('12:00','12:00')]), [0,200000,'12:30','0:30','12:30','',0,0]);
    });
    await check('nine modes: render, nonzero totals, state roundtrip', async () => {
      const result = await page.evaluate(() => {
        const fixture = {studentName:'검증학생', targetYear:2026,targetMonth:8,adjustmentItems:[{label:'이월',amount:-1000},{label:'초과',amount:2000}],
          autoRows:[{name:'수학-개별(검증강사)-2h',hours:2,rate:62500,rateMode:'perClass',days:[1]}],
          selectRows:[{name:'수학-1:1(검증강사)-2h',hours:2,rate:100000,rateMode:'perClass',dates:[1,8,15,22]}],
          manualRows:[{name:'영어-개별(검증강사)-2h',time:2,count:3,rate:30000,rateMode:'perHour'}],
          guideRows:[{name:'검증학생',baseAmount:300000,adjustment:0}],
          firstRows:[{name:'국어-개별(검증강사)-2h',weekdays:[1],hours:2,rate:60000,rateMode:'perClass',startDate:'2026-08-01'}],
          ttRows:[{day:1,subject:'수학-개별(검증강사)-2h',start:12,duration:2,rateMode:'perClass',price:60000}],
          historyData:[{year:2026,month:8,day:1,subject:'수학-개별(검증강사)-2h',teacher:'검증강사',attend:'출석',hours:2,amount:62500,originalAmount:62500,startTime:'12:00',endTime:'14:00'}],
          aiData:[{name:'수학',day:1,year:2026,month:8,type:'existing',amount:60000}],
          paymentRows:[{type:'class',name:'수학',amount:60000,discount:0}]};
        return ['auto','select','manual','guide','first','timetable','history','ai','payment'].map(mode => {
          applyCalculatorState({...fixture,currentTab:mode});
          const total = document.getElementById('dispTotal')?.innerText;
          const snapshot=collectCalculatorState(); applyCalculatorState(snapshot);
          return {mode,total,restored:document.getElementById('dispTotal')?.innerText};
        });
      });
      for(const row of result) { assert.ok(row.total && row.total !== '0원', JSON.stringify(row)); assert.equal(row.total,row.restored,row.mode); }
      console.log(JSON.stringify(result));
    });
    await check('history invalid paste preserves data; zero remains free', async () => {
      const result=await page.evaluate(() => {
        switchTab('history');
        document.getElementById('historyPasteInput').value='1\t8/1(토)\t수학-개별(검증)-2h\t반포\t출석\t검증\t12:00\t14:00\t2\t100,000\t0';
        processHistoryPaste(); const amount=historyData[0].amount;
        document.getElementById('historyPasteInput').value='invalid'; processHistoryPaste();
        return [amount,historyData.length,document.getElementById('dispTotal').innerText];
      }); assert.deepEqual(result,[0,1,'1,000원']);
    });
    await check('AI uses amount column, selected month, comments, observed cutoff', async () => {
      const result=await page.evaluate(() => {
        switchTab('ai'); document.getElementById('targetMonth').value=8;
        document.getElementById('aiPasteInput').value=[
          '90001\t8/1(토)\t수학\t반포\t출석\t검증\t12:00\t13:00\t1\t100,000\t50,000\t\t결제 확인',
          '90002\t7/2(목)\t수학\t반포\t출석\t검증\t12:00\t13:00\t1\t100,000\t80,000',
          '90003\t8/31(월)\t수학\t반포\t결석예고\t검증\t12:00\t13:00\t0\t100,000\t0'].join('\n');
        processAiPrediction(); return aiData.map(d=>[d.amount,d.day,d.month,d.type]);
      }); assert.deepEqual(result,[[50000,1,8,'existing']]);
    });
    await check('payment classification, small discounts, invalid paste, legacy edits', async () => {
      const result=await page.evaluate(() => {
        switchTab('payment'); document.getElementById('paymentPasteInput').value='이름\t항목\t반명\t■금액\t할인\t참고\n검증\t\t수학\t60,000\t500\t결제 확인\n검증\t이월금\t\t-10,000\t\t';
        processPaymentPaste(); const rows=collectPaymentRows();
        document.getElementById('paymentPasteInput').value='invalid';processPaymentPaste();const preserved=collectPaymentRows();
        const saved=collectCalculatorState(); saved.paymentRows[0].amount=12345; saved.rawInputs.paymentPasteInput='이름\t반명\t■금액\n검증\t수학\t99999'; applyCalculatorState(saved);
        return {types:rows.map(r=>r.type),discount:rows[0].discount,preserved:preserved.length,edited:collectPaymentRows()[0].amount,total:document.getElementById('dispTotal').innerText};
      }); assert.deepEqual(result.types,['class','adjustment']);assert.equal(result.discount,500);assert.equal(result.preserved,2);assert.equal(result.edited,12345);assert.ok(result.total);
    });
    await check('malformed saved data rejected before mutation',async()=>{
      assert.equal(await page.evaluate(()=>{const before=document.getElementById('studentName').value;try{applyCalculatorState({studentName:'INVALID',autoRows:{}});}catch{}return document.getElementById('studentName').value===before;}),true);
    });
    await check('search response ordering',async()=>{
      assert.deepEqual(await page.evaluate(async()=>{
        const original=fetchServerRecordRows;const pending={};fetchServerRecordRows=(_c,k)=>new Promise(resolve=>pending[k]=resolve);
        const input=document.getElementById('serverRecordSearch');input.value='old';const old=refreshServerRecordList();input.value='new';const latest=refreshServerRecordList();pending.new({rows:[{record_id:'new',student_name:'new'}]});await latest;pending.old({rows:[{record_id:'old',student_name:'old'}]});await old;fetchServerRecordRows=original;return serverRecordHistory.map(r=>r.recordId);
      }),['new']);
    });
    await check('save snapshot and duplicate submission guard (mock RPC)',async()=>{
      const data=await page.evaluate(async()=>{
        const originalClient=supabaseClient, originalSettings=saveSharedAppSettingsToServer, originalRefresh=refreshServerRecordList;
        let release;const calls=[];saveSharedAppSettingsToServer=()=>new Promise(r=>release=r);refreshServerRecordList=async()=>{};
        supabaseClient={rpc:async(name,params)=>{calls.push({name,params});return{data:{record_id:'test',saved_at:new Date().toISOString()}};}};
        currentLoadedRecordId='before';const amount=document.getElementById('dispTotal').innerText;
        const first=saveServerRecord('update');const second=saveServerRecord('update');document.getElementById('dispTotal').innerText='999원';release();await Promise.all([first,second]);
        supabaseClient=originalClient;saveSharedAppSettingsToServer=originalSettings;refreshServerRecordList=originalRefresh;
        return {count:calls.length,id:calls[0].params.p_record_id,total:calls[0].params.p_total_text,amount};
      }); assert.equal(data.count,1);assert.equal(data.id,'before');assert.equal(data.total,data.amount);
    });
    await check('cancellation display reversible, money and original retained',async()=>{
      const result=await page.evaluate(()=>{
        applyCalculatorState({currentTab:'history',studentName:'검증학생',targetYear:2026,targetMonth:8,historyData:[{year:2026,month:8,day:1,subject:'수학-개별(검증)-2h',teacher:'검증',attend:'당취',hours:2,amount:62500,originalAmount:62500,startTime:'12:00',endTime:'14:00'}]});
        const checkbox=document.getElementById('historySameDayCancelAsAttendance');
        const before=document.getElementById('dispTotal').innerText;
        checkbox.checked=true;handleSameDayCancelOptionChange('history');const converted=document.getElementById('receiptBody').innerText;
        checkbox.checked=false;handleSameDayCancelOptionChange('history');
        return {before,after:document.getElementById('dispTotal').innerText,converted,original:historyData[0].attend,restored:document.getElementById('receiptBody').innerText};
      });assert.equal(result.before,result.after);assert.equal(result.original,'당취');assert.ok(result.converted.includes('출석'));assert.ok(!result.converted.includes('당일취소'));assert.ok(result.restored.includes('당일취소'));
    });
    await check('select cutoff and keyboard exclusion',async()=>{
      await page.evaluate(()=>applyCalculatorState({currentTab:'select',studentName:'검증학생',targetYear:2026,targetMonth:8,selectRows:[{name:'수학-개별(검증)-2h',hours:2,rate:62500,dates:[1,8,15,22]}]}));
      await page.locator('#selectCutoffDay').fill('15');
      await page.evaluate(()=>applySelectCutoff());
      assert.equal(await page.locator('#dispTotal').innerText(),'187,500원');
      await page.locator('#calendarGrid [role="button"]').nth(7).focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#dispTotal').innerText(),'125,000원');
      assert.equal(await page.locator('#calendarGrid [role="button"]').nth(7).getAttribute('aria-pressed'),'true');
      await page.keyboard.press('Space');assert.equal(await page.locator('#dispTotal').innerText(),'187,500원');
    });
    await check('timetable ignores impossible month dates',async()=>{
      await page.evaluate(()=>applyCalculatorState({currentTab:'timetable',targetYear:2026,targetMonth:2,ttRows:[{day:1,subject:'수학',duration:1,price:10000,rateMode:'perClass',manualDates:[30,31]}]}));
      assert.equal(await page.locator('#dispTotal').innerText(),'40,000원');
    });
    await check('dense calendar render and image export',async()=>{
      const metrics=await page.evaluate(()=>{
        applyCalculatorState({currentTab:'history',studentName:'검증학생',targetYear:2026,targetMonth:8,historyData:Array.from({length:186},(_,i)=>({year:2026,month:8,day:Math.floor(i/6)+1,subject:`${i%2?'국어':'수학'}-1:1(검증강사)-1h`,teacher:'검증강사',attend:'출석',hours:1,amount:100000,originalAmount:100000,startTime:`${10+i%6}:00`,endTime:`${11+i%6}:00`}))});
        const start=performance.now();for(let n=0;n<10;n++)updateHistoryView();
        return {millisecondsPerRender:(performance.now()-start)/10,count:document.querySelectorAll('#receiptMiniCalGrid .rc-subject').length};
      });assert.equal(metrics.count,186);console.log('dense history render ms',metrics.millisecondsPerRender);
      if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'performance.json'),JSON.stringify(metrics));await page.screenshot({path:path.join(evidence,'browser.png'),fullPage:true});}
      const downloadPromise=page.waitForEvent('download');
      await page.locator('[onclick="downloadImage()"]').click();
      const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.png'));
      if(evidence)await download.saveAs(path.join(evidence,'export.png'));
      await page.waitForFunction(()=>!imageSavePending);
      assert.equal(await page.locator('#captureArea').evaluate(el=>el.style.width),'');
    });
    await check('numeric import validation and clipboard error recovery',async()=>{
      assert.equal(await page.evaluate(()=>{try{applyCalculatorState({studentName:'BAD',paymentRows:[{amount:'" onfocus="alert(1)'}]});return false;}catch{return document.getElementById('studentName').value==='검증학생';}}),true);
      await page.evaluate(async()=>{const original=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=async()=>{throw new Error('permission denied');};await copyGeneratedText();navigator.clipboard.writeText=original;});
    });
    await check('calendar benchmark against previous deployed source',async()=>{
      const baseline=await browser.newPage({viewport:{width:1440,height:1000}});
      baseline.on('dialog',d=>d.accept());
      await baseline.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
      await baseline.goto(`http://127.0.0.1:${server.address().port}/baseline`,{waitUntil:'networkidle'});
      const measure=async target=>target.evaluate(()=>{
        switchTab('history');document.getElementById('targetYear').value=2026;document.getElementById('targetMonth').value=8;
        const events=Array.from({length:186},(_,i)=>({day:Math.floor(i/6)+1,name:'수학',rawName:'수학-1:1(검증)-1h',historyCompact:true,typeLabel:'1:1',timeLabel:'12-13시'}));
        const samples=[];for(let run=0;run<5;run++){const start=performance.now();for(let i=0;i<20;i++){renderCommonReceiptCalendar(events);document.getElementById('receiptMiniCalGrid').offsetHeight;}samples.push((performance.now()-start)/20);}return samples;
      });
      const before=await measure(baseline),after=await measure(page);
      const median=values=>[...values].sort((a,b)=>a-b)[2];
      const report={baselineCommit:'5571e45',browser:browser.version(),fixture:'186 events, August 2026, 1440x1000, forced layout, 5 x 20 renders',before,after,beforeMedian:median(before),afterMedian:median(after),scope:'Local DOM renderer only; not Lighthouse, network, or whole-app latency.'};
      console.log('BENCHMARK',JSON.stringify(report));if(evidence)fs.writeFileSync(path.join(evidence,'benchmark.json'),JSON.stringify(report,null,2));
      assert.ok(report.afterMedian<report.beforeMedian);await baseline.close();
    });
    if(evidence){
      await page.evaluate(()=>updateHistoryView());
      for(const width of [390,768]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}`);await page.screenshot({path:path.join(evidence,`browser-${width}.png`),fullPage:true});}
    }
    assert.deepEqual(errors,[]);
    const report={browser:browser.version(),platform:process.platform,viewport:'1440x1000',results,pageErrors:errors,limitations:['Server RPCs mocked; no production student records written.','No claim of comprehensive accessibility or human usability study.']};
    if(evidence)fs.writeFileSync(path.join(evidence,'regression.json'),JSON.stringify(report,null,2));
    console.log('ALL PASS',results.length);
  } finally {await browser.close(); server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
