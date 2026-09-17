/* Remote Tally connector UI v12 - weekly invoice import + local fallback */
(()=>{
const RELAY='https://tally-relay-anil-sharma.onrender.com';
const K={url:'tallysync_connector_url',code:'tallysync_office_code',company:'tallysync_selected_company',companies:'tallysync_companies',companyData:'tallysync_company_profile',debtors:'tallysync_debtors',items:'tallysync_items',invoices:'tallysync_invoices'};
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const saved=()=>localStorage.getItem(K.url)||'http://127.0.0.1:9101', code=()=>localStorage.getItem(K.code)||'';
const selected=()=>{try{return JSON.parse(localStorage.getItem(K.company)||'null')}catch{return null}};
const num=v=>{const n=Number(String(v??'').replace(/,/g,'').replace(/[A-Za-z]/g,'').trim());return Number.isFinite(n)?Math.abs(n):0};
const safeId=(p,v)=>`${p}_tally_${String(v||'x').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70)}`;
async function request(u,xml,timeout=120000){
  const r=await fetch(u,{method:'POST',headers:{'Content-Type':'text/xml;charset=utf-8'},body:xml,signal:AbortSignal.timeout(timeout)});
  const t=await r.text();
  if(!r.ok)throw Error(t.slice(0,400)||`HTTP ${r.status}`);
  return t;
}
async function post(xml){
  const c=code(),local=saved().replace(/\/$/,''),remote=c?`${RELAY}/api/device/${encodeURIComponent(c)}/xml`:'';
  let remoteError='';
  if(remote){
    try{return await request(remote,xml,120000)}catch(e){
      if(e?.name==='AbortError' || e?.name==='TimeoutError') remoteError='Remote relay timeout (120 sec)';
      else remoteError=`Remote relay fetch failed: ${e?.message||e}`;
    }
  }
  try{return await request(`${local}/tally/xml`,xml,120000)}catch(e){
    const localError=(e?.name==='AbortError'||e?.name==='TimeoutError')?'Local connector timeout (120 sec)':`Local connector fetch failed: ${e?.message||e}`;
    throw Error(`${remoteError?remoteError+'; ':''}${localError}. Connector ${local} par running hona chahiye.`)
  }
}
const companyTag=()=>selected()?.Name?`<SVCURRENTCOMPANY>${esc(selected().Name)}</SVCURRENTCOMPANY>`:'';
async function collection(name,type,fetches,extra='',useCompany=true){return post(`<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${useCompany?companyTag():''}${extra}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}" ISMODIFY="No"><TYPE>${type}</TYPE><FETCH>${fetches}</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`)}
function parse(raw,tags){const d=new DOMParser().parseFromString(String(raw||''),'text/xml');const er=[...d.querySelectorAll('LINEERROR,ERROR')].map(x=>x.textContent.trim()).filter(Boolean);if(er.length)throw Error(er.join(' | '));return [...d.querySelectorAll('LEDGER,STOCKITEM,VOUCHER,COMPANY')].map(n=>{const o={};tags.forEach(t=>{const q=n.querySelector(t)||n.querySelector(t.toUpperCase());o[t]=(q?.textContent||n.getAttribute(t)||'').trim()});return o}).filter(o=>Object.values(o).some(Boolean))}
function parseCompanies(raw){const d=new DOMParser().parseFromString(String(raw||''),'text/xml');const er=[...d.querySelectorAll('LINEERROR,ERROR')].map(x=>x.textContent.trim()).filter(Boolean);if(er.length)throw Error(er.join(' | '));return [...d.querySelectorAll('COMPANY')].map(n=>({Name:(n.querySelector('NAME')?.textContent||n.getAttribute('NAME')||'').trim(),Guid:(n.querySelector('GUID')?.textContent||'').trim(),GSTIN:(n.querySelector('GSTIN')?.textContent||'').trim(),StateName:(n.querySelector('STATENAME')?.textContent||'').trim(),PinCode:(n.querySelector('PINCODE')?.textContent||'').trim()})).filter(x=>x.Name)}
function emit(name,data){try{localStorage.setItem(name,JSON.stringify(data))}catch{};window.dispatchEvent(new CustomEvent('tallysync:import',{detail:{type:name,data,company:selected()}}))}
async function loadCompanies(){const raw=await collection('Company Collection','Company','Name,Guid,GSTIN,StateName,PinCode','',false),rows=parseCompanies(raw);if(!rows.length)throw Error('TallyPrime me company open nahi hai.');const wanted=selected()?.Name,chosen=rows.find(x=>wanted&&x.Name===wanted)||rows[0];localStorage.setItem(K.companies,JSON.stringify(rows));localStorage.setItem(K.company,JSON.stringify(chosen));localStorage.setItem(K.companyData,JSON.stringify(chosen));window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies:rows,selected:chosen}}));return chosen}
async function importDebtors(){if(!selected())await loadCompanies();const a=parse(await collection('All Ledgers','Ledger','Name,Parent,ClosingBalance,OpeningBalance,PhoneNumber,Email,GSTIN,Address,MailingName,StateName,PinCode,PartyGSTIN,LedgerContact,LedgerPhone'),['Name','Parent','ClosingBalance','OpeningBalance','PhoneNumber','Email','GSTIN','Address','MailingName','StateName','PinCode','PartyGSTIN','LedgerContact','LedgerPhone']).filter(x=>/sundry\s*debtors/i.test(x.Parent||''));emit(K.debtors,a);return a}
async function importItems(){if(!selected())await loadCompanies();const a=parse(await collection('All Stock Items','StockItem','Name,Parent,ClosingBalance,OpeningBalance,BaseUnits,Rate,HSNCode,HSNName,TaxRate'),['Name','Parent','ClosingBalance','OpeningBalance','BaseUnits','Rate','HSNCode','HSNName','TaxRate']);emit(K.items,a);return a}
function dt(s){let v=String(s||'').trim(),m=v.match(/^(\d{4})(\d{2})(\d{2})$/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=v.match(/^(\d{2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/);if(m){const z={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};return new Date(+m[3],z[m[2]]??0,+m[1])}return new Date(v)}
function ymd(s){const d=dt(s);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function ranges(from,to){const a=dt(from),b=dt(to),r=[];if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||a>b)throw Error('Invoice date range invalid hai');for(let d=new Date(a);d<=b;){let e=new Date(d);e.setDate(e.getDate()+6);if(e>b)e=new Date(b);r.push([`${String(d.getDate()).padStart(2,'0')}-${d.toLocaleString('en',{month:'short'})}-${d.getFullYear()}`,`${String(e.getDate()).padStart(2,'0')}-${e.toLocaleString('en',{month:'short'})}-${e.getFullYear()}`]);d=new Date(e);d.setDate(d.getDate()+1)}return r}
function invoiceRows(raw){return parse(raw,['Date','VoucherNumber','VoucherTypeName','PartyLedgerName','Amount','Reference','ReferenceDate','Narration','GUID','MasterID'])}
function toAppInvoices(rows){const comp=selected()||{},companyId=String(comp.Guid||`comp_tally_${String(comp.Name||'company').toLowerCase().replace(/[^a-z0-9]+/g,'_')}`);return rows.map((v,i)=>{const date=ymd(v.Date),name=String(v.PartyLedgerName||'').trim(),total=num(v.Amount);return {id:String(v.GUID||v.MasterID||`inv_tally_${v.VoucherNumber||i}_${date}`),companyId,invoiceNumber:String(v.VoucherNumber||v.MasterID||i),invoiceDate:date,dueDate:date,debtorId:safeId('deb',name),debtorName:name,debtorAddress:'',debtorState:'',debtorStateCode:'',placeOfSupply:'',placeOfSupplyCode:'',isInterState:false,items:[],subTotal:total,totalDiscount:0,totalTaxable:total,cgstTotal:0,sgstTotal:0,igstTotal:0,roundOff:0,grandTotal:total,notes:String(v.Narration||''),paymentTerms:'',status:'Unpaid',amountPaid:0,balanceDue:total}})}
async function importInvoices(from='01-Apr-2026',to='30-Sep-2026',progress=()=>{}){if(!selected())await loadCompanies();const rs=ranges(from,to),all=[];for(let i=0;i<rs.length;i++){const [f,t]=rs[i];progress(i+1,rs.length,f,t);const extra=`<SVFROMDATE TYPE="Date">${f}</SVFROMDATE><SVTODATE TYPE="Date">${t}</SVTODATE><SVViewName>Accounting Voucher View</SVViewName>`;const rows=invoiceRows(await collection('Invoice Vouchers','Voucher','Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Reference,ReferenceDate,Narration,GUID,MasterID',extra));all.push(...rows);const appRows=toAppInvoices(rows);let old=[];try{old=JSON.parse(localStorage.getItem('tallysync_invoices_v2')||'[]')}catch{};const map=new Map(old.map(x=>[String(x.id),x]));appRows.forEach(x=>map.set(x.id,x));localStorage.setItem('tallysync_invoices_v2',JSON.stringify([...map.values()]));emit(K.invoices,rows)}return all}
async function importAll(from,to,progress){const company=await loadCompanies();const debtors=await importDebtors(),items=await importItems(),invoices=await importInvoices(from,to,progress);window.dispatchEvent(new CustomEvent('tallysync:data',{detail:{company,data:{company,debtors,stock:items,invoices}}}));return {company,debtors,items,invoices}}
function panel(){if(document.getElementById('ts-connect'))return;const b=document.createElement('div');b.id='ts-connect';b.style.cssText='position:fixed;right:24px;bottom:24px;z-index:99999;font-family:Inter,Arial,sans-serif';b.innerHTML=`<button id="ts-connect-btn" style="min-width:190px;padding:13px 20px;border:0;border-radius:12px;background:#0f172a;color:#fff;font-weight:800;cursor:pointer">🔗 Connect Tally</button><div id="ts-modal" style="display:none;position:fixed;inset:0;background:#0f172a99;align-items:center;justify-content:center"><div style="background:#fff;width:min(620px,94vw);max-height:90vh;overflow:auto;border-radius:18px"><div style="padding:20px;background:#0f172a;color:#fff"><b style="font-size:21px">Connect TallyPrime</b></div><div style="padding:20px"><label>Remote Office Code</label><input id="ts-code" value="${esc(code())}" style="width:100%;box-sizing:border-box;margin:7px 0 12px;padding:12px"><label>Connector URL</label><input id="ts-url" value="${esc(saved())}" style="width:100%;box-sizing:border-box;margin:7px 0 12px;padding:12px"><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="ts-test">Test & Connect</button><button id="ts-company">Import Company</button><button id="ts-debtors">Import Debtors</button><button id="ts-items">Import Items</button><button id="ts-invoices">Import Invoices</button><button id="ts-all">Import Everything</button><button id="ts-close">Close</button></div><div style="margin-top:14px;display:flex;gap:8px"><input id="ts-from" value="01-Apr-2026" style="width:50%;padding:9px"><input id="ts-to" value="30-Sep-2026" style="width:50%;padding:9px"></div><div id="ts-status" style="margin-top:14px;white-space:pre-wrap"></div></div></div></div>`;document.body.appendChild(b);const q=s=>b.querySelector(s),modal=q('#ts-modal'),status=q('#ts-status');window.TallySyncOpen=()=>modal.style.display='flex';q('#ts-connect-btn').onclick=window.TallySyncOpen;q('#ts-close').onclick=()=>modal.style.display='none';q('#ts-test').onclick=async()=>{try{const c=q('#ts-code').value.trim().toUpperCase(),u=q('#ts-url').value.trim();localStorage.setItem(K.code,c);localStorage.setItem(K.url,u||'http://127.0.0.1:9101');const x=await loadCompanies();status.textContent=`✅ Tally Connected\nCompany: ${x.Name}`}catch(e){status.textContent='❌ '+e.message}};const run=async(fn,label)=>{status.textContent='⏳ '+label+'...';try{const x=await fn();status.textContent=`✅ ${label} complete\nRecords: ${Array.isArray(x)?x.length:1}`}catch(e){status.textContent='❌ '+e.message}};q('#ts-company').onclick=()=>run(loadCompanies,'Company import');q('#ts-debtors').onclick=()=>run(importDebtors,'Debtors import');q('#ts-items').onclick=()=>run(importItems,'Items import');q('#ts-invoices').onclick=()=>run(()=>importInvoices(q('#ts-from').value,q('#ts-to').value,(i,n,f,t)=>status.textContent=`⏳ Invoice import: week ${i}/${n}\n${f} → ${t}`),'Invoice import');q('#ts-all').onclick=()=>run(()=>importAll(q('#ts-from').value,q('#ts-to').value,(i,n,f,t)=>status.textContent=`⏳ Complete import: invoice week ${i}/${n}\n${f} → ${t}`),'Complete Tally import');window.__tsPanel={loadCompanies,importDebtors,importItems,importInvoices,importAll}}
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
/* Tally company test hotfix: robustly reads COMPANY/NAME attributes and activates the company. */
// deployment trigger: 2026-09-17-cors-fix-v2
(()=>{
  function boot(){
    const btn=document.getElementById('ts-test');
    const status=document.getElementById('ts-status');
    if(!btn||!status){setTimeout(boot,250);return}
    if(btn.dataset.companyHotfix==='1')return;
    btn.dataset.companyHotfix='1';
    btn.onclick=async()=>{
      const code=(document.getElementById('ts-code')?.value||'').trim().toUpperCase();
      const url=(document.getElementById('ts-url')?.value||'http://127.0.0.1:9101').trim().replace(/\/$/,'');
      if(!code&&!url){status.textContent='❌ Remote Office Code ya Connector URL enter karein';return}
      localStorage.setItem('tallysync_office_code',code);
      localStorage.setItem('tallysync_connector_url',url);
      localStorage.removeItem('tallysync_selected_company');
      status.textContent='⏳ Tally se company read ho rahi hai...';
      const relay='https://tally-relay-anil-sharma.onrender.com';
      const remoteEndpoint=code?`${relay}/api/device/${encodeURIComponent(code)}/xml`:'';
      const localEndpoint=`${url}/tally/xml`;
      const xml='<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>Company Collection</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="Company Collection" ISMODIFY="No" ISFIXED="No"><TYPE>Company</TYPE><FETCH>Name,Guid,MailingName,StateName,PinCode,PhoneNumber,Email,GSTIN</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>';
      async function send(endpoint){
        const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:xml,signal:AbortSignal.timeout(45000)});
        const raw=await r.text();
        if(!r.ok)throw Error(raw.slice(0,500)||`HTTP ${r.status}`);
        return raw;
      }
      let localError='';
      try{
        let raw='';
        try{raw=await send(localEndpoint)}
        catch(e){
          localError=`Local connector: ${e?.message||e}`;
          if(!remoteEndpoint)throw e;
          raw=await send(remoteEndpoint);
        }
        const doc=new DOMParser().parseFromString(raw,'text/xml');
        const errors=[...doc.getElementsByTagName('LINEERROR'),...doc.getElementsByTagName('ERROR')].map(x=>(x.textContent||'').trim()).filter(Boolean);
        if(errors.length)throw Error(errors.join(' | '));
        const nodes=[...doc.getElementsByTagName('*')].filter(n=>/^(COMPANY|NAME)$/i.test(n.tagName)||n.hasAttribute('NAME'));
        let name='';
        for(const n of nodes){const a=n.getAttribute&&(n.getAttribute('NAME')||n.getAttribute('Name'));const t=(n.textContent||'').trim();if(/^COMPANY$/i.test(n.tagName)&&a){name=a;break}if(/^NAME$/i.test(n.tagName)&&t){name=t;break}if(a&&n.tagName){name=a;break}}
        if(!name){const m=raw.match(/<COMPANY[^>]*\bNAME\s*=\s*[\"']([^\"']+)[\"']/i)||raw.match(/<NAME[^>]*>([^<]+)<\/NAME>/i);if(m)name=(m[1]||'').trim()}
        if(!name)throw Error('Tally response me company name nahi mila. TallyPrime me company open/check karein.');
        const company={Name:name};
        const companyNode=[...doc.getElementsByTagName('*')].find(n=>/^COMPANY$/i.test(n.tagName));
        if(companyNode)for(const k of ['Guid','MailingName','StateName','PinCode','PhoneNumber','Email','GSTIN']){const el=[...companyNode.getElementsByTagName('*')].find(n=>n.tagName.toLowerCase()===k.toLowerCase());company[k]=(el?.textContent||companyNode.getAttribute(k)||companyNode.getAttribute(k.toUpperCase())||'').trim()}
        localStorage.setItem('tallysync_selected_company',JSON.stringify(company));
        localStorage.setItem('tallysync_company_profile',JSON.stringify(company));
        localStorage.setItem('tallysync_companies',JSON.stringify([company]));
        localStorage.setItem('tallysync_active_comp_v2',`tally_${name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,80)}`);
        localStorage.setItem('tallysync_companies_v2',JSON.stringify([{id:`tally_${name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,80)}`,name:name,formalName:name,gstin:company.GSTIN||'',state:company.StateName||'',pincode:company.PinCode||'',phone:company.PhoneNumber||'',email:company.Email||''}]));
        window.TallySyncLastCompanyName=name;
        window.TallySyncActiveCompany=company;
        window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies:[company],selected:company}}));
        status.innerHTML=`<b style="color:#047857">✅ Tally Connected Successfully</b><br>Company: ${name}<br>GSTIN: ${company.GSTIN||'-'}`;
        setTimeout(()=>location.reload(),300);
      }catch(e){
        status.textContent='❌ '+(e?.message||e)+(localError?`\n${localError}`:'');
      }
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
(()=>{let timer=0;const wrap=()=>{const p=window.__tsPanel;if(!p||p.__invoiceReloadWrapped)return false;const original=p.importInvoices;if(typeof original!=='function')return false;p.importInvoices=async(...args)=>{const result=await original(...args);clearTimeout(timer);timer=setTimeout(()=>location.reload(),500);return result};p.__invoiceReloadWrapped=true;return true};const wait=()=>wrap()||setTimeout(wait,300);wait()})();

