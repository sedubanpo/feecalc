// Read account-managed photos at sign-in; never persist private registry data in drafts.
(() => {
 let profiles=new Map(),revision=0,pending=Promise.resolve();
 const nameOf=value=>String(value||'').trim().replace(/T$/i,'').trim();
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='firebasestorage.googleapis.com'?u.href:'';}catch{return '';}}
 function badge(name){
  const label=nameOf(name)||'강사 미기재',url=profiles.get(label),esc=escapeHtml;
  return `<span class="receipt-teacher notice-teacher-profile" data-teacher-profile="${esc(label)}"><span class="notice-teacher-portrait">${url?`<img class="notice-teacher-avatar" src="${esc(url)}" crossorigin="anonymous" alt="" onerror="this.remove()">`:''}<span aria-hidden="true">${esc(label.slice(0,1))}</span></span><span>${esc(label)}</span></span>`;
 }
 function paint(){document.querySelectorAll('[data-teacher-profile]').forEach(node=>{node.outerHTML=badge(node.dataset.teacherProfile);});}
 function clear(){revision++;profiles.clear();paint();}
 async function loadProfiles(gateway){const current=++revision;try{
  if(!gateway?.teacherProfiles)return;
  const rows=await gateway.teacherProfiles();if(current!==revision)return;
  const names=new Map();for(const row of rows){const name=nameOf(row.name),url=safeUrl(row.url);if(name&&url)names.set(name,names.has(name)?null:url);}
  profiles=names;paint();
 }catch{/* Optional photos must never block calculation or notice export. */}}
 function load(gateway){pending=loadProfiles(gateway);return pending;}
 window.FeeTeacherProfiles={badge,clear,load,ready:()=>pending};
})();
