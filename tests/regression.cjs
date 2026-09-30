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
      const gateway = {rpc: async name => ({data: name === 'feecalc_students' ? [{id:'qa',name:'검증학생'}] : [], error: null})};
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
    await check('retired AI cannot start predictions; legacy saved amounts remain read-only', async () => {
      const result=await page.evaluate(() => {
        const saved=collectCalculatorState();saved.currentTab='ai';saved.aiData=[{name:'수학',day:1,year:2026,month:8,type:'existing',amount:50000}];applyCalculatorState(saved);
        processAiPrediction();const restored=collectCalculatorState();
        return {rows:restored.aiData.map(d=>[d.amount,d.day,d.month,d.type]),hidden:document.getElementById('btn-ai').hidden};
      });assert.deepEqual(result.rows,[[50000,1,8,'existing']]);assert.equal(result.hidden,true);
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
        document.getElementById('studentName').value='검증학생';syncStudentMatch(false);
        let release;const calls=[];refreshServerRecordList=async()=>{};
        supabaseClient={rpc:async(name,params)=>{if(!name.includes('update_record'))return{data:[]};calls.push({name,params});await new Promise(r=>release=r);return{data:{record_id:'test',saved_at:new Date().toISOString()}};}};
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
      await page.getByRole('checkbox',{name:'8일 날짜 선택',exact:true}).focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'선택 수업 제외',exact:true}).click();
      assert.equal(await page.locator('#dispTotal').innerText(),'125,000원');
      assert.equal(await page.locator('#workCalendar .calendar-day').filter({has:page.getByRole('button',{name:'8일 수업 내역',exact:true})}).locator('.calendar-event').count(),0);
      await page.getByRole('button',{name:'실행 취소',exact:true}).click();assert.equal(await page.locator('#dispTotal').innerText(),'187,500원');
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
      await page.getByRole('button',{name:'안내서',exact:true}).click();
      const downloadPromise=page.waitForEvent('download');
      await page.getByRole('button',{name:'이미지 저장',exact:true}).click();
      const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.png'));
      if(evidence)await download.saveAs(path.join(evidence,'export.png'));
      await page.waitForFunction(()=>!document.getElementById('saveNoticeImage').disabled);
      assert.equal(await page.locator('#captureArea').evaluate(el=>el.style.width),'');
    });
    await check('numeric import validation and clipboard error recovery',async()=>{
      assert.equal(await page.evaluate(()=>{try{applyCalculatorState({studentName:'BAD',paymentRows:[{amount:'" onfocus="alert(1)'}]});return false;}catch{return document.getElementById('studentName').value==='검증학생';}}),true);
      await page.evaluate(async()=>{const original=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=async()=>{throw new Error('permission denied');};await copyGeneratedText();navigator.clipboard.writeText=original;});
    });
    await check('legacy fractional rounding and edited monthly drafts stay separate',async()=>{
      await page.evaluate(()=>applyCalculatorState({version:7,currentTab:'select',studentName:'검증학생',targetYear:2026,targetMonth:9,selectRows:[{name:'수학-개별(A)-1.25h',hours:1.25,rate:10000.5,rateMode:'perHour',dates:[1,2,3]}]}));
      assert.equal(await page.locator('#dispTotal').innerText(),'37,502원');
      const saved=await page.evaluate(()=>collectCalculatorState());await page.evaluate(s=>applyCalculatorState(s),saved);assert.equal(await page.locator('#dispTotal').innerText(),'37,502원');
      await page.evaluate(()=>applyCalculatorState({version:8,currentTab:'select',studentName:'검증학생',targetYear:2026,targetMonth:9,selectRows:[{name:'수학-개별(A)-1.25h',hours:1.25,rate:10000.5,rateMode:'perHour',dates:[1,2,3],schedule:{extraDates:[4],overrides:{4:{hours:2,rate:100}}}}]}));
      assert.equal(await page.locator('#workCalendar .calendar-event').count(),4);
      await page.locator('#targetMonth').fill('10');await page.locator('#studentName').click();
      assert.equal(await page.locator('#workCalendar .calendar-event').count(),0);
    });
    await check('confirmed patterns import once; timetable placement and copy failure preserve draft',async()=>{
      await page.evaluate(()=>{applyCalculatorState({version:8,currentTab:'select',studentId:'qa',studentName:'검증학생',targetYear:2026,targetMonth:10,selectRows:[]});window.originalQaRpc=supabaseClient.rpc;supabaseClient.rpc=async(name,p)=>name==='feecalc_progress'?{data:{studentId:'qa',month:p.p_month,fetchedAt:'2026-09-30T00:00:00Z',lessons:[1,8,15,22,29].map((d,i)=>({id:'s'+i,date:'2026-09-'+String(d).padStart(2,'0'),className:'수학-개별(A)-3h',teacher:'A',start:'14:00',end:'17:00',minutes:180,amount:87500,kind:i===3?'cancel':'regular',note:i===4?'오늘만':''}))}}:originalQaRpc(name,p);});
      await page.locator('#loadSource').click();await page.locator('#changesChecked').check();await page.locator('[data-candidate]').check();await page.locator('#applyCandidates').click();
      assert.equal(await page.locator('#workCalendar .calendar-event').count(),4);
      await page.locator('#loadSource').click();await page.locator('#changesChecked').check();await page.locator('[data-candidate]').check();await page.locator('#applyCandidates').click();assert.equal(await page.locator('#workCalendar .calendar-event').count(),4);
      await page.locator('#productHeader [data-purpose=timetable]').click();await page.locator('#importTimetable').click();await page.locator('#timetableEditors input[type=time]').first().fill('14:30');await page.locator('#studentName').click();await page.locator('#viewNotice').click();
      assert.equal(await page.locator('#receiptMiniCalGrid .notice-event').count(),4);assert.match(await page.locator('#receiptMiniCalGrid').innerText(),/14:30–17:30/);assert.equal(await page.locator('#captureArea .receipt-left').isVisible(),false);
      await page.evaluate(()=>{navigator.clipboard.write=async()=>{throw Error('synthetic denial');};});const dl=page.waitForEvent('download');await page.locator('#copyNoticeImage').click();await dl;await page.waitForFunction(()=>!document.getElementById('copyNoticeImage').disabled);assert.equal(await page.locator('#openNoticeImage').isVisible(),true);assert.equal(await page.locator('#receiptMiniCalGrid .notice-event').count(),4);
      await page.evaluate(()=>{supabaseClient.rpc=originalQaRpc;});
    });
    await check('additional session edit, operation preview, and whole-date holiday are independent',async()=>{
      await page.evaluate(()=>applyCalculatorState({version:8,currentTab:'select',studentName:'검증학생',targetYear:2026,targetMonth:9,selectRows:[{name:'수학-개별(A)-2h',hours:2,rate:62500,dates:[10],schedule:{additional:[{id:'extra',day:10,hours:1,rate:30000}]}},{name:'국어-개별(B)-3h',hours:3,rate:87500,dates:[10]}]}));
      await page.getByRole('button',{name:'10일 수업 내역',exact:true}).click();await page.locator('#dayDetail .day-lesson').filter({hasText:'1시간'}).getByRole('button',{name:'이 회차 수정',exact:true}).click();await page.locator('#calendarHours').fill('1.5');await page.locator('#calendarRate').fill('40000');await page.locator('#applyCalendar').click();
      let state=await page.evaluate(()=>collectCalculatorState());assert.equal(state.selectRows[0].schedule.additional[0].rate,40000);assert.equal(state.selectRows[0].schedule.overrides?.[10],undefined);assert.equal(await page.locator('#workCalendar .calendar-event').count(),3);
      await page.locator('#undoCalendar').click();await page.getByRole('checkbox',{name:'10일 날짜 선택',exact:true}).check();assert.match(await page.locator('#calendarDiff').innerText(),/선택 수업 제외: −1건 · −2시간 · −62,500원/);assert.match(await page.locator('#calendarDiff').innerText(),/전체 휴강: −3건 · −6시간 · −180,000원/);
      await page.locator('#globalExcludeDays').click();assert.equal(await page.locator('#workCalendar .calendar-event').count(),0);await page.locator('#restoreGlobalDays').click();assert.equal(await page.locator('#workCalendar .calendar-event').count(),3);
      await page.evaluate(()=>prepareNextMonthCalculation({clearSelectedDates:false}));assert.equal((await page.evaluate(()=>collectCalculatorState())).selectRows[0].dates.length,1);assert.equal((await page.evaluate(()=>collectCalculatorState())).selectRows[0].schedule.additional,undefined);
    });
    await check('history cannot transfer to another student and legacy AI controls are frozen',async()=>{
      await page.evaluate(()=>{applyCalculatorState({currentTab:'history',studentName:'검증학생',studentId:'qa',targetYear:2026,targetMonth:8,historyData:[{year:2026,month:8,day:1,subject:'수학',teacher:'A',hours:2,amount:62500,originalAmount:62500,attend:'출석'}]});document.getElementById('studentName').value='다른학생';handleStudentNameInput();});
      assert.equal(await page.locator('#receiptBody tr').count(),0);assert.equal(await page.locator('#dispTotal').innerText(),'학생·월 자료 재확인');await page.locator('#productHeader [data-purpose=notice]').click();await page.locator('#saveNoticeImage').click();assert.match(await page.locator('#imageOutputStatus').innerText(),/학생·월이 다릅니다/);
      assert.match(await page.locator('#generatedTextArea').inputValue(),/기록을 다시 불러온/);assert.doesNotMatch(await page.locator('#generatedTextArea').inputValue(),/62,500|다른학생 학생/);assert.equal(await page.locator('[onclick="copyGeneratedText()"]').isDisabled(),true);
      assert.equal(await page.evaluate(async()=>{window.mismatchedTextCopies=0;navigator.clipboard.writeText=async()=>{window.mismatchedTextCopies++;};await copyGeneratedText();return window.mismatchedTextCopies;}),0);
      await page.evaluate(()=>applyCalculatorState({currentTab:'ai',studentName:'구형학생',targetYear:2026,targetMonth:8,aiData:[{name:'수학',amount:50000,hours:2,count:1}]}));assert.equal(await page.locator('#controlColumn').isVisible(),false);assert.equal(await page.locator('#controlColumn').evaluate(n=>n.inert),true);
      const before=await page.locator('#dispTotal').innerText();await page.evaluate(()=>updateServerSaveModeUi());assert.equal(await page.locator('#dispTotal').innerText(),before);
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
