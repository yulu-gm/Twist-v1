/**
 * @file stat-row.tsx
 * @description 属性行组件 — 标签-值 对齐的单行信息展示
 * @dependencies 无外部依赖
 * @part-of ui/components — 共享 UI 组件库
 */

/** StatRow 组件属性 */
interface StatRowProps {
  /** 属性标签（如 "Position"、"HP"） */
  label: string;
  /** 属性值文本 */
  value: string;
}

/** 属性行 — 左标签右数值的单行展示，用于检查器详情 */
export function StatRow({ label, value }: StatRowProps) {
  return (
    <div class="stat-row">
      <span class="stat-row__label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
