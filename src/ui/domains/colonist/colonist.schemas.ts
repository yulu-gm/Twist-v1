/**
 * @file colonist.schemas.ts
 * @description 殖民者领域的静态配置 — 需求定义、徽章色调映射
 * @dependencies 无外部依赖
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

// ── 需求定义 ──

/** 需求条的配置（标识、标签、颜色），与 ColonistNode.needs 的键一一对应 */
export const needDefs = [
  { key: 'food', label: '饱食', color: '#cc8844' },
  { key: 'joy',  label: '愉悦',  color: '#44cc88' },
  { key: 'mood', label: '心情', color: '#cc44cc' },
] as const;

/**
 * 根据任务 ID 返回徽章色调
 *
 * @param job - 任务定义 ID 或格式化标签
 * @returns 'idle' 表示空闲（灰色），'working' 表示工作中（蓝色）
 */
export function getJobBadgeTone(job: string): 'idle' | 'working' | 'alert' {
  if (job === 'idle' || job === '空闲') return 'idle';
  return 'working';
}
