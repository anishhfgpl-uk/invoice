import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const invoice = path.join(dist, 'invoice');

if (!fs.existsSync(dist)) throw new Error('dist directory not found');

// Copy the built files into /invoice without copying dist into itself.
fs.rmSync(invoice, { recursive: true, force: true });
fs.mkdirSync(invoice, { recursive: true });

for (const entry of fs.readdirSync(dist)) {
  if (entry === 'invoice') continue;
  fs.cpSync(path.join(dist, entry), path.join(invoice, entry), { recursive: true });
}

console.log('Prepared physical /invoice route:', invoice);
