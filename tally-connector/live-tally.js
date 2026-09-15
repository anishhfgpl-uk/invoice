(()=>{
const RELAY='https://tally-relay-anish.onrender.com',K={url:'tallysync_connector_url',code:'tallysync_office_code',company:'tallysync_selected_company'};
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const saved=()=>localStorage.getItem(K.url)||'http://127.0.0.1:9101',code=()=>localStorage.getItem(K.code)||'';
const selected=()=>{try{return JSON.parse(localStorage.getItem(K.company)||'null')}catch{return null}};
async function post(xml){const c=code();const u=c?`${RELAY}/api/device/${encodeURIComponent(c)}/xml`:saved().replace(/\/$/,'')+'/tally/xml';let r;try{r=await fetch(u,{method:'POST',headers:{'Content-Type':'text/xml;charset=utf-8'},body:xml,signal:AbortSignal.timeout(40000)})}catch(e){throw Error('Network/relay timeout. Office connector online hai?')}const text=await r.text();if(!r.ok)throw Error(text.slice(0,300)||`HTTP ${r.status}`);if(!text.trim())throw Error('Empty response from Tally');return text}
const companyTag=()=>{const c=selected();return c?.Name?`<SVCURRENTCOMPANY>${esc(c.Name)}</SVCURRENTCOMPANY>`:''};
async function collection(name,type,fetches,extra='',useCompany=true){const tag=useCompany?companyTag():'';return post(`<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${tag}${extra}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}"><TYPE>${type}</TYPE><FETCH>${fetches}</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`)}
function parse(raw,tags){const d=new DOMParser().parseFromString(raw,'text/xml');if(d.querySelector('parsererror'))throw Error('Invalid XML response');const nodes=[...d.querySelectorAll('LEDGER,STOCKITEM,VOUCHER,COMPANY')];return nodes.map(n=>{const o={};tags.forEach(t=>{const q=n.querySelector(t)||n.querySelector(t.toUpperCase());o[t]=(q?.textContent||n.getAttribute(t)||n.getAttribute(t.toUpperCase())||'').trim()});return o}).filter(o=>Object.values(o).some(Boolean))}
function isOur(n){return !!(n&&((n.id||'').startsWith('ts-')||n.closest?.('#ts-connect')||n.closest?.('#anish-fixed-brand')))}
function text(n){return(n?.innerText||n?.textContent||n?.value||'').replace(/\s+/g,' ').trim()}
function hideOldTallyUI(){
  document.querySelectorAll('button,a,[role="button"],input').forEach(el=>{
    if(isOur(el))return;
    const t=text(el).toLowerCase();
    if(/^(🔗\s*)?(connect tally|tally connect|connect to tally)$/.test(t)||/^(🔗\s*)?tally\s*connect$/.test(t)){
      const box=el.closest('section,article,div,form,li')||el;
      if(!isOur(box)) box.style.setProperty('display','none','important');
      el.style.setProperty('display','none','important');
    }
  });
  document.querySelectorAll('body *').forEach(el=>{
    if(isOur(el))return;
    const t=text(el).toLowerCase();
    if(t==='tally connect'||t==='connect tally'||t==='connect to tally')el.style.setProperty('display','none','important');
  });
}
function brand(){
  let b=document.getElementById('anish-fixed-brand');
  if(!b){
    b=document.createElement('div');b.id='anish-fixed-brand';b.textContent='ANISH TECHNOLOGIES';
    b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99998;height:46px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:linear-gradient(135deg,#0b1220,#172554);color:#fff;font:800 18px/46px Arial,sans-serif;letter-spacing:2px;border-bottom:2px solid #2563eb;box-shadow:0 4px 18px #0003;pointer-events:none;white-space:nowrap;overflow:hidden';
    document.body.appendChild(b);
  }
  document.documentElement.style.scrollPaddingTop='54px';document.body.style.paddingTop='46px';
  const cleanBrand=()=>{
    const target='ANISH TECHNOLOGIES';
    document.querySelectorAll('body *').forEach(el=>{
      if(el===b||el.closest?.('#anish-fixed-brand')||el.id==='ts-connect')return;
      const t=text(el).replace(/\s+/g,' ').trim().toUpperCase();
      if(t===target)el.style.setProperty('display','none','important');
    });
  };
  cleanBrand();
  new MutationObserver(cleanBrand).observe(document.body,{childList:true,subtree:true,characterData:true});
}
function liveUI(){}
let DATA={ledgers:[],stock:[],sales:[],purchase:[]};
async function loadLiveData(){try{if(!selected())throw Error('Company select nahi hui');const [l,s,v]=await Promise.all([collection('Live Ledgers','Ledger','Name,Parent,ClosingBalance,OpeningBalance,PhoneNumber,Email,GSTIN,Address'),collection('Live Stock','StockItem','Name,Parent,ClosingBalance,ClosingValue,BaseUnits,Rate'),collection('Live Vouchers','Voucher','Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Reference,Narration')]);DATA.ledgers=parse(l,['Name','Parent','ClosingBalance','OpeningBalance','PhoneNumber','Email','GSTIN','Address']);DATA.stock=parse(s,['Name','Parent','ClosingBalance','ClosingValue','BaseUnits','Rate']);const all=parse(v,['Date','VoucherNumber','VoucherTypeName','PartyLedgerName','Amount','Reference','Narration']);DATA.sales=all.filter(x=>/sales/i.test(x.VoucherTypeName||''));DATA.purchase=all.filter(x=>/purchase/i.test(x.VoucherTypeName||''));window.__tallyLiveData=DATA;window.dispatchEvent(new CustomEvent('tallysync:data',{detail:{company:selected(),data:DATA}}));return DATA}catch(e){window.dispatchEvent(new CustomEvent('tallysync:error',{detail:e.message}));throw e}}
async function loadCompanies(){try{const raw=await collection('Company Collection','Company','Name,Guid,MailingName,StateName,PinCode,PhoneNumber,Email,GSTIN','',false);const rows=parse(raw,['Name','Guid','MailingName','StateName','PinCode','PhoneNumber','Email','GSTIN']);if(!rows.length)throw Error('Tally ne koi company return nahi ki. TallyPrime me company open hai?');const old=selected();const chosen=rows.find(x=>old&&x.Name===old.Name)||rows[0];localStorage.setItem(K.company,JSON.stringify(chosen));window.dispatchEvent(new CustomEvent('tallysync:companies',{detail:{companies:rows,selected:chosen}}));return loadLiveData()}catch(e){window.dispatchEvent(new CustomEvent('tallysync:error',{detail:e.message}));throw e}}
function panel(){if(document.getElementById('ts-connect'))return;hideOldTallyUI();brand();const b=document.createElement('div');b.id='ts-connect';b.style.cssText='position:fixed;right:24px;bottom:24px;z-index:99999;font-family:Inter,Arial,sans-serif';b.innerHTML=`<button id="ts-connect-btn" style="display:block;min-width:190px;padding:13px 20px;border:0;border-radius:12px;background:#0f172a;color:white;font-weight:800;cursor:pointer;box-shadow:0 8px 25px #0003">🔗 Connect Tally</button><div id="ts-modal" style="display:none;position:fixed;inset:0;background:#0f172a99;align-items:center;justify-content:center"><div style="background:white;width:min(560px,92vw);border-radius:18px;box-shadow:0 20px 60px #0005;overflow:hidden"><div style="padding:20px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:white"><b style="font-size:21px">Connect TallyPrime</b><div style="font-size:12px;opacity:.8;margin-top:4px">Office computer connector + secure relay</div></div><div style="padding:20px"><label style="font-size:12px;font-weight:700">Remote Office Code</label><input id="ts-code" value="${esc(code())}" placeholder="ANISH-XXXXXXXX" style="width:100%;box-sizing:border-box;margin:7px 0 14px;padding:12px;border:1px solid #cbd5e1;border-radius:10px"><details style="margin-bottom:14px"><summary style="cursor:pointer;font-size:12px;color:#475569">Advanced: direct connector URL</summary><input id="ts-url" value="${esc(saved())}" style="width:100%;box-sizing:border-box;margin-top:8px;padding:10px;border:1px solid #cbd5e1;border-radius:9px"></details><div style="display:flex;gap:8px;justify-content:flex-end"><button id="ts-close">Cancel</button><button id="ts-test" style="background:#0f172a;color:white">Test Tally</button></div><div id="ts-status" style="margin-top:14px;font-size:13px"></div></div></div></div>`;document.body.appendChild(b);const modal=b.querySelector('#ts-modal'),status=b.querySelector('#ts-status');b.querySelector('#ts-connect-btn').onclick=()=>{modal.style.display='flex';b.querySelector('#ts-code').focus()};b.querySelector('#ts-close').onclick=()=>modal.style.display='none';b.querySelector('#ts-test').onclick=async()=>{const c=b.querySelector('#ts-code').value.trim().toUpperCase(),u=b.querySelector('#ts-url').value.trim();if(!c&&!u){status.textContent='❌ Office Code enter karein';return}localStorage.setItem(K.code,c);localStorage.setItem(K.url,u||'http://127.0.0.1:9101');localStorage.removeItem(K.company);status.textContent='⏳ Checking office connector and Tally...';try{const raw=await collection('Connection Test','Company','Name','',false);if(/LINEERROR|<ERROR/i.test(raw))throw Error((raw.match(/<LINEERROR[^>]*>([\s\S]*?)<\/LINEERROR>/i)||[])[1]||'Tally returned an error');if(!/<ENVELOPE/i.test(raw))throw Error('Invalid Tally response');status.textContent='✅ Tally connected. Loading companies...';const companies=await loadCompanies();status.textContent=`✅ Tally connected · ${companies?.Name||selected()?.Name||''}`;setTimeout(()=>modal.style.display='none',700)}catch(e){status.textContent='❌ '+e.message}};window.__tsPanel={loadCompanies,loadLiveData}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel);else panel();new MutationObserver(()=>hideOldTallyUI()).observe(document.documentElement,{childList:true,subtree:true});
})();