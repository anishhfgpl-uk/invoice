import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TALLY_URL = process.env.TALLY_URL || 'http://127.0.0.1:9000';
const PORT = Number(process.env.CONNECTOR_PORT || 9101);
const HOST = process.env.CONNECTOR_HOST || '0.0.0.0';
const RELAY_URL = (process.env.RELAY_URL || 'https://tally-relay-anil-sharma.onrender.com').replace(/\/$/, '');
const CODE_FILE = process.env.OFFICE_CODE_FILE || '.office-code';

function makeCode() {
  return `ANISH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function loadCode() {
  const env = (process.env.OFFICE_CODE || '').trim().toUpperCase();
  if (env) return env;
  try {
    const x = fs.readFileSync(CODE_FILE, 'utf8').trim().toUpperCase();
    if (/^[A-Z0-9_-]{6,40}$/.test(x)) return x;
  } catch {}
  const c = makeCode();
  try {
    fs.writeFileSync(CODE_FILE, c + '\n', 'utf8');
  } catch {}
  return c;
}

const OFFICE_CODE = loadCode();
let relayConnected = false;
let relaySocket = null;
let reconnectTimer = null;
let tallyQueue = Promise.resolve();

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

function send(res, status, body, origin, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, ...cors(origin) });
  res.end(body);
}

async function read(req) {
  const a = [];
  for await (const c of req) a.push(c);
  return Buffer.concat(a).toString('utf8');
}

// Node http on Windows - sends XML directly to Tally on port 9000
function tally(xml) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(TALLY_URL);
    } catch (e) {
      return reject(new Error(`Invalid Tally URL: ${TALLY_URL}`));
    }
    const body = Buffer.from(String(xml || ''), 'utf8');
    const req = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 80,
        path: target.pathname + (target.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': body.length,
          Connection: 'close',
        },
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const out = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`Tally HTTP ${res.statusCode}: ${out.slice(0, 500)}`));
          }
          resolve(out);
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Tally connection timeout after 60 seconds')));
    req.on('error', (e) =>
      reject(
        new Error(
          `Tally se connect nahi ho paya (${e.message}). Check karein ki TallyPrime chal raha hai aur port 9000 khula hai.`
        )
      )
    );
    req.write(body);
    req.end();
  });
}

function relayWsUrl() {
  return (
    RELAY_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') +
    `/agent?code=${encodeURIComponent(OFFICE_CODE)}`
  );
}

function connectRelay() {
  if (relaySocket && (relaySocket.readyState === 0 || relaySocket.readyState === 1)) return;
  clearTimeout(reconnectTimer);
  try {
    const url = relayWsUrl();
    console.log(`Connecting to Relay WebSocket: ${url}`);
    const ws = new WebSocket(url);
    relaySocket = ws;

    ws.addEventListener('open', () => {
      relayConnected = true;
      console.log(`[SUCCESS] Relay Connected! Office PC is ready for remote Tally queries.`);
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(
          typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8')
        );
        if (msg.type !== 'tally_xml' || !msg.id) return;
        tallyQueue = tallyQueue
          .then(async () => {
            let result;
            try {
              result = await tally(String(msg.xml || ''));
            } catch (e) {
              result = `<ENVELOPE><BODY><LINEERROR>${String(e.message).replace(/[<&>]/g, '')}</LINEERROR></BODY></ENVELOPE>`;
            }
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'tally_result', id: msg.id, xml: result }));
            }
          })
          .catch((e) => console.log('Tally queue error:', e.message));
      } catch (e) {
        console.log('Relay message error:', e.message);
      }
    });

    ws.addEventListener('close', (event) => {
      if (relaySocket === ws) relaySocket = null;
      relayConnected = false;
      console.log(`Relay disconnected (code=${event.code || 0}). Reconnecting in 3s...`);
      reconnectTimer = setTimeout(connectRelay, 3000);
    });

    ws.addEventListener('error', (event) => {
      relayConnected = false;
      console.log('Relay connection error. Retrying in 3s...');
    });
  } catch (e) {
    relayConnected = false;
    console.log('Relay exception:', e.message);
    reconnectTimer = setTimeout(connectRelay, 3000);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(origin));
    return res.end();
  }
  const u = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (u.pathname === '/health' && req.method === 'GET') {
      let ok = false;
      try {
        await tally(
          '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Company Collection</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>'
        );
        ok = true;
      } catch (e) {
        console.log('Health Tally check:', e.message);
      }
      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          service: 'tally-connector',
          version: 'v4',
          tallyUrl: TALLY_URL,
          tally: ok,
          relay: relayConnected,
          relayUrl: RELAY_URL,
          officeCode: OFFICE_CODE,
        }),
        origin
      );
    }

    if (u.pathname === '/code' && req.method === 'GET') {
      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          officeCode: OFFICE_CODE,
          version: 'v4',
          relay: relayConnected,
          relayUrl: RELAY_URL,
        }),
        origin
      );
    }

    if ((u.pathname === '/tally/xml' || u.pathname === '/tally') && req.method === 'POST') {
      const xml = await read(req);
      if (!xml.trim()) {
        return send(res, 400, JSON.stringify({ ok: false, error: 'XML body required' }), origin);
      }
      return send(res, 200, await tally(xml), origin, 'text/xml; charset=utf-8');
    }

    return send(res, 404, JSON.stringify({ ok: false, error: 'Not found' }), origin);
  } catch (e) {
    return send(
      res,
      502,
      JSON.stringify({
        ok: false,
        error: String(e.message || e),
        version: 'v4',
        tallyUrl: TALLY_URL,
      }),
      origin
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log('================================================');
  console.log('       ANISH TECHNOLOGIES - TALLY CONNECTOR     ');
  console.log('================================================');
  console.log(`Office Code:   ${OFFICE_CODE}`);
  console.log(`Tally Target:  ${TALLY_URL}`);
  console.log(`Secure Relay:  ${RELAY_URL}`);
  console.log(`Local Server:  http://${HOST}:${PORT}`);
  console.log('------------------------------------------------');
  console.log('--> TallyPrime khula rakhein (Port 9000).');
  console.log(`--> Website me Tally Connect click karein aur Code dalein: ${OFFICE_CODE}`);
  console.log('================================================');
  connectRelay();
});
