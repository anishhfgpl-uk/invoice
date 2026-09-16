/* TallySync company selector bridge: syncs imported Tally companies into the React app. */
(()=>{
  if(window.__tallysync_company_list_fix)return;
  window.__tallysync_company_list_fix=true;

  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const getCompanies=()=>{try{return JSON.parse(localStorage.getItem('tallysync_companies')||'[]').filter(x=>x&&x.Name)}catch{return[]}};
  const getSelected=()=>{try{return JSON.parse(localStorage.getItem('tallysync_selected_company')||'null')}catch{return null}};

  const companyId=c=>`tally_${String(c.Guid||c.Name||'company').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,80)}`;
  const toProfile=c=>({
    id:companyId(c),
    name:c.Name||'',
    formalName:c.MailingName||c.Name||'',
    gstin:c.GSTIN||'',
    pan:c.PAN||'',
    state:c.StateName||'',
    stateCode:c.StateCode||'',
    address:c.Address||c.MailingAddress||'',
    city:c.City||'',
    pincode:c.PinCode||'',
    phone:c.PhoneNumber||c.Phone||'',
    email:c.Email||'',
    financialYear:c.FinancialYear||'',
    booksBeginningFrom:c.BooksBeginningFrom||''
  });

  // Bridge the connector's Tally company data into AppContext's v2 storage.
  // The React app reads this storage during startup, so a single controlled reload
  // after a new Tally company is imported makes it the real Active Company.
  function syncReactContext(){
    const imported=getCompanies();
    const selected=getSelected();
    if(!imported.length||!selected?.Name)return false;

    let existing=[];
    try{existing=JSON.parse(localStorage.getItem('tallysync_companies_v2')||'[]')}catch{}
    if(!Array.isArray(existing))existing=[];

    const byName=new Map(existing.filter(x=>x?.name).map(x=>[String(x.name).toLowerCase(),x]));
    imported.forEach(c=>{
      const p=toProfile(c);
      const old=byName.get(p.name.toLowerCase());
      byName.set(p.name.toLowerCase(),{...(old||{}),...p});
    });
    const merged=[...byName.values()];
    const active=toProfile(selected);
    const currentActive=localStorage.getItem('tallysync_active_comp_v2')||'';
    const currentCompanies=JSON.stringify(existing);
    const nextCompanies=JSON.stringify(merged);
    const changed=currentCompanies!==nextCompanies||currentActive!==active.id;

    localStorage.setItem('tallysync_companies_v2',nextCompanies);
    localStorage.setItem('tallysync_active_comp_v2',active.id);
    localStorage.setItem('tallysync_company_profile',JSON.stringify(selected));
    window.TallySyncActiveCompany=selected;
    return changed;
  }

  function choose(company){
    if(!company?.Name)return;
    localStorage.setItem('tallysync_selected_company',JSON.stringify(company));
    localStorage.setItem('tallysync_company_profile',JSON.stringify(company));
    window.TallySyncActiveCompany=company;
    document.querySelectorAll('[data-active-company]').forEach(e=>e.textContent=company.Name);
    const changed=syncReactContext();
    window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies:getCompanies(),selected:company}}));
    window.dispatchEvent(new CustomEvent('tallysync:company-selected',{detail:company}));
    render();
    if(changed) setTimeout(()=>location.reload(),120);
  }

  function host(){
    const els=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/select company/i.test((e.textContent||'').trim()));
    if(!els.length)return null;
    let p=els[0];
    for(let i=0;i<6&&p.parentElement;i++){
      if(p.parentElement.children.length<=12){p=p.parentElement;break}
      p=p.parentElement;
    }
    return p;
  }

  function render(){
    const companies=getCompanies();
    if(!companies.length)return;
    const h=host();
    let box=document.getElementById('tallysync-real-company-list');
    if(!box){
      box=document.createElement('div');
      box.id='tallysync-real-company-list';
      box.setAttribute('data-tallysync-company-selector','1');
      if(h){h.insertAdjacentElement('afterend',box)}
      else{
        box.style.position='fixed';
        box.style.top='92px';
        box.style.right='24px';
        box.style.width='min(360px,calc(100vw - 48px))';
        box.style.zIndex='2147483001';
        document.body.appendChild(box);
      }
    }
    const selected=getSelected();
    box.style.cssText+=(h?'margin-top:8px;width:100%;':'')+'box-sizing:border-box;display:flex;flex-direction:column;gap:6px;';
    box.innerHTML='<div style="font:800 13px Arial;color:#0f172a;margin-bottom:3px">Tally Companies</div>'+companies.map((c,i)=>`<button type="button" data-ts-company-index="${i}" style="width:100%;text-align:left;padding:11px 13px;border:1px solid ${selected?.Name===c.Name?'#2563eb':'#e2e8f0'};border-radius:10px;background:${selected?.Name===c.Name?'#eff6ff':'#fff'};cursor:pointer;font:inherit"><div style="font-weight:700;color:#0f172a">${esc(c.Name)}</div><div style="font-size:11px;color:#64748b;margin-top:3px">${esc(c.GSTIN||'GSTIN not available')}${c.StateName?' • '+esc(c.StateName):''}</div>${selected?.Name===c.Name?'<div style="font-size:10px;color:#2563eb;margin-top:3px">✓ Active Company</div>':''}</button>`).join('');
    box.querySelectorAll('[data-ts-company-index]').forEach(b=>b.onclick=()=>choose(companies[Number(b.dataset.tsCompanyIndex)]));
  }

  // When live-tally imports a company, make it visible to React and make it active.
  function onCompanyEvent(){
    const changed=syncReactContext();
    render();
    if(changed) setTimeout(()=>location.reload(),120);
  }
  window.addEventListener('tallysync:companies',onCompanyEvent);
  window.addEventListener('tallysync:company-imported',onCompanyEvent);
  window.addEventListener('tallysync:company-updated',onCompanyEvent);

  new MutationObserver(()=>{if(getCompanies().length&&!document.getElementById('tallysync-real-company-list'))render()}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{onCompanyEvent()});else onCompanyEvent();
})();