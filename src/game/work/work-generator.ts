/**
 * 工作生成：`workId` 为逻辑槽的规范编码；登记侧同槽去重与替换见 {@link addWork}（`work-registry.ts`，AP-0168）。
 */
import { coordKey, type GridCoord } from "../map/world-grid";
import type { WorkItemSnapshot, WorkOrder, WorkStep } from "./work-types";

const DEFAULT_OPEN_STATUS = "open" as const;

/**
 * 编排层在登记工单前后，将 {@link WorkOrder.workId} 写回目标实体（如蓝图 `relatedWorkItemIds`）的回调契约。
 * 对应 oh-code-design 工作生成层「与目标实体双向关联」；由调用方实现具体持久化（AP-0167）。
 */
export type RegisterWorkOrderOnTargetEntity = (targetEntityId: string, workId: string) => void;

/** 对 {@link WorkOrder.targetEntityId} 调用 `register`，供与 `addWork` 成对使用。 */
export function linkWorkOrderToTargetEntity(order: WorkOrder, register: RegisterWorkOrderOnTargetEntity): void {
  register(order.targetEntityId, order.workId);
}

function navigateThen(stepType: string, precondition: string, successResult: string, failureResult: string): readonly WorkStep[] {
  return [
    {
      stepType: "navigate-to-target",
      precondition: "path-exists",
      successResult: "adjacent",
      failureResult: "unreachable"
    },
    {
      stepType,
      precondition,
      successResult,
      failureResult
    }
  ];
}

export function generateChopWork(treeEntityId: string, cell: GridCoord): WorkOrder {
  return {
    workId: `work:chop:${treeEntityId}:${coordKey(cell)}`,
    kind: "chop",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: treeEntityId,
    targetCell: { col: cell.col, row: cell.row },
    priority: 10,
    sourceReason: "logging-marked",
    steps: navigateThen("chop-tree", "tree-marked-for-logging", "tree-felled", "chop-aborted")
  };
}

export function generatePickUpWork(resourceEntityId: string, cell: GridCoord): WorkOrder {
  return {
    workId: `work:pick-up:${resourceEntityId}:${coordKey(cell)}`,
    kind: "pick-up",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: resourceEntityId,
    targetCell: { col: cell.col, row: cell.row },
    priority: 8,
    sourceReason: "resource-pickupable",
    steps: navigateThen("pick-up-resource", "pickup-allowed-and-on-ground", "carried", "pickup-failed")
  };
}

export function generateHaulWork(
  resourceEntityId: string,
  fromCell: GridCoord,
  toZoneId: string,
  dropCell: GridCoord
): WorkOrder {
  return {
    workId: `work:haul:${resourceEntityId}:${coordKey(fromCell)}:${toZoneId}:${coordKey(dropCell)}`,
    kind: "haul",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: resourceEntityId,
    targetCell: { col: fromCell.col, row: fromCell.row },
    haulDropCell: { col: dropCell.col, row: dropCell.row },
    priority: 6,
    sourceReason: "storage-routing",
    steps: [
      {
        stepType: "navigate-to-resource",
        precondition: `at-cell-${coordKey(fromCell)}`,
        successResult: "adjacent",
        failureResult: "unreachable"
      },
      {
        stepType: "pick-up-resource",
        precondition: "resource-on-ground",
        successResult: "carrying",
        failureResult: "cannot-carry"
      },
      {
        stepType: "navigate-to-zone",
        precondition: `zone-${toZoneId}`,
        successResult: "at-drop-cell",
        failureResult: "unreachable"
      },
      {
        stepType: "deposit-in-zone",
        precondition: `zone-${toZoneId}-accepts-material`,
        successResult: "deposited",
        failureResult: "zone-rejected"
      }
    ]
  };
}

export function generateConstructWork(blueprintEntityId: string, cell: GridCoord): WorkOrder {
  return {
    workId: `work:construct:${blueprintEntityId}:${coordKey(cell)}`,
    kind: "construct",
    status: DEFAULT_OPEN_STATUS,
    targetEntityId: blueprintEntityId,
    targetCell: { col: cell.col, row: cell.row },
    priority: 9,
    sourceReason: "blueprint-placed",
    steps: navigateThen(
      "construct-blueprint",
      "blueprint-buildable",
      "construction-complete",
      "construction-aborted"
    )
  };
}

