/* App logic: tabs, theme, Text Compare, Zip Diff. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const {esc}=DiffView;

/* ---------- Tabs & theme ---------- */
$$('.tab').forEach(b=>b.onclick=()=>{
  $$('.tab').forEach(t=>{const on=t===b; t.classList.toggle('active',on); t.setAttribute('aria-selected',on);});
  $('#tab-text').hidden=b.dataset.tab!=='text'; $('#tab-zip').hidden=b.dataset.tab!=='zip';
});
const root=document.documentElement;
root.dataset.theme=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
$('#theme').onclick=()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'; localStorage.setItem('theme',root.dataset.theme);};

/* ---------- Feature 1: Text Compare ---------- */
function runText(){
  const a=$('#t-a').value, b=$('#t-b').value;
  const n=DiffView.render($('#t-out'),a,b,'Original','Modified');
  $('#t-stat').textContent=a===b?'Texts are identical.':n+' changed line(s)';
}
$('#t-run').onclick=runText;
let tt; ['#t-a','#t-b'].forEach(s=>$(s).addEventListener('input',()=>{ if($('#t-live').checked){clearTimeout(tt); tt=setTimeout(runText,250);} }));

/* ---------- Feature 2: Zip Diff ---------- */
const MAX_BYTES=1024*1024;          // files above this need a click to diff
const zs={A:null,B:null,files:[],sel:null,filter:'all'};

const isBinary=u=>{const n=Math.min(u.length,8000); for(let i=0;i<n;i++) if(u[i]===0) return true; return false;};
const same=(a,b)=>{ if(a.length!==b.length) return false; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return false; return true; };
const dec=u=>new TextDecoder('utf-8').decode(u);

async function readZip(file){
  const z=await JSZip.loadAsync(file), m=new Map();
  const names=Object.keys(z.files).filter(n=>!z.files[n].dir && !n.startsWith('__MACOSX/') && !n.endsWith('.DS_Store'));
  await Promise.all(names.map(async n=>m.set(n,await z.files[n].async('uint8array'))));
  // If everything sits in one top-level folder, strip it so differently-named roots still align.
  const roots=new Set(names.map(n=>n.split('/')[0]));
  if(roots.size===1 && names.every(n=>n.includes('/'))){
    const r=[...roots][0]+'/'; const o=new Map(); m.forEach((v,k)=>o.set(k.slice(r.length),v)); return {name:file.name,map:o};
  }
  return {name:file.name,map:m};
}

function setupDrop(id,key){
  const d=$(id), inp=d.querySelector('input');
  const take=async f=>{
    if(!f) return;
    $('#z-msg').textContent='Reading '+f.name+'…';
    try{ zs[key]=await readZip(f); d.classList.add('ok'); d.querySelector('span').textContent=f.name+' ('+zs[key].map.size+' files)'; $('#z-msg').textContent=''; compareZips(); }
    catch(e){ $('#z-msg').textContent='Could not read '+f.name+': '+e.message; }
  };
  d.onclick=()=>inp.click(); d.onkeydown=e=>{ if(e.key==='Enter'||e.key===' ') inp.click(); };
  inp.onchange=()=>take(inp.files[0]);
  d.ondragover=e=>{e.preventDefault(); d.classList.add('over');}; d.ondragleave=()=>d.classList.remove('over');
  d.ondrop=e=>{e.preventDefault(); d.classList.remove('over'); take(e.dataTransfer.files[0]);};
}
setupDrop('#drop-a','A'); setupDrop('#drop-b','B');

function compareZips(){
  if(!zs.A||!zs.B) return;
  const paths=[...new Set([...zs.A.map.keys(),...zs.B.map.keys()])].sort();
  zs.files=paths.map(p=>{
    const a=zs.A.map.get(p), b=zs.B.map.get(p);
    const status=!a?'added':!b?'removed':same(a,b)?'unchanged':'modified';
    return {path:p,a,b,status};
  });
  zs.sel=null; $('#z-app').hidden=false; renderTree(); showFile(null);
}

