(()=>{
  const RELAY='https://tally-relay-anish.onrender.com';
  const K={url:'tallysync_connector_url',code:'tallysync_office_code',company:'tallysync_selected_company'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const xmlEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const saved=()=>localStorage.getItem(K.url)||'http://127.0.0.1:9101';
  const code=()=>localStorage.getItem(K.code)||'';
  const selected=()=>{try{return JSON.parse(localStorage.getItem(K.company)||'null')}catch{return null}};
  async function post(xml){
    const c=code();
    if(c){const r=await fetch(`${RELAY}/api/device/${encodeURIComponent(c)}/xml`,{method:'POST',headers:{'Content-Type':'text/xml;charset=utf-8'},body:xml});if(!r.ok)throw new Error((await r.text()).slice(0,300)||`Relay HTTP ${r.status}`);return r.text()}
    const u=saved().replace(/\/$/,'')+'/tally/xml';const r=await fetch(u,{method:'POST',headers:{'Content-Type':'text/xml;charset=utf-8'},body:xml});if(!r.ok)throw new Error(`Connector HTTP ${r.status}`);return r.text();
  }
  const companyTag=()=>{const c=selected();return c?.name?`<SVCURRENTCOMPANY>${xmlEsc(c.name)}</SVCURRENTCOMPANY>`:''};
  async function collection(name,type,fetches,extra=''){
    const xml=`<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyTag()}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}"><TYPE>${type}</TYPE>${extra}<FETCH>${fetches}</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
    return post(xml);
  }
  function parseRows(raw,tags){const d=new DOMParser().parseFromString(raw,'text/xml');if(d.querySelector('parsererror'))throw Error('Invalid XML from Tally');const nodes=[...d.querySelectorAll('LEDGER,STOCKITEM,VOUCHER,COMPANY')];return nodes.map(n=>{const o={};for(const t of tags){const q=n.querySelector(t+', '+t.toUpperCase());o[t]=q?.textContent?.trim()||n.getAttribute(t)||n.getAttribute(t.toUpperCase())||''}return o}).filter(o=>Object.values(o).some(Boolean));}
  function panel(){
    if(document.getElementById('ts-live'))return;
    const root=document.createElement('div');root.id='ts-live';root.style.cssText='margin:18px auto;max-width:1400px;padding:0 16px;font-family:Inter,Arial,sans-serif;position:relative;z-index:1000';
    root.innerHTML=`<div style="background:#fff;border:1px solid #dbe2ea;border-radius:18px;box-shadow:0 8px 30px #0f172a14;overflow:hidden"><div style="padding:18px 20px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div style="font-size:22px;font-weight:800">ANISH TECHNOLOGIES · Live Tally</div><div style="font-size:12px;opacity:.78;margin-top:4px">Real-time company, ledger, stock and voucher data</div></div><div id="ts-live-state" style="font-size:12px">Disconnected</div></div><div style="padding:16px"><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ts-live-url" value="${esc(saved())}" placeholder="Direct connector: http://192.168.x.x:9101" style="flex:1;min-width:260px;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><input id="ts-live-code" value="${esc(code())}" placeholder="Remote Office Code" style="width:180px;padding:10px;border:1px solid #cbd5e1;border-radius:9px"><button id="ts-live-save" style="padding:10px 14px;border:0;border-radius:9px;background:#2563eb;color:#fff">Save</button><button id="ts-live-test" style="padding:10px 14px;border:0;border-radius:9px">Test Tally</button></div><div id="ts-live-msg" style="font-size:12px;margin:9px 0;color:#475569"></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin:12px 0"><button data-tab="companies">Companies</button><button data-tab="ledgers">Ledgers</button><button data-tab="stock">Stock Items</button><button data-tab="sales">Sales Invoices</button><button data-tab="purchases">Purchase Vouchers</button></div><div id="ts-live-content" style="min-height:90px"></div></div></div>`;
    document.body.prepend(root);
    const msg=root.querySelector('#ts-live-msg'),state=root.querySelector('#ts-live-state'),content=root.querySelector('#ts-live-content');
    const buttons=[...root.querySelectorAll('[data-tab]')];
    const btnStyle=b=>{b.style.cssText='padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;cursor:pointer'};buttons.forEach(btnStyle);
    root.querySelector('#ts-live-save').onclick=()=>{localStorage.setItem(K.url,root.querySelector('#ts-live-url').value.trim().replace(/\/$/,''));localStorage.setItem(K.code,root.querySelector('#ts-live-code').value.trim().toUpperCase());msg.textContent='Connection settings saved';};
    root.querySelector('#ts-live-test').onclick=async()=>{try{const raw=await post(`<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Company</ID></HEADER><BODY><DESC><STATICVARIABLES>${companyTag()}</STATICVARIABLES></DESC></BODY></ENVELOPE>`);state.textContent='● Connected';state.style.color='#bbf7d0';msg.textContent=raw.includes('<ENVELOPE')?'Tally XML response received':'Tally responded';}catch(e){state.textContent='● Offline';state.style.color='#fecaca';msg.textContent='❌ '+e.message}};
    function table(rows,cols){if(!rows.length)return '<div style="padding:18px;color:#64748b">No records returned by Tally.</div>';let h='<div style="overflow:auto;max-height:480px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'+cols.map(c=>`<th style="text-align:left;padding:9px;border-bottom:2px solid #e2e8f0;white-space:nowrap">${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>';for(const r of rows)h+='<tr>'+cols.map(c=>`<td style="padding:8px;border-bottom:1px solid #eef2f7;white-space:nowrap">${esc(r[c[0]])}</td>`).join('')+'</tr>';return h+'</tbody></table></div>'}
    async function load(tab){
      content.innerHTML='<div style="padding:22px">⏳ Loading live data from Tally...</div>';
      try{
        let raw,rows,cols;
        if(tab==='companies'){
          raw=await collection('Company Collection','Company','Name,Guid,MailingName,StateName,PinCode,PhoneNumber,Email,GSTIN');rows=parseRows(raw,['Name','Guid','MailingName','StateName','PinCode','PhoneNumber','Email','GSTIN']);cols=[['Name','Company'],['GSTIN','GSTIN'],['StateName','State'],['PinCode','PIN'],['PhoneNumber','Phone'],['Email','Email']];
        } else if(tab==='ledgers'){
          raw=await collection('Ledger Collection','Ledger','Name,Parent,OpeningBalance,ClosingBalance,Address,StateName,GSTIN,PhoneNumber,Email');rows=parseRows(raw,['Name','Parent','OpeningBalance','ClosingBalance','StateName','GSTIN','PhoneNumber','Email']);cols=[['Name','Ledger'],['Parent','Group'],['OpeningBalance','Opening'],['ClosingBalance','Closing'],['StateName','State'],['GSTIN','GSTIN'],['PhoneNumber','Phone']];
        } else if(tab==='stock'){
          raw=await collection('Stock Item Collection','Stock Item','Name,Parent,ClosingBalance,ClosingValue,Rate,BaseUnits,PartNo,HSNCode');rows=parseRows(raw,['Name','Parent','ClosingBalance','ClosingValue','Rate','BaseUnits','PartNo','HSNCode']);cols=[['Name','Stock Item'],['Parent','Group'],['ClosingBalance','Closing Qty'],['ClosingValue','Value'],['Rate','Rate'],['BaseUnits','Unit'],['HSNCode','HSN']];
        } else {
          const type=tab==='sales'?'Sales':'Purchase';
          raw=await collection(`${type} Voucher Collection`,'Voucher','Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Narration,MasterID',`<FILTER>${type}Filter</FILTER>`).catch(async()=>collection('Day Book','Voucher','Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Narration,MasterID'));
          rows=parseRows(raw,['Date','VoucherNumber','VoucherTypeName','PartyLedgerName','Amount','Narration','MasterID']).filter(r=>!r.VoucherTypeName || r.VoucherTypeName.toLowerCase().includes(type.toLowerCase()));cols=[['Date','Date'],['VoucherNumber','Voucher No.'],['VoucherTypeName','Type'],['PartyLedgerName','Party'],['Amount','Amount'],['Narration','Narration']];
        }
        content.innerHTML=table(rows,cols);msg.textContent=`✅ ${rows.length} live record(s) loaded from Tally`;
      }catch(e){content.innerHTML=`<div style="padding:18px;color:#b91c1c">❌ ${esc(e.message)}<br><small>Check TallyPrime HTTP Server (port 9000), connector, and selected company.</small></div>`}
    }
    buttons.forEach(b=>b.onclick=()=>load(b.dataset.tab));
    load('companies');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel);else panel();
})();
