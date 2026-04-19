/**
 * @file use-collapse-state.ts
 * @description 管理工单看板的折叠状态 — 自动建议 + 用户覆盖
 * @dependencies preact/hooks — useState/useRef/useCallback
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 *
 * 规则：
 * - 默认 expanded = suggestedExpanded
 * - 用户 toggle() 后 userOverride 接管
 * - suggestedExpanded 从 false 跨越到 true 时清空 userOverride
 *   （新订单一定能被看到，不会被旧的"用户已收起"卡住）
 */

import { useCallback, useRef, useState } from 'preact/hooks';

/** Hook 输出 */
export interface CollapseStateHandle {
  /** 当前是否展开 */
  expanded: boolean;
  /** 切换 — 写入用户覆盖 */
  toggle: () => void;
}

/**
 * 管理折叠状态
 *
 * @param suggestedExpanded - selector 计算出的建议状态（rows.length > 0）
 */
export function useCollapseState(suggestedExpanded: boolean): CollapseStateHandle {
  const [override, setOverride] = useState<boolean | null>(null);
  // 记录上一次 suggestedExpanded，用于侦测 false → true 跨越
  const prevSuggestedRef = useRef<boolean>(suggestedExpanded);

  // 同步阶段处理跨越 — 在 render 内直接清覆盖，避免一帧延迟
  if (!prevSuggestedRef.current && suggestedExpanded && override !== null) {
    setOverride(null);
  }
  prevSuggestedRef.current = suggestedExpanded;

  const expanded = override ?? suggestedExpanded;

  const toggle = useCallback(() => {
    setOverride(prev => {
      const baseline = prev ?? suggestedExpanded;
      return !baseline;
    });
  }, [suggestedExpanded]);

  return { expanded, toggle };
}
