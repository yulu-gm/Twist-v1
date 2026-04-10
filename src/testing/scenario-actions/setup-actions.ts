/**
 * @file setup-actions.ts
 * @description 场景初始化动作 — 用于在场景 setup 阶段搭建世界状态的复用型动作
 * @dependencies features/pawn — 棋子创建；features/plant — 植物创建；
 *               features/item — 物品创建；scenario-dsl — 步骤构造器
 * @part-of testing/scenario-actions — 场景动作库
 */

import { createActionStep } from '../scenario-dsl/scenario.builders';
import type { ActionStep, ScenarioStepContext } from '../scenario-dsl/scenario.types';
import { createPawn } from '@features/pawn/pawn.factory';
import { createPlant } from '@features/plant/plant.factory';
import { createItem } from '@features/item/item.factory';
import { ObjectKind } from '@core/types';
import type { Pawn } from '@features/pawn/pawn.types';

/**
 * 生成一个 pawn
 *
 * @param cell - 初始位置
 * @param name - 棋子名字
 */
export function spawnPawnAction(cell: { x: number; y: number }, name = 'Tester'): ActionStep {
  return createActionStep(`生成 pawn：${name}`, ({ harness }: ScenarioStepContext) => {
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

/**
 * 放置一棵树
 *
 * @param cell - 树的位置
 * @param defId - 植物定义 ID（如 'tree_oak'）
 */
export function placeTreeAction(cell: { x: number; y: number }, defId = 'tree_oak'): ActionStep {
  return createActionStep(`在 (${cell.x}, ${cell.y}) 放置树：${defId}`, ({ harness }: ScenarioStepContext) => {
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

/**
 * 生成地面物品
 *
 * @param defId - 物品定义 ID（如 'wood', 'meal_simple'）
 * @param cell - 物品位置
 * @param count - 堆叠数量
 */
export function spawnItemAction(defId: string, cell: { x: number; y: number }, count = 1): ActionStep {
  return createActionStep(`生成物品：${defId} x${count}`, ({ harness }: ScenarioStepContext) => {
    const item = createItem({
      defId,
      cell,
      mapId: harness.map.id,
      stackCount: count,
      defs: harness.world.defs,
    });
    harness.map.objects.add(item);
  });
}

/**
 * 创建 stockpile 区域
 *
 * @param cells - stockpile 覆盖的格子列表
 */
export function createStockpileAction(cells: Array<{ x: number; y: number }>): ActionStep {
  return createActionStep('创建 stockpile 区域', ({ harness }: ScenarioStepContext) => {
    harness.world.commandQueue.push({
      type: 'zone_set_cells',
      payload: { mapId: harness.map.id, zoneType: 'stockpile', cells },
    });
    // 推进 1 tick 让命令被处理
    harness.stepTicks(1);
  });
}

/**
 * 设置 pawn 的饱食度
 *
 * @param pawnName - 棋子名字
 * @param food - 目标饱食度
 */
export function setPawnFoodByNameAction(pawnName: string, food: number): ActionStep {
  return createActionStep(`设置 ${pawnName} 饱食度为 ${food}`, ({ harness }: ScenarioStepContext) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    const pawn = pawns.find((p: Pawn) => p.name === pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    pawn.needs.food = food;
  });
}
