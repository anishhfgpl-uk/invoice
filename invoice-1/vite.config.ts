import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const tallyParserFormatPlugin: Plugin = {
  name: 'tally-parser-format-inr',
  enforce: 'post',
  transform(code, id) {
    if (id.endsWith('/src/utils/tallyParser.ts') && !code.includes('export function formatINR')) {
      return `${code}\n\nexport function formatINR(value: number): string {\n  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);\n}\n`;
    }
    return null;
  },
};

export default defineConfig(() => {
  return {
    base: '/invoice/',
    plugins: [react(), tailwindcss(), tallyParserFormatPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
