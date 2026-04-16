/**
 * @file checkpoint-snapshot.ts
 * @description Checkpoint 快照类型和生成函数 — 从世界状态提取关键 simulation 信息，
 *              供无头与可视模式的 diff 对照使用
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

/** 完整 checkpoint 快照 */
export interface CheckpointSnapshot {
  tick: number;
  pawns: PawnSnapshot[];
  items: ItemSnapshot[];
  designations: DesignationSnapshot[];
  blueprints: BlueprintSnapshot[];
  buildings: BuildingSnapshot[];
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

  return { tick: world.tick, pawns, items, designations, blueprints, buildings };
}
