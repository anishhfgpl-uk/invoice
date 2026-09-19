import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const invoice = path.join(dist, 'invoice');
const connectorSource = path.resolve('../tally-connector/live-tally.js');

if (!fs.existsSync(dist)) throw new Error('dist directory not found');

// Copy the built files into /invoice without copying dist into itself.
fs.rmSync(invoice, { recursive: true, force: true });
fs.mkdirSync(invoice, { recursive: true });

for (const entry of fs.readdirSync(dist)) {
  if (entry === 'invoice') continue;
  fs.cpSync(path.join(dist, entry), path.join(invoice, entry), { recursive: true });
}

// Publish the live connector at both root and /invoice paths so static-host
// route rewriting cannot break the connector script lookup.
if (!fs.existsSync(connectorSource)) {
  throw new Error('Tally connector source not found: ' + connectorSource);
}
fs.copyFileSync(connectorSource, path.join(dist, 'tally-connector.js'));
fs.copyFileSync(connectorSource, path.join(invoice, 'tally-connector.js'));

console.log('Prepared physical /invoice route and published Tally connector:', invoice);
