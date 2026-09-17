/* Tally company test hotfix: robustly reads COMPANY/NAME attributes and activates the company. */
// deployment trigger: 2026-09-17-cors-fix
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
      if(!code&&!url) { status.textContent='❌ Remote Office Code ya Connector URL enter karein'; return; }
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
      try{
        let raw='',remoteError='';
        // Local connector is preferred on the office computer. Its own process
        // can then use the secure relay without the browser doing a CORS preflight.
        try{ raw=await send(localEndpoint) }
        catch(e){ remoteError=`Local connector: ${e?.message||e}`; if(!remoteEndpoint)throw e; raw=await send(remoteEndpoint) }
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
        localStorage.setItem('tallysync_selected_company',JSON.stringify(company));localStorage.setItem('tallysync_company_profile',JSON.stringify(company));localStorage.setItem('tallysync_companies',JSON.stringify([company]));
        localStorage.setItem('tallysync_active_comp_v2',`tally_${name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,80)}`);localStorage.setItem('tallysync_companies_v2',JSON.stringify([{id:`tally_${name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,80)}`,name:name,formalName:name,gstin:company.GSTIN||'',state:company.StateName||'',pincode:company.PinCode||'',phone:company.PhoneNumber||'',email:company.Email||''}]));
        window.TallySyncLastCompanyName=name;window.TallySyncActiveCompany=company;window.dispatchEvent(new CustomEvent('tallysync:company-updated',{detail:{companies:[company],selected:company}}));status.innerHTML=`<b style="color:#047857">✅ Tally Connected Successfully</b><br>Company: ${name}<br>GSTIN: ${company.GSTIN||'-'}`;setTimeout(()=>location.reload(),300);
      }catch(e){status.textContent='❌ '+(e?.message||e)}
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
(()=>{let timer=0;const wrap=()=>{const p=window.__tsPanel;if(!p||p.__invoiceReloadWrapped)return false;const original=p.importInvoices;if(typeof original!=='function')return false;p.importInvoices=async(...args)=>{const result=await original(...args);clearTimeout(timer);timer=setTimeout(()=>location.reload(),500);return result};p.__invoiceReloadWrapped=true;return true};const wait=()=>wrap()||setTimeout(wait,300);wait()})();
