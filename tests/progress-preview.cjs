// Local-only UI fixture. No production authentication or record writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const auth=`export async function initializeAuth(onState){
 let saved=null;
 const row=(id,date,hours=2,extra={})=>({id,date,className:'수학-개별(검증강사)-'+hours+'h',teacher:'검증강사',kind:'regular',start:'16:00',end:hours===3?'19:00':'18:00',minutes:hours*60,amount:hours*30000,...extra});
 const gateway={rpc:async(rpc,p)=>{
 if(rpc==='feecalc_students')return{data:[{id:'qa',name:'검증학생',school:'검증중',grade:'2'},{id:'qa2',name:'다른학생',school:'검증고',grade:'1'}]};
 if(rpc==='feecalc_progress'){if(document.getElementById('qaFail').checked)return{error:{message:'합성 조회 실패'}};return{data:{studentId:p.p_student_id,month:p.p_month,fetchedAt:'2026-09-16T07:00:00Z',lessons:p.p_month==='2026-09'?[row('a','2026-09-02'),row('b','2026-09-09',3),row('c','2026-09-15',2,{className:'국어-1:1(검증강사)-2h',amount:document.getElementById('qaPending').checked?null:200000})]:[]}};}
 if(rpc==='feecalc_get_app_settings')return{data:{rateLibrary:[]}};
 if(rpc==='feecalc_save_record'||rpc==='feecalc_update_record'){saved=p.p_payload;document.getElementById('qaSaved').textContent='검증 서버 저장 완료 · '+saved.currentTab;return{data:{record_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',saved_at:'2026-09-16T07:00:00Z'}};}
 return{data:[]};}};
 const qa=document.createElement('aside');qa.id='qaToolbar';qa.style='padding:12px;background:white;border:1px solid #004094';qa.innerHTML='<strong>합성 데이터 검증 전용 · 운영 저장 없음</strong> <label><input id="qaFail" type="checkbox"> 조회 실패 검증</label> <label><input id="qaPending" type="checkbox"> 미확인 금액 검증</label> <button id="qaRestore">검증 저장본 복원</button><output id="qaSaved"></output>';document.body.prepend(qa);
 document.getElementById('qaRestore').onclick=()=>{if(saved)applyCalculatorState(saved);};
 queueMicrotask(()=>onState({state:'ready',actor:{uid:'qa',name:'검증 직원'},user:{uid:'qa'},gateway}));return{gateway};}
`;
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/auth-client.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(auth);}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':/\.(m?js)$/.test(file)?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(5188,'127.0.0.1',()=>console.log('Synthetic progress preview http://127.0.0.1:5188'));
