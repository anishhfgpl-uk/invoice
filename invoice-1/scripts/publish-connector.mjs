import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const source = path.resolve(root, '../tally-connector/live-tally.js');
const target = path.join(dist, 'tally-connector.js');
console.log('Published live Tally connector:', target);
