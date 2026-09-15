(()=>{
  const OUR_IDS=['ts-connect','ts-live','anish-fixed-brand'];
  const ours=el=>el&&OUR_IDS.some(id=>el.id===id||el.closest?.('#'+id));
  const clean=()=>{
    document.querySelectorAll('button,a,[role="button"],input').forEach(el=>{
      if(ours(el)) return;
      const t=(el.innerText||el.textContent||el.value||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(!t) return;
      if(/^(tally connect|connect tally|connect to tally)$/.test(t)){
        const box=el.closest('section,article,li,form') || el.parentElement || el;
        if(!ours(box)) box.style.display='none';
        else el.style.display='none';
      }
    });
    document.querySelectorAll('body *').forEach(el=>{
      if(ours(el)||el.children.length>3) return;
      const t=(el.innerText||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(t==='tally connect'||t==='connect tally'||t==='connect to tally') el.style.display='none';
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',clean); else clean();
  new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});
})();