const SYM={added:'+',removed:'−',modified:'~',unchanged:' '};
const visible=f=>zs.filter==='all'||f.status===zs.filter;
const navList=()=>zs.files.filter(f=>f.status!=='unchanged'&&visible(f));

function renderTree(){
  const root={kids:new Map(),files:[]};
  zs.files.filter(visible).forEach(f=>{
    let n=root; const parts=f.path.split('/'); const name=parts.pop();
    parts.forEach(p=>{ if(!n.kids.has(p)) n.kids.set(p,{kids:new Map(),files:[]}); n=n.kids.get(p); });
    n.files.push({...f,name});
  });
  const dirChanged=n=>n.files.some(f=>f.status!=='unchanged')||[...n.kids.values()].some(dirChanged);
  const html=n=>[...n.kids].map(([k,v])=>'<details open><summary>'+esc(k)+(dirChanged(v)?' <span class="fdot">●</span>':'')+'</summary><div class="kids">'+html(v)+'</div></details>').join('')
    + n.files.map(f=>'<div class="leaf" data-p="'+esc(f.path)+'"><span class="st '+f.status+'">'+SYM[f.status]+'</span>'+esc(f.name)+'</div>').join('');
  $('#z-tree').innerHTML=html(root)||'<div class="muted">No files match this filter.</div>';
  $$('#z-tree .leaf').forEach(l=>{ l.onclick=()=>showFile(l.dataset.p); if(l.dataset.p===zs.sel) l.classList.add('sel'); });
  const c=k=>zs.files.filter(f=>f.status===k).length;
  $('#z-count').textContent=c('added')+' added · '+c('removed')+' removed · '+c('modified')+' modified · '+c('unchanged')+' unchanged';
}

function showFile(path,force){
  zs.sel=path; $$('#z-tree .leaf').forEach(l=>l.classList.toggle('sel',l.dataset.p===path));
  const out=$('#z-diff'), f=zs.files.find(x=>x.path===path);
  const list=navList(), i=list.findIndex(x=>x.path===path);
  $('#z-pos').textContent=list.length?(i>=0?i+1:'–')+' / '+list.length:'';
  $('#z-prev').disabled=$('#z-next').disabled=!list.length;
  if(!f){ $('#z-path').textContent='Select a file'; $('#z-badge').innerHTML=''; out.innerHTML=''; return; }
  $('#z-path').textContent=f.path; $('#z-badge').innerHTML='<span class="badge '+f.status+'">'+f.status+'</span>';
  const size=Math.max(f.a?f.a.length:0,f.b?f.b.length:0);
  if((f.a&&isBinary(f.a))||(f.b&&isBinary(f.b))){
    out.innerHTML='<div class="note">Binary file not shown. '+(f.a?'Previous: '+f.a.length+' bytes. ':'')+(f.b?'Current: '+f.b.length+' bytes.':'')+'</div>'; return;
  }
  if(size>MAX_BYTES&&!force){
    out.innerHTML='<div class="note">This file is large ('+(size/1048576).toFixed(1)+' MB) and may be slow to diff. <button class="btn sm" id="z-force">Show diff anyway</button></div>';
    $('#z-force').onclick=()=>showFile(path,true); return;
  }
  DiffView.render(out,f.a?dec(f.a):'',f.b?dec(f.b):'','Previous: '+(zs.A.name),'Current: '+(zs.B.name));
}

const step=d=>{ const l=navList(); if(!l.length) return; const i=l.findIndex(x=>x.path===zs.sel); showFile(l[(i+d+l.length)%l.length].path); };
$('#z-prev').onclick=()=>step(-1); $('#z-next').onclick=()=>step(1);
$$('.chip').forEach(c=>c.onclick=()=>{ $$('.chip').forEach(x=>x.classList.toggle('active',x===c)); zs.filter=c.dataset.f; renderTree(); showFile(zs.sel&&visible(zs.files.find(f=>f.path===zs.sel)||{})?zs.sel:null); });
