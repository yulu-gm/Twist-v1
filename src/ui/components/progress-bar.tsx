/**
 * @file progress-bar.tsx
 * @description 进度条组件 — 带标签和数值的水平进度指示器
 * @dependencies 无外部依赖
 * @part-of ui/components — 共享 UI 组件库
 */

/** ProgressBar 组件属性 */
interface ProgressBarProps {
  /** 进度条标签（可选，如 "Food"、"Rest"） */
  label?: string;
  /** 当前值（0-100），超出范围会被钳位 */
  value: number;
  /** 填充颜色（CSS 颜色值） */
  color?: string;
}

/**
 * 水平进度条 — 用于展示殖民者需求等 0-100 范围的数值
 *
 * 自动将 value 钳位到 [0, 100] 范围，防止溢出
 */
export function ProgressBar({ label, value, color }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div class="progress-bar">
      {label && <span class="progress-bar__label">{label}</span>}
      <div class="progress-bar__track">
        <div
          class="progress-bar__fill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span class="progress-bar__value">{Math.floor(clamped)}</span>
    </div>
  );
}
