import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@world': path.resolve(__dirname, 'src/world'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@adapter': path.resolve(__dirname, 'src/adapter'),
      '@defs': path.resolve(__dirname, 'src/defs'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/ui/test/setup.ts'],
  },
});
