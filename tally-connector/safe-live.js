/* safe-live.js compatibility loader + visible company selector bridge */
(()=>{
  if(window.__tallysync_safe_live_loaded)return;
  window.__tallysync_safe_live_loaded=true;
  const s=document.createElement('script');
  s.src='https://raw.githubusercontent.com/anishhfgpl-uk/invoice/main/tally-connector/live-tally.js?v=20260916-fix4';
  s.async=false;
  s.onload=()=>{
    console.log('TallySync Pro: live-tally.js loaded');
    const render=()=>{
      let companies=[];
      try{companies=JSON.parse(localStorage.getItem('tallysync_companies')||'[]')}catch{}
      if(!companies.length)return;
      let host=document.getElementById('tallysync-visible-company-list');
      if(!host){
        const els=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/active company/i.test(e.textContent||''));
        const anchor=els[0];
        if(!anchor)return;
        host=document.createElement('div');host.id='tallysync-visible-company-list';host.style.cssText='margin-top:6px;min-width:260px;z-index:99998;position:relative';
        anchor.parentElement?.appendChild(host);
      }
      let selected=null;try{selected=JSON.parse(localStorage.getItem('tallysync_selected_company')||'null')}catch{}
      host.innerHTML='';
      const label=document.createElement('div');label.textContent='Imported Tally Companies';label.style.cssText='font-size:11px;font-weight:700;margin-bottom:4px';
      const sel=document.createElement('select');sel.style.cssText='width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:13px';
      companies.forEach(c=>{if(!c?.Name)return;const o=document.createElement('option');o.value=c.Name;o.textContent=c.Name+(c.GSTIN?' — '+c.GSTIN:'');if(selected?.Name===c.Name)o.selected=true;sel.appendChild(o)});
      sel.onchange=()=>{
        const c=companies.find(x=>x.Name===sel.value);if(!c)return;
        localStorage.setItem('tallysync_selected_company',JSON.stringify(c));
        localStorage.setItem('tallysync_company_profile',JSON.stringify(c));
        window.TallySyncActiveCompany=c;
        window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies,selected:c}}));
        window.dispatchEvent(new CustomEvent('tallysync:companies',{detail:{companies,selected:c}}));
      };
      host.append(label,sel);
    };
    window.addEventListener('tallysync:company-imported',render);
    window.addEventListener('tallysync:companies',render);
    window.addEventListener('tallysync:company-updated',render);
    const mo=new MutationObserver(()=>render());mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(render,500);setTimeout(render,1500);setTimeout(render,3000);
  };
  s.onerror=()=>console.error('TallySync Pro: live-tally.js failed to load');
  document.head.appendChild(s);
})();