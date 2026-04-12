import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import path from 'path';

const rawDevPort = Number.parseInt(process.env.VITE_PORT ?? '5173', 10);
const devPort = Number.isInteger(rawDevPort) && rawDevPort > 0 && rawDevPort <= 65535
  ? rawDevPort
  : 5173;

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
      '@bootstrap': path.resolve(__dirname, 'src/bootstrap'),
      '@testing': path.resolve(__dirname, 'src/testing'),
    },
  },
  server: {
    port: devPort,
    open: true,
  },
  build: {
    target: 'ES2020',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        scenario: path.resolve(__dirname, 'scenario.html'),
        'scenario-select': path.resolve(__dirname, 'scenario-select.html'),
      },
    },
  },
});
