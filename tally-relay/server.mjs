import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 10000);
const MAX_BODY = 20 * 1024 * 1024;
const REQUEST_TIMEOUT = 120000;
const devices = new Map();
const pending = new Map();
const CODE_RE = /^[A-Z0-9_-]{6,40}$/;

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Tally-Device-Code',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(data);
}
function code(){return crypto.randomBytes(9).toString('base64url').replace(/[-_]/g,'').slice(0,12).toUpperCase()}
function readBody(req){return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>{data+=chunk;if(data.length>MAX_BODY){reject(new Error('Request too large'));req.destroy()}});req.on('end',()=>resolve(data));req.on('error',reject)})}
function newId(){return crypto.randomUUID()}

async function handleXml(req,res,deviceCode){
  if(!CODE_RE.test(deviceCode))return json(res,400,{ok:false,error:'Invalid office code'});
  const d=devices.get(deviceCode);
  if(!d||d.ws.readyState!==1)return json(res,409,{ok:false,error:'Office Tally connector is offline',code:deviceCode});
  try{
    const xml=await readBody(req),id=newId();
    const p=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Tally request timed out after ${REQUEST_TIMEOUT/1000} seconds`))},REQUEST_TIMEOUT);pending.set(id,{resolve,reject,timer,startedAt:Date.now()})});
    d.lastSeen=Date.now();
    d.ws.send(JSON.stringify({type:'tally_xml',id,xml}));
    const result=await p;
    res.writeHead(200,{'Content-Type':'text/xml; charset=utf-8','Access-Control-Allow-Origin':'*'});
    return res.end(result);
  }catch(e){return json(res,502,{ok:false,error:e.message,code:deviceCode})}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS')return json(res,204,{});
  const u=new URL(req.url,`http://${req.headers.host}`);

  // Friendly root endpoint so opening the relay URL never shows a misleading 404.
  if(u.pathname==='/'&&req.method==='GET')return json(res,200,{ok:true,service:'tallysync-relay',message:'Tally relay is running',devices:devices.size});
  if(u.pathname==='/health')return json(res,200,{ok:true,service:'tallysync-relay',devices:devices.size});

  if(u.pathname==='/api/device/register'&&req.method==='POST')return json(res,200,{ok:true,code:code()});

  const m=u.pathname.match(/^\/api\/device\/([^/]+)\/status$/);
  if(m&&req.method==='GET'){
    const deviceCode=decodeURIComponent(m[1]).toUpperCase();
    if(!CODE_RE.test(deviceCode))return json(res,400,{ok:false,error:'Invalid office code'});
    const d=devices.get(deviceCode);
    return json(res,200,{ok:true,connected:!!d,lastSeen:d?.lastSeen||null,code:deviceCode});
  }

  // Legacy status alias: /api/device/:code
  const legacyStatus=u.pathname.match(/^\/api\/device\/([^/]+)$/);
  if(legacyStatus&&req.method==='GET'){
    const deviceCode=decodeURIComponent(legacyStatus[1]).toUpperCase();
    if(!CODE_RE.test(deviceCode))return json(res,400,{ok:false,error:'Invalid office code'});
    const d=devices.get(deviceCode);
    return json(res,200,{ok:true,connected:!!d,lastSeen:d?.lastSeen||null,code:deviceCode});
  }

  const x=u.pathname.match(/^\/api\/device\/([^/]+)\/xml$/);
  if(x&&req.method==='POST'){
    return handleXml(req,res,decodeURIComponent(x[1]).toUpperCase());
  }

  // Legacy XML aliases for older website bundles.
  const legacyXml=u.pathname.match(/^\/api\/device\/([^/]+)\/(?:tally|request)$/);
  if(legacyXml&&req.method==='POST'){
    return handleXml(req,res,decodeURIComponent(legacyXml[1]).toUpperCase());
  }

  json(res,404,{ok:false,error:'Not found',path:u.pathname});
});

const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{
  const u=new URL(req.url,`http://${req.headers.host}`);
  if(u.pathname!=='/agent')return socket.destroy();
  const c=(u.searchParams.get('code')||'').toUpperCase();
  if(!CODE_RE.test(c))return socket.destroy();
  wss.handleUpgrade(req,socket,head,ws=>{ws.deviceCode=c;wss.emit('connection',ws,req)})
});

wss.on('connection',ws=>{
  const c=ws.deviceCode,old=devices.get(c);
  if(old?.ws&&old.ws!==ws)old.ws.close(4000,'Replaced by newer connector');
  devices.set(c,{ws,connectedAt:Date.now(),lastSeen:Date.now()});
  ws.send(JSON.stringify({type:'connected',code:c}));
  ws.on('message',raw=>{
    try{
      const msg=JSON.parse(raw.toString()),d=devices.get(c);
      if(d)d.lastSeen=Date.now();
      if(msg.type==='tally_result'&&msg.id){
        const p=pending.get(msg.id);if(!p)return;
        clearTimeout(p.timer);pending.delete(msg.id);
        if(msg.error)p.reject(new Error(msg.error));else p.resolve(msg.xml||'');
      }
    }catch(_){ }
  });
  ws.on('close',()=>{const d=devices.get(c);if(d?.ws===ws)devices.delete(c)})
});

setInterval(()=>{
  for(const[id,p]of pending){
    if(Date.now()-(p.startedAt||Date.now())>REQUEST_TIMEOUT+10000){clearTimeout(p.timer);p.reject(new Error('Request expired'));pending.delete(id)}
  }
},30000).unref();

server.listen(PORT,'0.0.0.0',()=>console.log(`TallySync relay listening on ${PORT}`));
