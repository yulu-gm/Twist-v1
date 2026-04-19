/**
 * @file checkpoint-snapshot.ts
 * @description Checkpoint 快照类型和生成函数 — 从世界状态提取关键 simulation 信息，
 *              供无头与可视模式的 diff 对照使用。
 *              快照同时收录 work orders（按 priorityIndex 排序），以便场景测试断言订单
 *              优先级、完成情况与 item 状态，而不依赖 UI 选择器。
 * @dependencies core/types — 对象类型枚举
 * @part-of testing/scenario-harness — 场景 harness 层
 */

import { ObjectKind } from '@core/types';
import type { GameMap } from '@world/game-map';
import type { World } from '@world/world';
import type { Pawn } from '@features/pawn/pawn.types';
import type { Item } from '@features/item/item.types';
import type { Designation } from '@features/designation/designation.types';
import type { Blueprint } from '@features/construction/blueprint.types';
import type { WorkOrder, WorkOrderItem } from '@features/work-orders/work-order.types';

/** Pawn 快照 */
export interface PawnSnapshot {
  id: string;
  name: string;
  cell: { x: number; y: number };
  jobId: string | null;
  jobDefId: string | null;
  food: number;
  rest: number;
}

/** 物品快照 */
interface ItemSnapshot {
  id: string;
  defId: string;
  cell: { x: number; y: number };
  stackCount: number;
}

/** 指派快照 */
interface DesignationSnapshot {
  id: string;
  designationType: string;
  cell: { x: number; y: number };
}

/** 蓝图快照 */
interface BlueprintSnapshot {
  id: string;
  defId: string;
  delivered: Array<{ defId: string; count: number }>;
}

/** 建筑快照 */
interface BuildingSnapshot {
  id: string;
  defId: string;
  cell: { x: number; y: number };
}

/** 工作订单 item 快照 — harness 自有类型，不复用 UI 选择器结果以保持 harness UI 无关。 */
interface WorkOrderItemCheckpoint {
  id: string;
  status: string;
  blockedReason: string | null;
  claimedByPawnId: string | null;
}

/** 工作订单快照 — 用于断言订单优先级、完成数与 item 状态。 */
interface WorkOrderCheckpoint {
  id: string;
  title: string;
  orderKind: string;
  sourceKind: 'map' | 'result';
  status: string;
  priorityIndex: number;
  totalItemCount: number;
  doneItemCount: number;
  items: WorkOrderItemCheckpoint[];
}

/**
 * 工作订单聚合快照 —
 * - list：按 priorityIndex 升序的全部订单
 * - byTitle：以订单 title 为键的索引（重名时后写入覆盖前者）。
 *   选择 title 而非 id：自动生成的 wo_<n> 在不同场景下序号会变化，
 *   而 title 由场景作者显式控制，可读性与稳定性都更好。
 */
interface WorkOrdersCheckpoint {
  list: WorkOrderCheckpoint[];
  byTitle: Record<string, WorkOrderCheckpoint>;
}

/** 完整 checkpoint 快照 */
export interface CheckpointSnapshot {
  tick: number;
  pawns: PawnSnapshot[];
  items: ItemSnapshot[];
  designations: DesignationSnapshot[];
  blueprints: BlueprintSnapshot[];
  buildings: BuildingSnapshot[];
  workOrders: WorkOrdersCheckpoint;
}

/**
 * 从当前世界和地图状态生成 checkpoint 快照
 *
 * @param world - 游戏世界
 * @param map - 目标地图
 * @returns 包含关键 simulation 信息的快照
 */
export function createCheckpointSnapshot(world: World, map: GameMap): CheckpointSnapshot {
  const pawns: PawnSnapshot[] = [];
  for (const obj of map.objects.allOfKind(ObjectKind.Pawn)) {
    const pawn = obj as Pawn;
    pawns.push({
      id: pawn.id,
      name: pawn.name,
      cell: { x: pawn.cell.x, y: pawn.cell.y },
      jobId: pawn.ai?.currentJob?.id ?? null,
      jobDefId: pawn.ai?.currentJob?.defId ?? null,
      food: pawn.needs?.food ?? 0,
      rest: pawn.needs?.rest ?? 0,
    });
  }

  const items: ItemSnapshot[] = [];
  for (const obj of map.objects.allOfKind(ObjectKind.Item)) {
    const item = obj as Item;
    items.push({
      id: item.id,
      defId: item.defId,
      cell: { x: item.cell.x, y: item.cell.y },
      stackCount: item.stackCount,
    });
  }

  const designations: DesignationSnapshot[] = [];
  for (const obj of map.objects.allOfKind(ObjectKind.Designation)) {
    const des = obj as Designation;
    designations.push({
      id: des.id,
      designationType: des.designationType as string,
      cell: { x: des.cell.x, y: des.cell.y },
    });
  }

  const blueprints: BlueprintSnapshot[] = [];
  for (const obj of map.objects.allOfKind(ObjectKind.Blueprint)) {
    const bp = obj as Blueprint;
    blueprints.push({
      id: bp.id,
      defId: bp.targetDefId,
      delivered: bp.materialsDelivered.map((m: any) => ({ defId: m.defId, count: m.count })),
    });
  }

  const buildings: BuildingSnapshot[] = [];
  for (const obj of map.objects.allOfKind(ObjectKind.Building)) {
    buildings.push({
      id: obj.id,
      defId: obj.defId,
      cell: { x: obj.cell.x, y: obj.cell.y },
    });
  }

  // 工作订单 — map.workOrders.list() 已按 priorityIndex 升序返回。
  const workOrderList: WorkOrderCheckpoint[] = [];
  const workOrderByTitle: Record<string, WorkOrderCheckpoint> = {};
  for (const order of map.workOrders.list() as WorkOrder[]) {
    const items: WorkOrderItemCheckpoint[] = order.items.map((it: WorkOrderItem) => ({
      id: it.id,
      status: it.status,
      blockedReason: it.blockedReason ?? null,
      claimedByPawnId: it.claimedByPawnId ?? null,
    }));
    const doneItemCount = order.items.reduce(
      (sum: number, it: WorkOrderItem) => sum + (it.status === 'done' ? 1 : 0),
      0,
    );
    const snapshot: WorkOrderCheckpoint = {
      id: order.id,
      title: order.title,
      orderKind: order.orderKind,
      sourceKind: order.sourceKind,
      status: order.status,
      priorityIndex: order.priorityIndex,
      totalItemCount: order.items.length,
      doneItemCount,
      items,
    };
    workOrderList.push(snapshot);
    // byTitle 后写入覆盖：避免重名订单互相吞掉，由场景作者保证标题唯一即可
    workOrderByTitle[order.title] = snapshot;
  }

  return {
    tick: world.tick,
    pawns,
    items,
    designations,
    blueprints,
    buildings,
    workOrders: { list: workOrderList, byTitle: workOrderByTitle },
  };
}
