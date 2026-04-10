/**
 * @file feedback.schemas.ts
 * @description 反馈领域的静态配置 — 事件严重度映射和事件标题格式化
 * @dependencies 无外部依赖
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

// ── 事件严重度映射 ──

/** 事件类型到严重度的映射表 — 决定 Toast 的颜色和通知的图标 */
export const eventSeverityMap: Record<string, 'error' | 'info' | 'success'> = {
  command_rejected: 'error',
  speed_changed: 'info',
  debug_spawned: 'info',
  debug_destroyed: 'info',
  designation_completed: 'success',
  construction_complete: 'success',
};

/**
 * 获取事件的严重度等级
 *
 * @param type - 事件类型字符串
 * @returns 严重度等级，未知类型默认为 'info'
 */
export function getEventSeverity(type: string): 'error' | 'info' | 'success' {
  return eventSeverityMap[type] ?? 'info';
}

/**
 * 格式化事件类型为可读标题
 *
 * @param type - 事件类型字符串（如 'command_rejected'）
 * @returns 格式化后的标题（如 'Command Rejected'）
 *
 * 将下划线替换为空格，并将每个单词首字母大写
 */
export function formatEventTitle(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
