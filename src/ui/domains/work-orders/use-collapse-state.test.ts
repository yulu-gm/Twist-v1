/**
 * @file use-collapse-state.test.ts
 * @description useCollapseState hook 测试 — 验证用户覆盖与"rows 0→1 自动展开"逻辑
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { renderHook, act } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { useCollapseState } from './use-collapse-state';

describe('useCollapseState', () => {
  it('follows suggestedExpanded when no user override', () => {
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: boolean }) => useCollapseState(suggested),
      { initialProps: { suggested: false } },
    );
    expect(result.current.expanded).toBe(false);
    rerender({ suggested: true });
    expect(result.current.expanded).toBe(true);
  });

  it('user toggle overrides suggested while suggested stays true', () => {
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: boolean }) => useCollapseState(suggested),
      { initialProps: { suggested: true } },
    );
    expect(result.current.expanded).toBe(true);
    act(() => { result.current.toggle(); });
    expect(result.current.expanded).toBe(false);
    rerender({ suggested: true });
    expect(result.current.expanded).toBe(false);
  });

  it('clears user override when suggested crosses false → true', () => {
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: boolean }) => useCollapseState(suggested),
      { initialProps: { suggested: true } },
    );
    act(() => { result.current.toggle(); });
    expect(result.current.expanded).toBe(false);

    rerender({ suggested: false });
    expect(result.current.expanded).toBe(false);

    rerender({ suggested: true });
    expect(result.current.expanded).toBe(true);
  });
});
