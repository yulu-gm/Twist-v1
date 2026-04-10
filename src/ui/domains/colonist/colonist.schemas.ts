/**
 * @file colonist.schemas.ts
 * @description 殖民者领域的静态配置 — 列表列定义、需求定义、标签页定义、徽章色调映射
 * @dependencies 无外部依赖
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

// ── 列表列定义 ──

/** 殖民者列表的列配置 */
export const rosterColumns = [
  { key: 'name', label: 'Name' },
  { key: 'job', label: 'Job' },
  { key: 'mood', label: 'Mood' },
] as const;

// ── 需求定义 ──

/** 需求条的配置（标识、标签、颜色），与 ColonistNode.needs 的键一一对应 */
export const needDefs = [
  { key: 'food', label: 'Food', color: '#cc8844' },
  { key: 'rest', label: 'Rest', color: '#4488cc' },
  { key: 'joy',  label: 'Joy',  color: '#44cc88' },
  { key: 'mood', label: 'Mood', color: '#cc44cc' },
] as const;

// ── 检查器标签页 ──

/** 检查器面板的标签页列表 */
export const inspectorTabs = ['Overview', 'Needs', 'Job'] as const;

/**
 * 根据任务 ID 返回徽章色调
 *
 * @param job - 任务定义 ID 或格式化标签
 * @returns 'idle' 表示空闲（灰色），'working' 表示工作中（蓝色）
 */
export function getJobBadgeTone(job: string): 'idle' | 'working' | 'alert' {
  if (job === 'idle' || job === 'Idle') return 'idle';
  return 'working';
}
