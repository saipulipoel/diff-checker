/* Side-by-side diff renderer shared by both features. Requires jsdiff (global `Diff`). */
(function(){
  const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const split=v=>{ if(v==='')return[]; const a=v.split('\n'); if(a[a.length-1]==='')a.pop(); return a.map(x=>x.replace(/\r$/,'')); };

  /* Turn two strings into aligned rows: {l:{n,t,c,h}, r:{...}}. A missing side is a padding row. */
  function buildRows(a,b){
    const parts=Diff.diffLines(a,b), rows=[]; let ln=1, rn=1;
    for(let i=0;i<parts.length;i++){
      const p=parts[i], lines=split(p.value);
      if(!p.added&&!p.removed){ lines.forEach(t=>rows.push({l:{n:ln++,t},r:{n:rn++,t}})); }
      else if(p.removed){
        const nx=parts[i+1];
        if(nx&&nx.added){            // removed+added block = "changed" lines, pair them by index
          i++; const ad=split(nx.value), m=Math.max(lines.length,ad.length);
          for(let k=0;k<m;k++){
            const L=lines[k], R=ad[k], row={};
            if(L!==undefined) row.l={n:ln++,t:L,c:'del'};
            if(R!==undefined) row.r={n:rn++,t:R,c:'add'};
            if(L!==undefined&&R!==undefined&&L.length<2000&&R.length<2000){ // character/word-level highlight
              const w=Diff.diffWordsWithSpace(L,R);
              row.l.h=w.filter(x=>!x.added).map(x=>[x.value,x.removed]);
              row.r.h=w.filter(x=>!x.removed).map(x=>[x.value,x.added]);
            }
            rows.push(row);
          }
        } else lines.forEach(t=>rows.push({l:{n:ln++,t,c:'del'}}));
      } else lines.forEach(t=>rows.push({r:{n:rn++,t,c:'add'}}));
    }
    return rows;
  }

  const cell=c=>{
    if(!c) return '<div class="row pad" data-n=""></div>';
    const body=c.h? c.h.map(([t,m])=>m?'<mark>'+esc(t)+'</mark>':esc(t)).join('') : esc(c.t);
    return '<div class="row '+(c.c||'')+'" data-n="'+c.n+'">'+body+'</div>';
  };

  /* Render into `el`. Returns the number of changed rows. */
  function render(el,a,b,labelL,labelR){
    const rows=buildRows(a,b);
    const changed=rows.filter(r=>!r.l||!r.r||r.l.c||r.r.c).length;
    const pane=(side,label)=>'<div class="pane" data-side="'+side+'"><div class="plabel">'+esc(label)+'</div><div class="lines">'+rows.map(r=>cell(r[side])).join('')+'</div></div>';
    el.innerHTML='<div class="dv">'+pane('l',labelL)+pane('r',labelR)+'</div>';
    const dv=el.firstChild, L=dv.children[0], R=dv.children[1];
    // Keep both panes scrolled together (they remain separate containers).
    let lock=false;
    const sync=(from,to)=>from.addEventListener('scroll',()=>{ if(lock)return; lock=true; to.scrollTop=from.scrollTop; to.scrollLeft=from.scrollLeft; requestAnimationFrame(()=>lock=false); });
    sync(L,R); sync(R,L);
    // Copy isolation: whichever pane the user presses in becomes the only selectable one.
    [[L,'l'],[R,'r']].forEach(([p,s])=>{
      ['mousedown','touchstart'].forEach(ev=>p.addEventListener(ev,()=>{ dv.dataset.active=s; getSelection().removeAllRanges(); },{passive:true}));
    });
    return changed;
  }
  window.DiffView={render,esc};
})();
