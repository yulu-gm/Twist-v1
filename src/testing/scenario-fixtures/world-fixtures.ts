/**
 * @file world-fixtures.ts
 * @description Setup-only fixture helpers — 只在 setup 阶段使用，用于搭建初始世界。
 *              创建 pawn、物品、植物、建筑，并设置初始 need 数值。
 * @dependencies features/pawn — 棋子创建；features/plant — 植物创建；
 *               features/item — 物品创建；features/building — 建筑创建；scenario-dsl — 步骤构造器
 * @part-of testing/scenario-fixtures — 场景 fixture 层
 */

import { createSetupStep } from '../scenario-dsl/scenario.builders';
import type { SetupStep } from '../scenario-dsl/scenario.types';
import { createPawn } from '@features/pawn/pawn.factory';
import { createPlant } from '@features/plant/plant.factory';
import { createItem } from '@features/item/item.factory';
import { createBuilding } from '@features/building/building.factory';
import { ObjectKind } from '@core/types';
import type { Pawn } from '@features/pawn/pawn.types';

export function spawnPawnFixture(cell: { x: number; y: number }, name = 'Tester'): SetupStep {
  return createSetupStep(`生成 pawn：${name}`, ({ harness }) => {
    const pawn = createPawn({
      name,
      cell,
      mapId: harness.map.id,
      factionId: 'player',
      rng: harness.world.rng,
    });
    harness.map.objects.add(pawn);
  });
}

export function spawnItemFixture(
  defId: string,
  cell: { x: number; y: number },
  count = 1,
  options?: { alias?: string },
): SetupStep {
  return createSetupStep(`生成物品：${defId} x${count}`, ({ harness }) => {
    const item = createItem({
      defId,
      cell,
      mapId: harness.map.id,
      stackCount: count,
      defs: harness.world.defs,
    });
    harness.map.objects.add(item);
    if (options?.alias) {
      harness.registerAlias(options.alias, item.id);
    }
  });
}

export function spawnBuildingFixture(
  defId: string,
  cell: { x: number; y: number },
  options?: { alias?: string },
): SetupStep {
  return createSetupStep(`生成建筑：${defId}`, ({ harness }) => {
    const building = createBuilding({
      defId,
      cell,
      mapId: harness.map.id,
      defs: harness.world.defs,
    });
    harness.map.objects.add(building);
    if (options?.alias) {
      harness.registerAlias(options.alias, building.id);
    }
  });
}

export function placeTreeFixture(cell: { x: number; y: number }, defId = 'tree_oak'): SetupStep {
  return createSetupStep(`在 (${cell.x}, ${cell.y}) 放置树：${defId}`, ({ harness }) => {
    const plant = createPlant({
      defId,
      cell,
      mapId: harness.map.id,
      growthProgress: 1.0,
      defs: harness.world.defs,
    });
    harness.map.objects.add(plant);
  });
}

export function setPawnFoodFixture(pawnName: string, food: number): SetupStep {
  return createSetupStep(`设置 ${pawnName} 饱食度为 ${food}`, ({ harness }) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    const pawn = pawns.find((p: Pawn) => p.name === pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    pawn.needs.food = food;
  });
}

export function setPawnRestFixture(pawnName: string, rest: number): SetupStep {
  return createSetupStep(`设置 ${pawnName} 休息度为 ${rest}`, ({ harness }) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    const pawn = pawns.find((p: Pawn) => p.name === pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    pawn.needs.rest = rest;
  });
}
