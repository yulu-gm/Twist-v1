import type { GridCoord } from "../map/world-grid";

export type WorkItemKind = "deconstruct-obstacle" | "construct-blueprint";
export type WorkItemStatus = "open" | "claimed" | "completed";

export type WorkItemSnapshot = Readonly<{
  id: string;
  kind: WorkItemKind;
  anchorCell: GridCoord;
  targetEntityId?: string;
  status: WorkItemStatus;
  claimedBy?: string;
  failureCount: number;
}>;

/** 任务树工作单类型（伐木、拾取、搬运、建造）；与遗留 {@link WorkItemSnapshot} 并存。 */
export type WorkOrderKind = "chop" | "pick-up" | "haul" | "construct";

/** 与 {@link getByStatus} 查询维度一致。 */
export type WorkOrderStatus = "open" | "claimed" | "completed" | "failed";

/**
 * 可被声明式扩展的步骤；前置条件与结果用短字符串描述语义，便于生成器与后续编排器共享约定。
 */
export type WorkStep = Readonly<{
  stepType: string;
  precondition: string;
  successResult: string;
  failureResult: string;
}>;

export type WorkOrder = Readonly<{
  workId: string;
  kind: WorkOrderKind;
  status: WorkOrderStatus;
  targetEntityId: string;
  targetCell: GridCoord;
  priority: number;
  sourceReason: string;
  steps: readonly WorkStep[];
  /** 当 status 为 `claimed` 时由调度器写入认领者；`open` 时应为 `undefined`。 */
  claimedByPawnId?: string;
  /** `haul` 结算放下物资时使用；由 {@link generateHaulWork} 写入。 */
  haulDropCell?: GridCoord;
  /** {@link settleWorkFailure} 最近一次记录的失败原因（不覆盖 `sourceReason`）。 */
  lastFailureReason?: string;
}>;
