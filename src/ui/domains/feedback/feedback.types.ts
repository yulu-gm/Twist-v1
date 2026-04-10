/**
 * @file feedback.types.ts
 * @description 反馈领域的视图模型类型 — Toast 提示、通知条目、反馈视图模型
 * @dependencies 无外部依赖 — 纯类型文件
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

/** Toast 提示条目 — 屏幕角落的短暂提示 */
export interface ToastItem {
  /** 唯一标识（由事件类型+tick 组合） */
  id: string;
  /** 语义色调：error=红色、info=蓝色、success=绿色 */
  tone: 'error' | 'info' | 'success';
  /** 提示标题 */
  title: string;
  /** 提示摘要文本 */
  summary: string;
}

/** 通知条目 — 通知中心列表中的单条记录 */
export interface NotificationItem {
  /** 唯一标识 */
  id: string;
  /** 事件标题（格式化后的事件类型名） */
  title: string;
  /** 事件摘要 */
  summary: string;
  /** 事件发生的 tick */
  tick: number;
}

/**
 * 反馈视图模型 — selectCommandFeedback 选择器的输出
 */
export interface FeedbackViewModel {
  /** 当前显示的 Toast 列表（最多 3 条） */
  toasts: ToastItem[];
  /** 所有近期事件的通知列表 */
  notifications: NotificationItem[];
}
