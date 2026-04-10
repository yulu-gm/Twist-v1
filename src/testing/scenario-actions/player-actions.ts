/**
 * @file player-actions.ts
 * @description 玩家操作动作 — 模拟玩家在游戏中执行的命令（指派、蓝图等）
 * @dependencies scenario-dsl — 步骤构造器；core/types — 对象类型
 * @part-of testing/scenario-actions — 场景动作库
 */

import { createActionStep } from '../scenario-dsl/scenario.builders';
import type { ActionStep, ScenarioStepContext } from '../scenario-dsl/scenario.types';
import { ObjectKind } from '@core/types';

/**
 * 下达砍树指令 — 对指定位置上的树下达 cut 指派
 *
 * @param cell - 树的位置
 */
export function designateCutAction(cell: { x: number; y: number }): ActionStep {
  return createActionStep(`下达砍树指令 (${cell.x}, ${cell.y})`, ({ harness }: ScenarioStepContext) => {
    // 找到该位置上的植物
    const plants = harness.map.objects.allOfKind(ObjectKind.Plant);
    const target = plants.find(p => p.cell.x === cell.x && p.cell.y === cell.y);
    if (!target) throw new Error(`在 (${cell.x}, ${cell.y}) 没有找到树`);

    harness.world.commandQueue.push({
      type: 'designate_cut',
      payload: {
        targetObjectId: target.id,
        mapId: harness.map.id,
      },
    });
    // 推进 1 tick 让命令被处理
    harness.stepTicks(1);
  });
}

/**
 * 放置建造蓝图 — 在指定位置放置建筑蓝图
 *
 * @param defId - 建筑定义 ID（如 'wall_wood'）
 * @param cell - 蓝图放置位置
 */
export function placeBlueprintAction(defId: string, cell: { x: number; y: number }): ActionStep {
  return createActionStep(`放置蓝图：${defId} 在 (${cell.x}, ${cell.y})`, ({ harness }: ScenarioStepContext) => {
    harness.world.commandQueue.push({
      type: 'place_blueprint',
      payload: { defId, cell, rotation: 0, mapId: harness.map.id },
    });
    // 推进 1 tick 让命令被处理
    harness.stepTicks(1);
  });
}
