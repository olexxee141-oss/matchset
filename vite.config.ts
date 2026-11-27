import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
  // Vercel serves public/ through its CDN; original assets live in static/.
  publicDir: 'static',
  build: { outDir: 'public', emptyOutDir: true },
});
