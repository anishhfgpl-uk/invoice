/* Remote Tally connector UI v9 - correct relay endpoint */
(()=>{
const RELAY='https://tally-relay-anil-sharma.onrender.com';
const K={url:'tallysync_connector_url',code:'tallysync_office_code',company:'tallysync_selected_company',companyData:'tallysync_company_profile',companies:'tallysync_companies',debtors:'tallysync_debtors',items:'tallysync_items',invoices:'tallysync_invoices'};
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const saved=()=>localStorage.getItem(K.url)||'http://127.0.0.1:9101'; const code=()=>localStorage.getItem(K.code)||'';
const selected=()=>{try{return JSON.parse(localStorage.getItem(K.company)||'null')}catch{return null}};
async function post(xml){const c=code();const u=c?`${RELAY}/api/device/${encodeURIComponent(c)}/xml`:saved().replace(/\/$/,'')+'/tally/xml';let r;try{r=await fetch(u,{method:'POST',headers:{'Content-Type':'text/xml;charset=utf-8'},body:xml,signal:AbortSignal.timeout(45000)})}catch(e){throw Error('Tally connector/relay timeout (45 sec). Office connector online hai?')};const t=await r.text();if(!r.ok)throw Error(t.slice(0,500)||`HTTP ${r.status}`);if(!t.trim())throw Error('Tally ne empty response diya');return t}
const companyTag=()=>selected()?.Name?`<SVCURRENTCOMPANY>${esc(selected().Name)}</SVCURRENTCOMPANY>`:'';
async function collection(name,type,fetches,extra='',useCompany=true){const tag=useCompany?companyTag():'';return post(`<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${tag}${extra}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}" ISMODIFY="No" ISFIXED="No"><TYPE>${type}</TYPE><FETCH>${fetches}</FETCH></COLLECTION></TDL></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`)}
function parse(raw,tags){const s=String(raw||'').trim();if(!s)throw Error('Tally ne empty response diya');const d=new DOMParser().parseFromString(s,'text/xml');const root=d.documentElement;if(!root||root.nodeName==='parsererror')throw Error('Invalid XML response from Tally');const err=[...d.querySelectorAll('LINEERROR,ERROR')].map(x=>x.textContent.trim()).filter(Boolean);if(err.length)throw Error(err.join(' | '));const nodes=[...d.querySelectorAll('LEDGER,STOCKITEM,VOUCHER,COMPANY')];return nodes.map(n=>{const o={};tags.forEach(t=>{const q=n.querySelector(t)||n.querySelector(t.toUpperCase());o[t]=(q?.textContent||n.getAttribute(t)||n.getAttribute(t.toUpperCase())||'').trim()});return o}).filter(o=>Object.values(o).some(Boolean))}
function emit(name,data){try{localStorage.setItem(name,JSON.stringify(data))}catch(e){};window.dispatchEvent(new CustomEvent('tallysync:import',{detail:{type:name,data,company:selected()}}))}
function mergeCompanies(rows){let old=[];try{old=JSON.parse(localStorage.getItem(K.companies)||'[]')}catch{};const map=new Map();[...old,...rows].forEach(x=>{if(x?.Name)map.set((x.Name+'|'+(x.GSTIN||x.Guid||'')).toLowerCase(),x)});return [...map.values()]}
function syncCompanyUI(rows,chosen){const all=[...new Map(rows.filter(x=>x?.Name).map(x=>[x.Name.toLowerCase(),x])).values()];try{localStorage.setItem(K.companies,JSON.stringify(all));localStorage.setItem(K.company,JSON.stringify(chosen));emit(K.companyData,chosen)}catch{};window.TallySyncCompanies=all;window.TallySyncActiveCompany=chosen;window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies:all,selected:chosen}}));}
async function loadCompanies(preferredName=''){const raw=await collection('Company Collection','Company','Name,Guid,MailingName,StateName,PinCode,PhoneNumber,Email,GSTIN','',false);const rows=parse(raw,['Name','Guid','MailingName','StateName','PinCode','PhoneNumber','Email','GSTIN']);if(!rows.length)throw Error('TallyPrime me company open nahi hai.');const old=selected();const wanted=preferredName||old?.Name||'';const chosen=rows.find(x=>wanted&&x.Name===wanted)||rows[0];syncCompanyUI(mergeCompanies(rows),chosen);return chosen}
async function testConnect(status,q){const c=q('#ts-code').value.trim().toUpperCase(),u=q('#ts-url').value.trim();if(!c&&!u)throw Error('Remote Office Code ya Connector URL enter karein');localStorage.setItem(K.code,c);localStorage.setItem(K.url,u||'http://127.0.0.1:9101');localStorage.removeItem(K.company);status.textContent='⏳ Tally se connection test ho raha hai...';const raw=await collection('Connection Test','Company','Name','',false);const company=parse(raw,['Name'])[0];if(!company?.Name)throw Error('Tally response me company name nahi mila');window.TallySyncLastCompanyName=company.Name;const full=await loadCompanies(company.Name);status.innerHTML=`<b style="color:#047857">✅ Tally Connected Successfully</b><br>Company: ${esc(full.Name||'-')}<br>GSTIN: ${esc(full.GSTIN||'-')}`}
async function importDebtors(){if(!selected())await loadCompanies();const raw=await collection('All Ledgers','Ledger','Name,Parent,ClosingBalance,OpeningBalance,PhoneNumber,Email,GSTIN,Address,MailingName,StateName,PinCode,PartyGSTIN,LedgerContact,LedgerPhone');const all=parse(raw,['Name','Parent','ClosingBalance','OpeningBalance','PhoneNumber','Email','GSTIN','Address','MailingName','StateName','PinCode','PartyGSTIN','LedgerContact','LedgerPhone']);const debtors=all.filter(x=>/sundry\s*debtors/i.test(x.Parent||''));emit(K.debtors,debtors);return debtors}
async function importItems(){if(!selected())await loadCompanies();const raw=await collection('All Stock Items','StockItem','Name,Parent,ClosingBalance,ClosingValue,OpeningBalance,OpeningValue,BaseUnits,Rate,PartNo,HSNCode,HSNName,TaxRate');const items=parse(raw,['Name','Parent','ClosingBalance','ClosingValue','OpeningBalance','OpeningValue','BaseUnits','Rate','PartNo','HSNCode','HSNName','TaxRate']);emit(K.items,items);return items}
async function importInvoices(from='01-Apr-2026',to='30-Sep-2026'){if(!selected())await loadCompanies();const extra=`<SVFROMDATE TYPE="Date">${esc(from)}</SVFROMDATE><SVTODATE TYPE="Date">${esc(to)}</SVTODATE><SVViewName>Accounting Voucher View</SVViewName>`;const raw=await collection('All Vouchers','Voucher','Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Reference,ReferenceDate,Narration,GUID,MasterID,LedgerEntries,InventoryEntries',extra);const all=parse(raw,['Date','VoucherNumber','VoucherTypeName','PartyLedgerName','Amount','Reference','ReferenceDate','Narration','GUID','MasterID','LedgerEntries','InventoryEntries']);emit(K.invoices,all);return all}
async function importAll(from,to){const company=await loadCompanies(window.TallySyncLastCompanyName||'');const debtors=await importDebtors();const items=await importItems();const invoices=await importInvoices(from,to);window.dispatchEvent(new CustomEvent('tallysync:data',{detail:{company,data:{company,debtors,stock:items,invoices,sales:invoices.filter(x=>/sales/i.test(x.VoucherTypeName||'')),purchase:invoices.filter(x=>/purchase/i.test(x.VoucherTypeName||''))}}}));return {company,debtors,items,invoices}}
function panel(){if(document.getElementById('ts-connect'))return;const b=document.createElement('div');b.id='ts-connect';b.style.cssText='position:fixed;right:24px;bottom:24px;z-index:99999;font-family:Inter,Arial,sans-serif';b.innerHTML=`<button id="ts-connect-btn" style="min-width:190px;padding:13px 20px;border:0;border-radius:12px;background:#0f172a;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 8px 25px #0003">🔗 Connect Tally</button><div id="ts-modal" style="display:none;position:fixed;inset:0;background:#0f172a99;align-items:center;justify-content:center"><div style="background:#fff;width:min(620px,94vw);max-height:90vh;overflow:auto;border-radius:18px;box-shadow:0 20px 60px #0005"><div style="padding:20px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff"><b style="font-size:21px">Connect TallyPrime</b><div style="font-size:12px;opacity:.85;margin-top:4px">Remote office connector + secure relay</div></div><div style="padding:20px"><label style="font-size:12px;font-weight:700">Remote Office Code</label><input id="ts-code" value="${esc(code())}" placeholder="ANISH-XXXXXXXX" style="width:100%;box-sizing:border-box;margin:7px 0 12px;padding:12px;border:1px solid #cbd5e1;border-radius:10px"><label style="font-size:12px;font-weight:700">Connector URL</label><input id="ts-url" value="${esc(saved())}" placeholder="http://192.168.1.25:9101" style="width:100%;box-sizing:border-box;margin:7px 0 6px;padding:12px;border:1px solid #cbd5e1;border-radius:10px"><div style="font-size:11px;color:#64748b;margin-bottom:14px">Remote office ke liye Office Code use karein. Same PC par URL 127.0.0.1:9101 rahega.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="ts-test" style="background:#0f172a;color:#fff;padding:10px 14px;border:0;border-radius:9px">Test & Connect</button><button id="ts-company" style="padding:10px 14px">Import Company</button><button id="ts-debtors" style="padding:10px 14px">Import Debtors</button><button id="ts-items" style="padding:10px 14px">Import Items</button><button id="ts-invoices" style="padding:10px 14px">Import Invoices</button><button id="ts-all" style="background:#2563eb;color:#fff;padding:10px 14px;border:0;border-radius:9px">Import Everything</button><button id="ts-close" style="padding:10px 14px">Close</button></div><div style="margin-top:14px;display:flex;gap:8px"><input id="ts-from" value="01-Apr-2026" style="width:50%;padding:9px;border:1px solid #cbd5e1;border-radius:8px"><input id="ts-to" value="30-Sep-2026" style="width:50%;padding:9px;border:1px solid #cbd5e1;border-radius:8px"></div><div id="ts-status" style="margin-top:14px;font-size:13px;white-space:pre-wrap"></div></div></div></div>`;document.body.appendChild(b);const q=s=>b.querySelector(s),modal=q('#ts-modal'),status=q('#ts-status');window.TallySyncOpen=()=>{modal.style.display='flex'};q('#ts-connect-btn').onclick=window.TallySyncOpen;q('#ts-close').onclick=()=>modal.style.display='none';q('#ts-test').onclick=async()=>{try{await testConnect(status,q)}catch(e){status.textContent='❌ '+e.message}};const run=(fn,label)=>async()=>{status.textContent='⏳ '+label+'...';try{const x=await fn();status.textContent=`✅ ${label} complete\nRecords: ${(Array.isArray(x)?x.length:'1')}`}catch(e){status.textContent='❌ '+e.message}};q('#ts-company').onclick=run(()=>loadCompanies(window.TallySyncLastCompanyName||''),'Company import');q('#ts-debtors').onclick=run(importDebtors,'Debtors import');q('#ts-items').onclick=run(importItems,'Items import');q('#ts-invoices').onclick=()=>run(()=>importInvoices(q('#ts-from').value,q('#ts-to').value),'Invoice import')();q('#ts-all').onclick=()=>run(()=>importAll(q('#ts-from').value,q('#ts-to').value),'Complete Tally import')();window.__tsPanel={loadCompanies,importDebtors,importItems,importInvoices,importAll}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel);else panel();
})();

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
