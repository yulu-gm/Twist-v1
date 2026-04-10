/**
 * @file debug-panel.tsx
 * @description 调试面板组件 — 显示预格式化的调试信息文本
 * @dependencies 无外部依赖
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

/** DebugPanel 组件属性 */
interface DebugPanelProps {
  /** 是否可见（false 时不渲染） */
  visible: boolean;
  /** 预格式化的调试信息字符串（由 buildDebugInfo 生成） */
  debugInfo: string;
}

/**
 * 调试面板 — 右上角的调试信息覆盖层
 *
 * 通过 F1 快捷键切换可见性。
 * 使用 <pre> 保持格式化文本的换行和对齐。
 */
export function DebugPanel({ visible, debugInfo }: DebugPanelProps) {
  if (!visible) return null;

  return (
    <div class="debug-panel">
      <pre class="debug-panel__text">{debugInfo}</pre>
    </div>
  );
}
