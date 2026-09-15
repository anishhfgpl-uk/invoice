import http from 'node:http';

const TALLY_URL = process.env.TALLY_URL || 'http://127.0.0.1:9000';
const PORT = Number(process.env.CONNECTOR_PORT || 9101);
const HOST = process.env.CONNECTOR_HOST || '0.0.0.0';
const RELAY_URL = (process.env.RELAY_URL || '').replace(/\/$/, '');
const DEVICE_CODE = (process.env.DEVICE_CODE || '').trim().toUpperCase();

const ALLOWED_ORIGINS = new Set([
  'https://anish-tech.online',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function send(res, status, body, origin, type = 'application/json') {
  const headers = { 'Content-Type': type, ...corsHeaders(origin) };
  res.writeHead(status, headers);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function tallyPost(xml) {
  const response = await fetch(TALLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xml,
    signal: AbortSignal.timeout(45000)
  });
  return await response.text();
}

let relaySocket = null;
let relayCode = DEVICE_CODE;
const relayWaiters = new Map();

function connectRelay() {
  if (!RELAY_URL) return;
  if (!relayCode) {
    console.log('RELAY_URL is set but DEVICE_CODE is empty. Set DEVICE_CODE in the launcher.');
    return;
  }
  try {
    const wsUrl = RELAY_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + `/agent?code=${encodeURIComponent(relayCode)}`;
    const WS = globalThis.WebSocket;
    if (!WS) throw new Error('This Node.js version does not provide WebSocket support');
    const ws = new WS(wsUrl);
    relaySocket = ws;
    ws.addEventListener('open', () => console.log(`Remote relay connected. Office code: ${relayCode}`));
    ws.addEventListener('message', async event => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type !== 'tally_xml' || !msg.id) return;
        try {
          const xml = await tallyPost(msg.xml || '');
          ws.send(JSON.stringify({ type: 'tally_result', id: msg.id, xml }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'tally_result', id: msg.id, error: String(e?.message || e) }));
        }
      } catch (_) {}
    });
    ws.addEventListener('close', () => {
      relaySocket = null;
      setTimeout(connectRelay, 5000);
    });
    ws.addEventListener('error', () => {});
  } catch (e) {
    console.log(`Relay connection error: ${e.message}`);
    setTimeout(connectRelay, 5000);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return send(res, 403, JSON.stringify({ ok: false, error: 'Origin not allowed' }), origin);
    }
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === '/health' && req.method === 'GET') {
      let tally = false;
      try {
        const r = await fetch(TALLY_URL, { signal: AbortSignal.timeout(3000) });
        tally = r.ok;
      } catch {}
      return send(res, 200, JSON.stringify({
        ok: true,
        service: 'tally-connector',
        tallyUrl: TALLY_URL,
        tally,
        remoteRelay: !!RELAY_URL,
        officeCode: relayCode || null,
        relayConnected: !!relaySocket
      }), origin);
    }

    if ((url.pathname === '/tally/xml' || url.pathname === '/tally') && req.method === 'POST') {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return send(res, 403, JSON.stringify({ ok: false, error: 'Origin not allowed' }), origin);
      }
      const xml = await readBody(req);
      if (!xml.trim()) {
        return send(res, 400, JSON.stringify({ ok: false, error: 'XML body required' }), origin);
      }
      const result = await tallyPost(xml);
      return send(res, 200, result, origin, 'text/xml; charset=utf-8');
    }

    if (url.pathname === '/tally' && req.method === 'GET') {
      return send(res, 405, JSON.stringify({ ok: false, error: 'Use POST for Tally XML' }), origin);
    }

    return send(res, 404, JSON.stringify({ ok: false, error: 'Not found' }), origin);
  } catch (error) {
    return send(res, 502, JSON.stringify({ ok: false, error: String(error?.message || error) }), origin);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Tally connector running on http://${HOST}:${PORT}`);
  console.log(`Tally target: ${TALLY_URL}`);
  if (RELAY_URL) {
    console.log(`Remote relay: ${RELAY_URL}`);
    console.log(`Office code: ${relayCode || '(not configured)'}`);
    connectRelay();
  }
});