/** WorldCore.workItems 侧快照：由 {@link generateChopWork} 统一语义，避免 world-core 内联重复定义（AP-0197）。 */
export function workItemSnapshotForChopTree(
  workItemId: string,
  treeEntityId: string,
  cell: GridCoord
): WorkItemSnapshot {
  const order = generateChopWork(treeEntityId, cell);
  return {
    id: workItemId,
    kind: "chop-tree",
    anchorCell: { ...order.targetCell },
    targetEntityId: order.targetEntityId,
    status: "open",
    failureCount: 0,
    priority: order.priority,
    sourceReason: order.sourceReason,
    derivedFromWorkId: order.workId
  };
}

/** WorldCore.workItems 侧快照：由 {@link generatePickUpWork} 统一语义（AP-0197）。 */
export function workItemSnapshotForPickUpResource(
  workItemId: string,
  resourceEntityId: string,
  cell: GridCoord
): WorkItemSnapshot {
  const order = generatePickUpWork(resourceEntityId, cell);
  return {
    id: workItemId,
    kind: "pick-up-resource",
    anchorCell: { ...order.targetCell },
    targetEntityId: order.targetEntityId,
    status: "open",
    failureCount: 0,
    priority: order.priority,
    sourceReason: order.sourceReason,
    derivedFromWorkId: order.workId
  };
}

/** 尚无对应 {@link WorkOrder} 种类时仍由生成器模块集中定义快照形态（AP-0197）。 */
export function workItemSnapshotForMineStone(
  workItemId: string,
  stoneObstacleEntityId: string,
  cell: GridCoord
): WorkItemSnapshot {
  return {
    id: workItemId,
    kind: "mine-stone",
    anchorCell: { col: cell.col, row: cell.row },
    targetEntityId: stoneObstacleEntityId,
    status: "open",
    failureCount: 0,
    priority: 7,
    sourceReason: "mining-marked"
  };
}

export function workItemSnapshotForDeconstructObstacle(
  workItemId: string,
  cell: GridCoord,
  targetEntityId: string
): WorkItemSnapshot {
  return {
    id: workItemId,
    kind: "deconstruct-obstacle",
    anchorCell: { col: cell.col, row: cell.row },
    targetEntityId,
    status: "open",
    failureCount: 0,
    priority: 5,
    sourceReason: "deconstruct-marked"
  };
}

/** WorldCore.workItems 侧：与 {@link generateConstructWork} 对齐的建造工单快照。 */
export function workItemSnapshotForConstructBlueprint(
  workItemId: string,
  blueprintEntityId: string,
  cell: GridCoord
): WorkItemSnapshot {
  const order = generateConstructWork(blueprintEntityId, cell);
  return {
    id: workItemId,
    kind: "construct-blueprint",
    anchorCell: { ...order.targetCell },
    targetEntityId: order.targetEntityId,
    status: "open",
    failureCount: 0,
    priority: order.priority,
    sourceReason: order.sourceReason,
    derivedFromWorkId: order.workId
  };
}

/** WorldCore.workItems 侧：与 {@link generateHaulWork} 对齐的搬运工单快照（anchor 仍为投放格，与既有行为一致）。 */
export function workItemSnapshotForHaulToZone(
  workItemId: string,
  resourceEntityId: string,
  fromCell: GridCoord,
  zoneId: string,
  dropCell: GridCoord,
  anchorCell: GridCoord,
  derivedFromWorkId?: string
): WorkItemSnapshot {
  const order = generateHaulWork(resourceEntityId, fromCell, zoneId, dropCell);
  return {
    id: workItemId,
    kind: "haul-to-zone",
    anchorCell: { ...anchorCell },
    targetEntityId: resourceEntityId,
    status: "open",
    failureCount: 0,
    priority: order.priority,
    sourceReason: order.sourceReason,
    haulTargetZoneId: zoneId,
    haulDropCell: { ...dropCell },
    derivedFromWorkId
  };
}
