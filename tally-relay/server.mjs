import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 10000);
const MAX_BODY = 2 * 1024 * 1024;
const devices = new Map(); // code -> { ws, connectedAt, lastSeen }
const pending = new Map();

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

function code() {
  return crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 12).toUpperCase();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > MAX_BODY) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function newId() { return crypto.randomUUID(); }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === '/health') return json(res, 200, { ok: true, service: 'tallysync-relay', devices: devices.size });
  if (u.pathname === '/api/device/register' && req.method === 'POST') {
    const c = code();
    return json(res, 200, { ok: true, code: c, websocket: `/agent?code=${c}` });
  }

  const m = u.pathname.match(/^\/api\/device\/([A-Z0-9]+)\/status$/);
  if (m && req.method === 'GET') {
    const d = devices.get(m[1]);
    return json(res, 200, { ok: true, connected: !!d, lastSeen: d?.lastSeen || null });
  }

  const x = u.pathname.match(/^\/api\/device\/([A-Z0-9]+)\/xml$/);
  if (x && req.method === 'POST') {
    const deviceCode = x[1];
    const d = devices.get(deviceCode);
    if (!d || d.ws.readyState !== 1) return json(res, 409, { ok: false, error: 'Office Tally connector is offline' });
    try {
      const xml = await readBody(req);
      const id = newId();
      const p = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Tally request timed out after 45 seconds')); }, 45000);
        pending.set(id, { resolve, reject, timer });
      });
      d.lastSeen = Date.now();
      d.ws.send(JSON.stringify({ type: 'tally_xml', id, xml }));
      const result = await p;
      res.writeHead(200, {
        'Content-Type': 'text/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(result);
    } catch (e) {
      return json(res, 502, { ok: false, error: e.message });
    }
  }

  json(res, 404, { ok: false, error: 'Not found' });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname !== '/agent') return socket.destroy();
  const c = (u.searchParams.get('code') || '').toUpperCase();
  if (!/^[A-Z0-9]{8,32}$/.test(c)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => {
    ws.deviceCode = c;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', ws => {
  const c = ws.deviceCode;
  const old = devices.get(c);
  if (old?.ws && old.ws !== ws) old.ws.close(4000, 'Replaced by newer connector');
  devices.set(c, { ws, connectedAt: Date.now(), lastSeen: Date.now() });
  ws.send(JSON.stringify({ type: 'connected', code: c }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());
      const d = devices.get(c);
      if (d) d.lastSeen = Date.now();
      if (msg.type === 'tally_result' && msg.id) {
        const p = pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer); pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.xml || '');
      }
    } catch (_) {}
  });
  ws.on('close', () => {
    const d = devices.get(c);
    if (d?.ws === ws) devices.delete(c);
  });
});

setInterval(() => {
  for (const [id, p] of pending) {
    if (Date.now() - (p.startedAt || Date.now()) > 60000) {
      clearTimeout(p.timer); p.reject(new Error('Request expired')); pending.delete(id);
    }
  }
}, 30000).unref();

server.listen(PORT, '0.0.0.0', () => console.log(`TallySync relay listening on ${PORT}`));
