import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const source = path.resolve(root, '../tally-connector/live-tally.js');
const target = path.join(dist, 'tally-connector.js');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(indexPath)) throw new Error(`Build output not found: ${indexPath}`);
if (!fs.existsSync(source)) throw new Error(`Connector source not found: ${source}`);

fs.copyFileSync(source, target);
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/\s*<script[^>]+tally-connector\.js[^>]*><\/script>/gi, '');
const tag = '<script src="/invoice/tally-connector.js?v=live"></script>';
if (!html.includes('/invoice/tally-connector.js')) html = html.replace('</body>', `  ${tag}\n</body>`);
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Published live Tally connector:', target);
