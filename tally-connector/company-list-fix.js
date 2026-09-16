/* TallySync company selector bridge: adds imported Tally companies to the visible Select Company area. */
(()=>{
  if(window.__tallysync_company_list_fix)return;
  window.__tallysync_company_list_fix=true;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const getCompanies=()=>{try{return JSON.parse(localStorage.getItem('tallysync_companies')||'[]').filter(x=>x&&x.Name)}catch{return[]}};
  const getSelected=()=>{try{return JSON.parse(localStorage.getItem('tallysync_selected_company')||'null')}catch{return null}};
  function choose(company){
    localStorage.setItem('tallysync_selected_company',JSON.stringify(company));
    localStorage.setItem('tallysync_company_profile',JSON.stringify(company));
    window.TallySyncActiveCompany=company;
    document.querySelectorAll('[data-active-company]').forEach(e=>e.textContent=company.Name);
    window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies:getCompanies(),selected:company}}));
    window.dispatchEvent(new CustomEvent('tallysync:company-selected',{detail:company}));
    render();
  }
  function host(){
    const els=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/^Select Company$/i.test((e.textContent||'').trim()));
    if(!els.length)return null;
    let p=els[0];
    for(let i=0;i<5&&p.parentElement;i++){
      if(p.parentElement.children.length<=12){p=p.parentElement;break}
      p=p.parentElement;
    }
    return p;
  }
  function render(){
    const companies=getCompanies();
    if(!companies.length)return;
    const h=host();
    if(!h)return;
    let box=document.getElementById('tallysync-real-company-list');
    if(!box){box=document.createElement('div');box.id='tallysync-real-company-list';box.setAttribute('data-tallysync-company-selector','1');h.insertAdjacentElement('afterend',box)}
    const selected=getSelected();
    box.style.cssText='margin-top:8px;width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;';
    box.innerHTML=companies.map((c,i)=>`<button type="button" data-ts-company-index="${i}" style="width:100%;text-align:left;padding:11px 13px;border:1px solid ${selected?.Name===c.Name?'#2563eb':'#e2e8f0'};border-radius:10px;background:${selected?.Name===c.Name?'#eff6ff':'#fff'};cursor:pointer;font:inherit"><div style="font-weight:700;color:#0f172a">${esc(c.Name)}</div><div style="font-size:11px;color:#64748b;margin-top:3px">${esc(c.GSTIN||'GSTIN not available')}${c.StateName?' • '+esc(c.StateName):''}</div>${selected?.Name===c.Name?'<div style="font-size:10px;color:#2563eb;margin-top:3px">✓ Active Company</div>':''}</button>`).join('');
    box.querySelectorAll('[data-ts-company-index]').forEach(b=>b.onclick=()=>choose(companies[Number(b.dataset.tsCompanyIndex)]));
  }
  window.addEventListener('tallysync:companies',render);
  window.addEventListener('tallysync:company-imported',render);
  window.addEventListener('tallysync:company-updated',render);
  new MutationObserver(()=>{if(!document.getElementById('tallysync-real-company-list'))render()}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();