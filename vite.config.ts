import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
  // Keep the Vite output aligned with Vercel's configured output directory.
  // Original PWA assets live in static/ and are copied into dist/.
  publicDir: 'static',
  build: { outDir: 'dist', emptyOutDir: true },
});
