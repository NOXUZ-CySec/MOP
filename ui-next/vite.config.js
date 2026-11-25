import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
const appVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  define: { __MOP_APP_VERSION__: JSON.stringify(appVersion) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5175 }
});
