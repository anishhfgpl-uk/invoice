import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const invoice = path.join(dist, 'invoice');

if (!fs.existsSync(dist)) throw new Error('dist directory not found');
fs.rmSync(invoice, { recursive: true, force: true });
fs.cpSync(dist, invoice, { recursive: true });

console.log('Prepared physical /invoice route:', invoice);
