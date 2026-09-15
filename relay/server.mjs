import http from 'node:http';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||10000);
const pending=new Map();
const devices=new Map();
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
function send(res,status,body,type='application/json'){res.writeHead(status,{'Content-Type':type,...CORS});res.end(body)}
async function body(req){const a=[];for await(const c of req)a.push(c);return Buffer.concat(a).toString('utf8')}
function json(res,status,obj){send(res,status,JSON.stringify(obj))}
function safeCode(c){return /^[A-Z0-9_-]{6,40}$/i.test(c)}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS')return send(res,204,'');
  const u=new URL(req.url,`http://${req.headers.host}`);
  try{
    if(u.pathname==='/health')return json(res,200,{ok:true,service:'tally-relay',devices:devices.size,pending:pending.size});
    const m=u.pathname.match(/^\/api\/device\/([^/]+)\/(register|poll|response)$/);
    if(m){
      const code=decodeURIComponent(m[1]); if(!safeCode(code))return json(res,400,{ok:false,error:'Invalid office code'});
      const action=m[2];
      if(action==='register'&&req.method==='POST'){devices.set(code,{lastSeen:Date.now()});return json(res,200,{ok:true,registered:true})}
      if(action==='poll'&&req.method==='GET'){devices.set(code,{lastSeen:Date.now()});const item=[...pending.values()].find(x=>x.code===code&&!x.claimed);if(!item)return json(res,200,{ok:true,request:null});item.claimed=true;return json(res,200,{ok:true,request:{id:item.id,xml:item.xml}})}
      if(action==='response'&&req.method==='POST'){const data=JSON.parse(await body(req));const item=pending.get(data.id);if(!item)return json(res,404,{ok:false,error:'Request not found'});clearTimeout(item.timer);pending.delete(data.id);item.resolve(String(data.xml||''));return json(res,200,{ok:true})}
    }
    const x=u.pathname.match(/^\/api\/device\/([^/]+)\/xml$/);
    if(x&&req.method==='POST'){
      const code=decodeURIComponent(x[1]);if(!safeCode(code))return json(res,400,{ok:false,error:'Invalid office code'});
      const d=devices.get(code);if(!d||Date.now()-d.lastSeen>15000)return json(res,409,{ok:false,error:'Office connector is offline'});
      const xml=await body(req);if(!xml.trim())return json(res,400,{ok:false,error:'XML required'});
      const id=crypto.randomUUID();
      const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Office connector timeout'))},35000);pending.set(id,{id,code,xml,claimed:false,resolve,reject,timer})}).catch(e=>null);
      if(result===null)return json(res,504,{ok:false,error:'Office connector timeout'});
      return send(res,200,result,'text/xml; charset=utf-8');
    }
    return json(res,404,{ok:false,error:'Not found'});
  }catch(e){return json(res,500,{ok:false,error:String(e?.message||e)})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Tally relay listening on ${PORT}`));
