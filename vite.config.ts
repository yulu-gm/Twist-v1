import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@world': path.resolve(__dirname, 'src/world'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@adapter': path.resolve(__dirname, 'src/adapter'),
      '@defs': path.resolve(__dirname, 'src/defs'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'ES2020',
  },
});
