/**
 * @file feedback.schemas.ts
 * @description 反馈领域的静态配置 — 事件标题格式化
 * @dependencies 无外部依赖
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

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
