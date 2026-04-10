/**
 * @file badge.tsx
 * @description 徽章组件 — 紧凑的状态标签，支持语义色调
 * @dependencies 无外部依赖
 * @part-of ui/components — 共享 UI 组件库
 */

/** Badge 组件属性 */
interface BadgeProps {
  /** 徽章文本 */
  label: string;
  /** 语义色调：idle=灰色、working=蓝色、alert=红色 */
  tone?: 'idle' | 'working' | 'alert';
}

/** 状态徽章 — 用于殖民者列表中显示当前任务状态 */
export function Badge({ label, tone = 'idle' }: BadgeProps) {
  return <span class={`badge badge--${tone}`}>{label}</span>;
}
