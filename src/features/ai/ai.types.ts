/**
 * @file ai.types.ts
 * @description AI 系统的核心类型定义，包含 Toil（劳作步骤）、Job（工作任务）、
 *              JobCandidate（任务候选项）和 WorkEntry（工作条目）四大接口。
 * @dependencies core/types — 基础类型（ObjectId, DefId, CellCoord, JobId）和枚举（ToilType, ToilState, JobState）
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectId, DefId, CellCoord, JobId, ToilType, ToilState, JobState,
} from '../../core/types';

// ── Toil（劳作步骤） ──
// 一个 Job 由多个 Toil 组成，每个 Toil 代表一个原子操作（移动、拾取、工作等）
export interface Toil {
  /** 劳作类型：GoTo / PickUp / Drop / Work / Wait / Deliver / Interact */
  type: ToilType;
  /** 操作目标对象 ID（可选，如拾取的物品、工作的建筑工地） */
  targetId?: ObjectId;
  /** 操作目标格子坐标（可选，如移动的目的地、工作的地点） */
  targetCell?: CellCoord;
  /** 当前劳作的执行状态：NotStarted / InProgress / Completed / Failed */
  state: ToilState;
  /** 劳作的本地数据，存储运行时中间状态（如已完成工作量、等待计时等） */
  localData: Record<string, unknown>;
}

// ── Job（工作任务） ──
// 表示一个完整的工作任务，包含若干有序的 Toil 步骤
export interface Job {
  /** 工作唯一标识符（如 "job_mine_1"） */
  id: JobId;
  /** 工作定义 ID（如 "job_mine", "job_harvest", "job_eat"） */
  defId: DefId;
  /** 执行此工作的 Pawn 的 ID */
  pawnId: ObjectId;
  /** 工作操作的目标对象 ID（可选，如矿脉指派、建筑蓝图） */
  targetId?: ObjectId;
  /** 工作操作的目标格子坐标（可选） */
  targetCell?: CellCoord;
  /** 有序的劳作步骤列表 */
  toils: Toil[];
  /** 当前正在执行的 Toil 索引 */
  currentToilIndex: number;
  /** 此工作持有的资源预留 ID 列表（防止多个 Pawn 争抢同一目标） */
  reservations: string[];
  /** 工作整体状态：Starting / Active / Done / Failed */
  state: JobState;
  /** 若该 Job 由工作订单派生，记录订单 ID，便于完成时回写 */
  workOrderId?: string;
  /** 若该 Job 由工作订单派生，记录订单项 ID，便于完成时回写 */
  workOrderItemId?: string;
}

// 为方便使用，重新导出枚举
export { JobState, ToilState, ToilType } from '../../core/types';
