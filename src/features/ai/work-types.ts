/**
 * @file work-types.ts
 * @description 工作评估领域模型 — 定义工作选项、评估结果、失败原因和决策快照类型
 * @dependencies core/types — DefId, JobId, ToilState 基础类型
 * @part-of AI 子系统（features/ai）
 */

import type { DefId, JobId, ToilState } from '../../core/types';
import type { Job } from './ai.types';

// ── 决策状态枚举 ──

/** 工作选项在冻结快照中的决策状态 */
export type WorkDecisionStatus = 'blocked' | 'active' | 'deferred';

// ── 失败原因码 ──

/** 工作被阻塞时的稳定原因码，用于逻辑判断和 UI 展示 */
export type WorkFailureReasonCode =
  | 'none'
  | 'no_target'
  | 'target_reserved'
  | 'target_unreachable'
  | 'need_not_triggered'
  | 'no_storage_destination'
  | 'no_storage_source'
  | 'materials_not_delivered'
  | 'carrying_conflict'
  | 'no_available_bed'
  | 'no_reachable_material_source'
  | 'order_paused'
  | 'order_cancelled'
  | 'no_order_executor';

// ── 工作选项（冻结后的展示单元） ──

/**
 * 工作选项 — 冻结决策快照中的单个工作类别条目
 *
 * 每一行对应最近一次选工排序中真实参与过的一个工作类别
 */
export interface WorkOption {
  /** 工作类别标识（如 'eat'、'sleep'、'haul_to_stockpile'） */
  kind: string;
  /** 面向用户的类别显示名 */
  label: string;
  /** 决策状态：active / blocked / deferred */
  status: WorkDecisionStatus;
  /** 类别优先级（越高越先被考虑） */
  priority: number;
  /** 类别内的数值分数 */
  score: number;
  /** blocked 状态的稳定原因码 */
  failureReasonCode: WorkFailureReasonCode;
  /** blocked 状态的人类可读解释 */
  failureReasonText: string | null;
  /** 可选的简短上下文（如床位标签、材料 ID 或目标摘要） */
  detail: string | null;
  /** 如果该项被选中，将会分配的 job 类型 */
  jobDefId: DefId | null;
  /** 本次决策发生的 tick */
  evaluatedAtTick: number;
}

// ── 工作评估结果（evaluator 的输出） ──

/**
 * 工作评估结果 — evaluator 返回的统一格式数据
 *
 * 与 WorkOption 类似但不含 status（由 selector 在冻结时赋予），
 * 并包含 createJob 工厂函数用于真实分配
 */
export interface WorkEvaluation {
  /** 工作类别标识 */
  kind: string;
  /** 面向用户的类别显示名 */
  label: string;
  /** 类别优先级 */
  priority: number;
  /** 类别内的数值分数 */
  score: number;
  /** 失败原因码 */
  failureReasonCode: WorkFailureReasonCode;
  /** 失败原因文案 */
  failureReasonText: string | null;
  /** 可选的简短上下文 */
  detail: string | null;
  /** 对应的 job 定义 ID */
  jobDefId: DefId | null;
  /** 评估时的 tick */
  evaluatedAtTick: number;
  /** 创建真实 Job 的工厂函数（null 表示该类别当前不可用） */
  createJob: (() => Job | null) | null;
  /** Job 成功选中并完成预留后触发的回调，用于提交轻量副作用 */
  onAssigned?: ((job: Job) => void) | null;
}

// ── 决策快照 ──

/**
 * 棋子工作决策快照 — 一次选工过程的冻结说明
 *
 * 只在 pawn 执行新的选工过程时被替换，
 * 不在 pawn 正忙于执行所选 job 时每 tick 重新排序
 */
export interface PawnWorkDecisionSnapshot {
  /** 快照产生时的 tick */
  evaluatedAtTick: number;
  /** 被选中的工作类别 kind */
  selectedWorkKind: string | null;
  /** 被选中的工作类别显示名 */
  selectedWorkLabel: string | null;
  /** 被选中的工作实例 ID */
  selectedJobId: JobId | null;
  /** 当前活跃 toil 的标签 */
  activeToilLabel: string | null;
  /** 当前活跃 toil 的状态 */
  activeToilState: ToilState | null;
  /** 按优先级和分数排序的全部工作选项 */
  options: WorkOption[];
}
