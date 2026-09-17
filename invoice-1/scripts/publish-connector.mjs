import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const source = path.resolve(root, '../tally-connector/live-tally.js');
const target = path.join(dist, 'tally-connector.js');

if (!fs.existsSync(dist)) throw new Error(`Build output not found: ${dist}`);
if (!fs.existsSync(source)) throw new Error(`Connector source not found: ${source}`);

fs.copyFileSync(source, target);
console.log('Published live Tally connector:', target);
