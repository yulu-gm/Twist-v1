/**
 * @file vitest.scenario.config.ts
 * @description Scenario 测试专用 Vitest 配置 — 使用 node 环境（无 DOM），
 *              支持 @bootstrap、@testing 等别名
 */

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bootstrap': path.resolve(__dirname, 'src/bootstrap'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@defs': path.resolve(__dirname, 'src/defs'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@testing': path.resolve(__dirname, 'src/testing'),
      '@world': path.resolve(__dirname, 'src/world'),
      '@adapter': path.resolve(__dirname, 'src/adapter'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  test: {
    include: ['src/testing/**/*.test.ts', 'src/testing/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [
      ['src/testing/visual-runner/**/*.test.tsx', 'jsdom'],
      ['src/testing/visual-runner/**/*.test.ts', 'jsdom'],
    ],
  },
});
