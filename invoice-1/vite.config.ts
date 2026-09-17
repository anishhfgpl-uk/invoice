import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  // The app is published under https://anish-tech.online/invoice/
  base: '/invoice/',
  build: {
    // Cloudflare serves the /invoice/* route, so keep the built app
    // physically nested under dist/invoice as required for subdirectory assets.
    outDir: 'dist/invoice',
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
