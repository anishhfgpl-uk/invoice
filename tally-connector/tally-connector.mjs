import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TALLY_URL=process.env.TALLY_URL||'http://127.0.0.1:9000';
const PORT=Number(process.env.CONNECTOR_PORT||9101);
const HOST=process.env.CONNECTOR_HOST||'0.0.0.0';
const RELAY_URL=(process.env.RELAY_URL||'https://tally-relay-anish-anish.onrender.com').replace(/\/$/,'');
const CODE_FILE=process.env.OFFICE_CODE_FILE||'.office-code';

function makeCode(){return `ANISH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`}
function loadCode(){const env=(process.env.OFFICE_CODE||'').trim().toUpperCase();if(env)return env;try{const x=fs.readFileSync(CODE_FILE,'utf8').trim().toUpperCase();if(/^[A-Z0-9_-]{6,40}$/.test(x))return x}catch{}const c=makeCode();try{fs.writeFileSync(CODE_FILE,c+'\n','utf8')}catch{}return c}
const OFFICE_CODE=loadCode();

const ALLOWED_ORIGINS=new Set(['https://anish-tech.online','http://localhost:3000','http://127.0.0.1:3000']);
let relayConnected=false;
let relaySocket=null;
let reconnectTimer=null;
let tallyQueue=Promise.resolve();

function cors(origin){const h={'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'};if(ALLOWED_ORIGINS.has(origin))h['Access-Control-Allow-Origin']=origin;return h}
function send(res,status,body,origin,type='application/json'){res.writeHead(status,{'Content-Type':type,...cors(origin)});res.end(body)}
async function read(req){const a=[];for await(const c of req)a.push(c);return Buffer.concat(a).toString('utf8')}
async function tally(xml){const r=await fetch(TALLY_URL,{method:'POST',headers:{'Content-Type':'text/xml'},body:xml,signal:AbortSignal.timeout(30000)});return r.text()}

function relayWsUrl(){return RELAY_URL.replace(/^https:/,'wss:').replace(/^http:/,'ws:')+`/agent?code=${encodeURIComponent(OFFICE_CODE)}`}

function connectRelay(){
  if(relaySocket && (relaySocket.readyState===0 || relaySocket.readyState===1))return;
  clearTimeout(reconnectTimer);
  try{
    const url=relayWsUrl();
    console.log(`Connecting to Relay WebSocket: ${url}`);
    const ws=new WebSocket(url);
    relaySocket=ws;
    ws.addEventListener('open',()=>{
      relayConnected=true;
      console.log(`Relay WebSocket connected: ${url}`);
    });
    ws.addEventListener('message',event=>{
      try{
        const msg=JSON.parse(typeof event.data==='string'?event.data:Buffer.from(event.data).toString('utf8'));
        if(msg.type!=='tally_xml'||!msg.id)return;
        tallyQueue=tallyQueue.then(async()=>{
          let result;
          try{
            result=await tally(String(msg.xml||''));
          }catch(e){
            result=`<ENVELOPE><BODY><LINEERROR>${String(e.message).replace(/[<&>]/g,'')}</LINEERROR></BODY></ENVELOPE>`;
          }
          if(ws.readyState===1){
            ws.send(JSON.stringify({type:'tally_result',id:msg.id,xml:result}));
          }
        }).catch(e=>console.log('Tally queue:',e.message));
      }catch(e){console.log('Relay message:',e.message)}
    });
    ws.addEventListener('close',event=>{
      if(relaySocket===ws)relaySocket=null;
      relayConnected=false;
      console.log(`Relay WebSocket closed: code=${event.code||0} reason=${event.reason||'none'}`);
      reconnectTimer=setTimeout(connectRelay,2000);
    });
    ws.addEventListener('error',event=>{
      relayConnected=false;
      console.log('Relay WebSocket error:',event?.message||event?.error?.message||'connection error');
    });
  }catch(e){
    relayConnected=false;
    console.log('Relay WebSocket exception:',e.message);
    reconnectTimer=setTimeout(connectRelay,2000);
  }
}

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin||'';
  if(req.method==='OPTIONS'){
    if(origin&&!ALLOWED_ORIGINS.has(origin))return send(res,403,JSON.stringify({ok:false,error:'Origin not allowed'}),origin);
    res.writeHead(204,cors(origin));return res.end();
  }
  const u=new URL(req.url,`http://${req.headers.host}`);
  try{
    if(u.pathname==='/health'&&req.method==='GET'){
      let ok=false;
      try{ok=(await fetch(TALLY_URL,{signal:AbortSignal.timeout(3000)})).ok}catch{}
      return send(res,200,JSON.stringify({ok:true,service:'tally-connector',tallyUrl:TALLY_URL,tally:ok,relay:relayConnected,relayUrl:RELAY_URL,officeCode:OFFICE_CODE}),origin)
    }
    if(u.pathname==='/code'&&req.method==='GET')return send(res,200,JSON.stringify({ok:true,officeCode:OFFICE_CODE,relay:relayConnected,relayUrl:RELAY_URL}),origin)
    if((u.pathname==='/tally/xml'||u.pathname==='/tally')&&req.method==='POST'){
      if(origin&&!ALLOWED_ORIGINS.has(origin))return send(res,403,JSON.stringify({ok:false,error:'Origin not allowed'}),origin);
      const xml=await read(req);
      if(!xml.trim())return send(res,400,JSON.stringify({ok:false,error:'XML body required'}),origin);
      return send(res,200,await tally(xml),origin,'text/xml; charset=utf-8');
    }
    return send(res,404,JSON.stringify({ok:false,error:'Not found'}),origin);
  }catch(e){return send(res,502,JSON.stringify({ok:false,error:String(e.message||e)}),origin)}
});

server.listen(PORT,HOST,()=>{
  console.log(`Tally connector running on http://${HOST}:${PORT}`);
  console.log(`Tally target: ${TALLY_URL}`);
  console.log(`Computer Code: ${OFFICE_CODE}`);
  console.log(`Secure Relay: ${RELAY_URL}`);
  console.log('Keep this window running while the office Tally is connected.');
  connectRelay();
});
