import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createGateway} from '../auth-client.mjs';
const require=createRequire(import.meta.url);
// No real network is allowed: every gateway receives an injected fetcher.
globalThis.fetch=()=>{throw Error('Network prohibited in isolated tests');};
const reply=data=>({ok:true,status:200,json:async()=>data});
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture(){
 let uid='qa-a';const calls=[];
 const gateway=createGateway({getUser:()=>({uid,getIdToken:async()=> 'synthetic-token'}),fetcher:async(url,init)=>{
  if(url.endsWith('/session'))return reply({data:{uid}});
  return new Promise(resolve=>calls.push({body:JSON.parse(init.body),resolve}));
 }});
 await gateway.authorize();
 return {gateway,calls,switchUser:async()=>{uid='qa-b';gateway.reset();await gateway.authorize();}};
}
test('three concurrent reads share one HTTP, canonical params, isolated results, no settled cache',async()=>{
 const {gateway:g,calls}=await fixture();
 const a=g.rpc('feecalc_progress',{p_month:'2026-10',p_student_id:'s'});
 const b=g.rpc('feecalc_progress',{p_student_id:'s',p_month:'2026-10'});
 const c=g.rpc('feecalc_progress',{p_month:'2026-10',p_student_id:'s'});
 await tick();assert.equal(calls.length,1);calls[0].resolve(reply({data:{lessons:[]}}));
 const results=await Promise.all([a,b,c]);results[0].data.lessons.push('local');assert.deepEqual(results[1].data.lessons,[]);
 const next=g.rpc('feecalc_progress',{p_month:'2026-10',p_student_id:'s'});await tick();assert.equal(calls.length,2);calls[1].resolve(reply({data:[]}));await next;
});
test('student, month, RPC and writes remain independent; fresh verification bypasses active read',async()=>{
 const {gateway:g,calls}=await fixture();const p={p_student_id:'s',p_month:'2026-10'};
 const jobs=[g.rpc('feecalc_desk_payments',p),g.rpc('feecalc_desk_payments',p,{fresh:true}),g.rpc('feecalc_desk_payments',{...p,p_student_id:'other'}),g.rpc('feecalc_desk_payments',{...p,p_month:'2026-09'}),g.rpc('feecalc_intranet_opening',p),g.rpc('feecalc_save_record',p),g.rpc('feecalc_save_record',p)];
 await tick();assert.equal(calls.length,7);calls.forEach(c=>c.resolve(reply({data:[]})));await Promise.all(jobs);
});
test('account switch rejects both shared consumers and cannot reuse previous flight',async()=>{
 const {gateway:g,calls,switchUser}=await fixture();const a=g.rpc('feecalc_students'),b=g.rpc('feecalc_students');await tick();await switchUser();const c=g.rpc('feecalc_students');await tick();assert.equal(calls.length,2);
 calls[0].resolve(reply({data:['old']}));calls[1].resolve(reply({data:['new']}));
 for(const r of await Promise.all([a,b])){assert.equal(r.data,null);assert.equal(r.error.code,'AUTH_CHANGED');}assert.deepEqual((await c).data,['new']);
});
test('failed shared read is not zero or cached and can be retried',async()=>{
 const {gateway:g,calls}=await fixture();const a=g.rpc('feecalc_intranet_opening'),b=g.rpc('feecalc_intranet_opening');await tick();calls[0].resolve({ok:false,status:504,json:async()=>({})});for(const r of await Promise.all([a,b])){assert.equal(r.data,null);assert.ok(r.error);}
 const c=g.rpc('feecalc_intranet_opening');await tick();assert.equal(calls.length,2);calls[1].resolve(reply({data:{rows:[]}}));await c;
});
function ui(){
 const nodes=new Map(),calls=[],added=[];
 class Element{
  constructor(){this.children=[];this.classList={add(){}};this.value='';this.open=false;this.handlers={};}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(){}focus(){}remove(){}
  addEventListener(type,fn){this.handlers[type]=fn;}showModal(){this.open=true;}close(){this.open=false;this.handlers.close?.();}
  querySelector(selector){if(!this.selectors)this.selectors=new Map();if(!this.selectors.has(selector))this.selectors.set(selector,new Element());return this.selectors.get(selector);}
 }
 const el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};el('targetYear').value='2026';el('targetMonth').value='10';el('adjustmentArea').firstElementChild=new Element();
 const ctx={FeeFinancialSources:require('../financial-sources-core.js'),document:{getElementById:el,createElement:()=>new Element(),body:new Element(),addEventListener(){}},staffAuthEpoch:1,matchedStudent:()=>({id:'synthetic',name:'test'}),currentTab:'progress',isServerConfigured:()=>true,getAdjustmentTotal:()=>0,collectAdjustmentItems:()=>[],getSupabaseClient:()=>({rpc:(...args)=>new Promise(resolve=>calls.push({args,resolve}))}),FeeCalendar:{remember(){},commit(){}},addAdjustmentItem:(...args)=>added.push(args),syncLegacyAdjustmentInput(){}};
 vm.runInNewContext(readFileSync(new URL('../financial-sources.js',import.meta.url),'utf8'),ctx);
 el('adjustmentArea').firstElementChild.children[0].children[1].onclick();
 const row={id:'receipt',amount:-100,kind:'other',label:'test',fingerprint:'a'.repeat(64)};
 const data=patch=>({studentId:'synthetic',month:'2026-10',rows:[{...row,...patch}]});
 return {el,calls,added,data,ctx};
}
test('dialog blocks repeated load and apply; verification is fresh and changed amount is rejected',async()=>{
 const u=ui();assert.equal(u.calls.length,1);assert.equal(u.el('financialSourceReload').disabled,true);assert.equal(u.el('financialSourceMonth').disabled,true);
 await u.el('financialSourceReload').onclick();assert.equal(u.calls.length,1);
 u.calls[0].resolve({data:u.data()});await tick();assert.equal(u.el('financialSourceReload').disabled,false);
 const input=u.el('financialSourceRows').children[0].children[0];input.checked=true;input.onchange();
 const applying=u.el('financialSourceApply').onclick();await u.el('financialSourceApply').onclick();await u.el('financialSourceReload').onclick();assert.equal(u.calls.length,2);assert.equal(u.calls[1].args[2].fresh,true);
 u.calls[1].resolve({data:u.data({amount:-200,fingerprint:'b'.repeat(64)})});await applying;assert.equal(u.added.length,0);
});
test('unchanged verification preserves amount and provenance, failure never imports zero',async()=>{
 for(const fail of [false,true]){
  const u=ui();u.calls[0].resolve({data:u.data()});await tick();const input=u.el('financialSourceRows').children[0].children[0];input.checked=true;input.onchange();
  const p=u.el('financialSourceApply').onclick();u.calls[1].resolve(fail?{error:{message:'partial failure'}}:{data:u.data()});await p;
  assert.equal(u.added.length,fail?0:1);if(!fail){assert.equal(u.added[0][1],-100);assert.equal(u.added[0][2].source.fingerprint,'a'.repeat(64));}
 }
});
test('separate gateways (tabs) do not share authorized data',async()=>{
 const a=await fixture(),b=await fixture();const jobs=[a.gateway.rpc('feecalc_students'),b.gateway.rpc('feecalc_students')];await tick();assert.equal(a.calls.length,1);assert.equal(b.calls.length,1);a.calls[0].resolve(reply({data:['a']}));b.calls[0].resolve(reply({data:['b']}));assert.deepEqual((await Promise.all(jobs)).map(r=>r.data),[['a'],['b']]);
});
test('account or target month change during fresh verification prevents import',async()=>{
 for(const change of ['account','month']){
  const u=ui();u.calls[0].resolve({data:u.data()});await tick();const input=u.el('financialSourceRows').children[0].children[0];input.checked=true;input.onchange();const p=u.el('financialSourceApply').onclick();
  if(change==='account')u.ctx.staffAuthEpoch++;else u.el('targetMonth').value='11';
  u.calls[1].resolve({data:u.data()});await p;assert.equal(u.added.length,0);
 }
});
