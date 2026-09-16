// Local-only UI fixture. No production authentication or record writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const auth=`export async function initializeAuth(onState){
 let saved=null;
 const row=(id,date,hours=2,extra={})=>({id,date,className:'수학-개별(검증강사)-'+hours+'h',teacher:'검증강사',kind:'regular',start:'16:00',end:hours===3?'19:00':'18:00',minutes:hours*60,amount:hours*30000,...extra});
 const dense=[];
 for(let day=1;day<=10;day++)for(let index=0;index<(day===5?5:2);index++){
  const subject=['국어','수학','영어','사탐'][index%4],teacher=['가강사','나강사','다강사','라강사'][day%4],hours=day%3+1,type=index===4?'1:1':'개별';
  dense.push(row('dense-'+day+'-'+index,'2026-09-'+String(day).padStart(2,'0'),hours,{className:subject+'-'+type+'('+teacher+')-'+hours+'h',teacher,start:String(12+index*2).padStart(2,'0')+':00',end:String(12+index*2+hours).padStart(2,'0')+':00',...(day===10?{kind:'absence',minutes:0,amount:0,forecastMinutes:hours*60,forecastAmount:hours*30000}:{})}));
 }
 const gateway={rpc:async(rpc,p)=>{
 if(rpc==='feecalc_students')return{data:[{id:'qa',name:'검증학생',school:'검증중',grade:'2'},{id:'qa2',name:'다른학생',school:'검증고',grade:'1'}]};
 if(rpc==='feecalc_progress'){if(document.getElementById('qaFail').checked)return{error:{message:'합성 조회 실패'}};return{data:{studentId:p.p_student_id,month:p.p_month,fetchedAt:'2026-09-16T07:00:00Z',lessons:p.p_month==='2026-09'?(document.getElementById('qaDense').checked?dense:[row('a','2026-09-02'),row('b','2026-09-09',3),row('c','2026-09-15',2,{className:'국어-1:1(검증강사)-2h',amount:document.getElementById('qaPending').checked?null:200000})]):[]}};}
 if(rpc==='feecalc_get_app_settings')return{data:{rateLibrary:[]}};
 if(rpc==='feecalc_save_record'||rpc==='feecalc_update_record'){saved=p.p_payload;document.getElementById('qaSaved').textContent='검증 서버 저장 완료 · '+saved.currentTab;return{data:{record_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',saved_at:'2026-09-16T07:00:00Z'}};}
 return{data:[]};}};
 const qa=document.createElement('aside');qa.id='qaToolbar';qa.style='padding:12px;background:white;border:1px solid #004094';qa.innerHTML='<strong>합성 데이터 검증 전용 · 운영 저장 없음</strong> <label><input id="qaFail" type="checkbox"> 조회 실패 검증</label> <label><input id="qaPending" type="checkbox"> 미확인 금액 검증</label> <button id="qaRestore">검증 저장본 복원</button><output id="qaSaved"></output>';document.body.prepend(qa);
 document.getElementById('qaRestore').onclick=()=>{if(saved)applyCalculatorState(saved);};
 const stale=document.createElement('button');stale.textContent='구형 저장본 열기';stale.onclick=()=>{const data=collectCalculatorState();data.currentTab='progress';data.progress={snapshot:{studentId:data.studentId,month:'2026-09',fetchedAt:'2026-09-10T07:00:00Z',lessons:[row('a','2026-09-02'),row('b','2026-09-09',3)]},mode:'auto',cutoff:'2026-09-10',manual:[],excluded:[]};applyCalculatorState(data);};qa.append(stale);
 const denseLabel=document.createElement('label');denseLabel.innerHTML='<input id="qaDense" type="checkbox"> 많은 수업 검증';qa.append(denseLabel);
 // Test-only capture sink: exercise the real image button and retain its PNG.
 const click=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){if(this.download.endsWith('.png') && this.href.startsWith('blob:')){fetch(this.href).then(r=>r.blob()).then(blob=>fetch('/__qa_export',{method:'POST',body:blob})).then(()=>{document.getElementById('qaSaved').textContent='검증 PNG 보관 완료';});return;}return click.call(this);};
 queueMicrotask(()=>onState({state:'ready',actor:{uid:'qa',name:'검증 직원'},user:{uid:'qa'},gateway}));return{gateway};}
`;
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/__qa_export' && req.method==='POST' && process.env.QA_EXPORT){const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{fs.writeFileSync(process.env.QA_EXPORT,Buffer.concat(chunks));res.end('ok');});return;}
 if(pathname==='/auth-client.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(auth);}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':/\.(m?js)$/.test(file)?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(Number(process.env.PORT)||5188,'127.0.0.1',()=>console.log('Synthetic progress preview port '+(process.env.PORT||5188)));
