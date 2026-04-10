/**
 * @file tool-mode-bar.test.tsx
 * @description 宸ュ叿鏍忕粍浠舵祴璇?鈥?楠岃瘉鎸夐挳娓叉煋銆侀珮浜姸鎬併€佺偣鍑诲洖璋冨拰鍖哄煙涓嬫媺鑿滃崟
 * @part-of ui/domains/build 鈥?寤洪€?UI 棰嗗煙
 */

import { fireEvent, render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ToolModeBar } from './tool-mode-bar';

afterEach(cleanup);

describe('ToolModeBar', () => {
  it('renders the primary toolbar buttons', () => {
    render(<ToolModeBar activeToolId="select" activeTool="select" onActivate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Harvest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cut' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '区域' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('highlights the active tool', () => {
    render(<ToolModeBar activeToolId="mine" activeTool="designate" onActivate={vi.fn()} />);
    const mineBtn = screen.getByRole('button', { name: 'Mine' });
    expect(mineBtn.className).toContain('is-active');
  });

  it('opens the build menu with structure and furniture categories', () => {
    render(<ToolModeBar activeToolId="select" activeTool="select" onActivate={vi.fn()} />);
    const buildBtn = screen.getByRole('button', { name: 'Build' });
    fireEvent.click(buildBtn);

    expect(buildBtn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Structure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Furniture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wall' })).toBeInTheDocument();
  });

  it('calls onActivate when a build submenu item is clicked', () => {
    const onActivate = vi.fn();
    render(<ToolModeBar activeToolId="select" activeTool="select" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    fireEvent.click(screen.getByRole('button', { name: 'Furniture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bed' }));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0][0].id).toBe('build_bed');
  });

  it('toggles zone menu on zone button click', () => {
    render(<ToolModeBar activeToolId="select" activeTool="select" onActivate={vi.fn()} />);
    const zoneBtn = screen.getByRole('button', { name: '区域' });
    fireEvent.click(zoneBtn);
    expect(zoneBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onActivate with zone sub-item and closes menu', () => {
    const onActivate = vi.fn();
    render(<ToolModeBar activeToolId="select" activeTool="select" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: '区域' }));
    fireEvent.click(screen.getByRole('button', { name: '种植区' }));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0][0].zoneType).toBe('growing');
  });
});
