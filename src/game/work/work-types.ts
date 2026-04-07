import type { GridCoord } from "../map/world-grid";

/**
 * 双轨工作模型与弃用路线（AP-0189）
 *
 * - **首选对外模型**：{@link WorkOrder} 与 {@link WorkStep}（任务树/调度新轨）。
 * - **遗留轨**：{@link WorkItemSnapshot} 为执行侧快照；完整迁移后应仅留在适配层内部，模块对外以 {@link WorkOrder} 为准。
 * - **字段语义对齐**（避免混用两套命名）：
 *   | `WorkItemSnapshot` | `WorkOrder` |
 *   |--------------------|-------------|
 *   | `id`               | `workId`    |
 *   | `anchorCell`       | `targetCell` |
 *   | `claimedBy`        | `claimedByPawnId` |
 */
/** 遗留轨工单种类；其中 `deconstruct-obstacle`、`mine-stone` 的策划与队列约定见 `oh-gen-doc/工作系统.yaml`「工作类型」，架构覆盖见 `oh-code-design/工作系统.yaml`「需求覆盖」。 */
export type WorkItemKind =
  | "deconstruct-obstacle"
  | "construct-blueprint"
  | "chop-tree"
  | "mine-stone"
  | "pick-up-resource"
  | "haul-to-zone";

/**
 * 遗留 `WorkItemSnapshot` 的生命周期状态（与 {@link WorkOrderStatus} 分列）。
 *
 * 策划中的「失败」在任务树侧由 {@link WorkOrderStatus} 的 `failed` 表达；本轨不引入终态 `failed`：
 * 执行失败时由 `failWorkItem`、搬运重开等路径将 `status` 置回 `open` 并递增 `failureCount`，供重试或上层策略判断。
 * 成功完成的唯一终态为 `completed`。
 */
export type WorkItemStatus = "open" | "claimed" | "completed";

/** 遗留执行队列快照；弃用路线与字段对照见文件顶部 AP-0189。新域逻辑优先 {@link WorkOrder}。 */
export type WorkItemSnapshot = Readonly<{
  id: string;
  kind: WorkItemKind;
  anchorCell: GridCoord;
  targetEntityId?: string;
  status: WorkItemStatus;
  claimedBy?: string;
  /** 与 `status === "open"` 组合表示「曾失败待重试」；见 {@link WorkItemStatus}。 */
  failureCount: number;
  /** 与策划「工作单」优先级对齐；与 {@link WorkOrder.priority} 同语义。 */
  priority: number;
  /** 与策划「工作单」发起原因对齐；与 {@link WorkOrder.sourceReason} 同语义。 */
  sourceReason: string;
  haulTargetZoneId?: string;
  haulDropCell?: GridCoord;
  derivedFromWorkId?: string;
}>;

/** 任务树工作单类型（伐木、拾取、搬运、建造）；与 {@link WorkItemSnapshot} 的并存为过渡态，见文件顶部 AP-0189。 */
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
