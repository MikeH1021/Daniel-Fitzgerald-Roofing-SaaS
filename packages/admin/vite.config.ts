import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@widget': path.resolve(__dirname, '../widget/src'),
    },
    dedupe: ['preact'],
  },
  base: '/admin/',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
