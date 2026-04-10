/**
 * @file app-shell.test.tsx
 * @description AppShell 组件测试 — 验证空壳占位模式的渲染
 * @part-of ui/app — 应用层
 */

import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders the migrated ui root container', () => {
    render(<AppShell />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Opus UI')).toBeInTheDocument();
  });
});
