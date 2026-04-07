/** work-generation：依树木 / 岩石标记向 WorkRegistry 登记伐木、开采工单（与 Phaser 无关）。 */

import type { EntityId } from "./entity-system";
import { EntityRegistry } from "./entity-system";
import type { WorkId, WorkOrder, WorkRegistry } from "./work-system";

export const WORK_TYPE_FELLING = "felling" as const;
export const WORK_TYPE_MINING = "mining" as const;
export const WORK_TYPE_PICKUP = "pickup" as const;

export type FellingOrMiningWorkType = typeof WORK_TYPE_FELLING | typeof WORK_TYPE_MINING | typeof WORK_TYPE_PICKUP;

export const WORK_REASON_LUMBER_MARKED = "lumber_marked";
export const WORK_REASON_MINING_MARKED = "mining_marked";
export const WORK_REASON_PICKUP_MARKED = "pickup_marked";

const DEFAULT_PRIORITY = 50;

/** 同一 targetEntityId + workType 下，pending / in_progress 仅存一条：重复生成返回既有 id。 */
function findActiveWorkForTarget(
  workRegistry: WorkRegistry,
  workType: string,
  targetEntityId: EntityId
): WorkOrder | undefined {
  for (const o of workRegistry.listByWorkTypeAndStatus(workType, "pending")) {
    if (o.targetEntityId === targetEntityId) return o;
  }
  for (const o of workRegistry.listByWorkTypeAndStatus(workType, "in_progress")) {
    if (o.targetEntityId === targetEntityId) return o;
  }
  return undefined;
}

function stableWorkId(workType: string, targetEntityId: EntityId): WorkId {
  return `${workType}:${targetEntityId}`;
}

export function generateFellingWork(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  treeId: EntityId
): WorkId {
  const tree = entityRegistry.getTree(treeId);
  if (!tree) {
    throw new Error(`work-generation: unknown tree ${treeId}`);
  }
  if (!tree.lumberMarked) {
    throw new Error(`work-generation: tree ${treeId} is not marked for felling`);
  }
  if (tree.occupied) {
    throw new Error(`work-generation: tree ${treeId} is occupied`);
  }

  const active = findActiveWorkForTarget(workRegistry, WORK_TYPE_FELLING, treeId);
  if (active) return active.id;

  const id = stableWorkId(WORK_TYPE_FELLING, treeId);
  const order: WorkOrder = {
    id,
    workType: WORK_TYPE_FELLING,
    status: "pending",
    targetEntityId: treeId,
    targetCell: tree.cell,
    reason: WORK_REASON_LUMBER_MARKED,
    priority: DEFAULT_PRIORITY
  };
  workRegistry.registerWork(order);
  return id;
}

export function generateMiningWork(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  rockId: EntityId
): WorkId {
  const rock = entityRegistry.getRock(rockId);
  if (!rock) {
    throw new Error(`work-generation: unknown rock ${rockId}`);
  }
  if (!rock.miningMarked) {
    throw new Error(`work-generation: rock ${rockId} is not marked for mining`);
  }
  if (rock.occupied) {
    throw new Error(`work-generation: rock ${rockId} is occupied`);
  }

  const active = findActiveWorkForTarget(workRegistry, WORK_TYPE_MINING, rockId);
  if (active) return active.id;

  const id = stableWorkId(WORK_TYPE_MINING, rockId);
  const order: WorkOrder = {
    id,
    workType: WORK_TYPE_MINING,
    status: "pending",
    targetEntityId: rockId,
    targetCell: rock.cell,
    reason: WORK_REASON_MINING_MARKED,
    priority: DEFAULT_PRIORITY
  };
  workRegistry.registerWork(order);
  return id;
}

export function generatePickupWork(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  materialId: EntityId
): WorkId {
  const mat = entityRegistry.getMaterial(materialId);
  if (!mat) {
    throw new Error(`work-generation: unknown material ${materialId}`);
  }
  if (!mat.pickupMarked) {
    throw new Error(`work-generation: material ${materialId} is not marked for pickup`);
  }
  if (mat.containerKind !== "map") {
    throw new Error(`work-generation: material ${materialId} is not on the map`);
  }
  if (mat.reservedByPawnId) {
    throw new Error(`work-generation: material ${materialId} is reserved`);
  }

  const active = findActiveWorkForTarget(workRegistry, WORK_TYPE_PICKUP, materialId);
  if (active) return active.id;

  const id = stableWorkId(WORK_TYPE_PICKUP, materialId);
  const order: WorkOrder = {
    id,
    workType: WORK_TYPE_PICKUP,
    status: "pending",
    targetEntityId: materialId,
    targetCell: mat.cell,
    reason: WORK_REASON_PICKUP_MARKED,
    priority: DEFAULT_PRIORITY
  };
  workRegistry.registerWork(order);
  return id;
}

