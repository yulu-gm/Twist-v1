/**
 * @file wait-conditions.ts
 * @description 等待条件和断言 — 封装常用的业务级等待条件和最终断言
 * @dependencies scenario-dsl — 步骤构造器；core/types — 对象类型
 * @part-of testing/scenario-actions — 场景动作库
 */

import { createWaitForStep, createAssertStep } from '../scenario-dsl/scenario.builders';
import type { WaitForStep, AssertStep, ScenarioStepContext } from '../scenario-dsl/scenario.types';
import { ObjectKind } from '@core/types';
import type { Pawn } from '@features/pawn/pawn.types';
import type { Item } from '@features/item/item.types';

/**
 * 等待 pawn 接到工作（任意 job）
 *
 * @param title - 步骤标题
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForPawnJobAction(title: string, timeoutTicks = 100): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    return pawns.some((p: Pawn) => p.ai?.currentJob !== null);
  }, { timeoutTicks, timeoutMessage: `超时：${title}` });
}

/**
 * 等待指定位置没有植物（树已被砍倒）
 *
 * @param title - 步骤标题
 * @param cell - 目标位置
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForNoPlantAtAction(
  title: string,
  cell: { x: number; y: number },
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const plants = harness.map.objects.allOfKind(ObjectKind.Plant);
    return !plants.some(p => p.cell.x === cell.x && p.cell.y === cell.y);
  }, { timeoutTicks, timeoutMessage: `超时：在 (${cell.x}, ${cell.y}) 的树仍未被砍倒` });
}

/**
 * 断言指定位置附近有木材掉落
 *
 * @param cell - 期望掉落位置
 * @param radius - 搜索半径
 */
export function assertWoodDroppedAction(cell: { x: number; y: number }, radius = 3): AssertStep {
  return createAssertStep(`期待木材出现在 (${cell.x}, ${cell.y}) 附近`, ({ harness }: ScenarioStepContext) => {
    const items = harness.map.objects.allOfKind(ObjectKind.Item);
    return items.some((item: Item) =>
      item.defId === 'wood' &&
      Math.abs(item.cell.x - cell.x) <= radius &&
      Math.abs(item.cell.y - cell.y) <= radius,
    );
  }, { failureMessage: `在 (${cell.x}, ${cell.y}) 附近未发现木材` });
}

/**
 * 等待特定 pawn 切换到指定 jobDefId
 *
 * @param title - 步骤标题
 * @param pawnName - 棋子名字
 * @param jobDefId - 目标 job 定义 ID
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForPawnJobDefAction(
  title: string,
  pawnName: string,
  jobDefId: string,
  timeoutTicks = 100,
): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    const pawn = pawns.find((p: Pawn) => p.name === pawnName);
    return pawn?.ai?.currentJob?.defId === jobDefId;
  }, { timeoutTicks, timeoutMessage: `超时：${pawnName} 未切换到 ${jobDefId}` });
}

/**
 * 等待 pawn 饱食度达到最小值
 *
 * @param title - 步骤标题
 * @param pawnName - 棋子名字
 * @param minFood - 最小饱食度
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForPawnFoodAtLeastAction(
  title: string,
  pawnName: string,
  minFood: number,
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    const pawn = pawns.find((p: Pawn) => p.name === pawnName);
    return (pawn?.needs?.food ?? 0) >= minFood;
  }, { timeoutTicks, timeoutMessage: `超时：${pawnName} 饱食度未达到 ${minFood}` });
}

/**
 * 断言 pawn 饱食度达到最小值
 *
 * @param pawnName - 棋子名字
 * @param minFood - 最小饱食度
 */
export function assertPawnFoodAtLeastAction(pawnName: string, minFood: number): AssertStep {
  return createAssertStep(`${pawnName} 饱食度 >= ${minFood}`, ({ harness }: ScenarioStepContext) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn);
    const pawn = pawns.find((p: Pawn) => p.name === pawnName);
    return (pawn?.needs?.food ?? 0) >= minFood;
  }, { failureMessage: `${pawnName} 饱食度不足 ${minFood}` });
}

/**
 * 等待物品出现在 stockpile 区域内
 *
 * @param title - 步骤标题
 * @param itemDefId - 物品定义 ID
 * @param cell - stockpile 格子位置
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForItemInStockpileAction(
  title: string,
  itemDefId: string,
  cell: { x: number; y: number },
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const items = harness.map.objects.allOfKind(ObjectKind.Item);
    return items.some((item: Item) =>
      item.defId === itemDefId &&
      item.cell.x === cell.x &&
      item.cell.y === cell.y,
    );
  }, { timeoutTicks, timeoutMessage: `超时：${itemDefId} 未出现在 (${cell.x}, ${cell.y})` });
}

/**
 * 断言特定物品堆存在于指定位置
 *
 * @param itemDefId - 物品定义 ID
 * @param cell - 期望位置
 * @param minCount - 最小堆叠数量
 */
export function assertItemStackAtAction(
  itemDefId: string,
  cell: { x: number; y: number },
  minCount: number,
): AssertStep {
  return createAssertStep(
    `${itemDefId} 在 (${cell.x}, ${cell.y}) 数量 >= ${minCount}`,
    ({ harness }: ScenarioStepContext) => {
      const items = harness.map.objects.allOfKind(ObjectKind.Item);
      const total = items
        .filter((item: Item) => item.defId === itemDefId && item.cell.x === cell.x && item.cell.y === cell.y)
        .reduce((sum: number, item: Item) => sum + item.stackCount, 0);
      return total >= minCount;
    },
    { failureMessage: `${itemDefId} 在 (${cell.x}, ${cell.y}) 数量不足 ${minCount}` },
  );
}

/**
 * 等待蓝图材料全部送达
 *
 * @param title - 步骤标题
 * @param defId - 建筑定义 ID
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForBlueprintDeliveredAction(
  title: string,
  defId: string,
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const blueprints = harness.map.objects.allOfKind(ObjectKind.Blueprint);
    // 如果没有蓝图了（已转为工地），说明材料已送达
    return !blueprints.some((bp: any) => bp.targetDefId === defId);
  }, { timeoutTicks, timeoutMessage: `超时：${defId} 的蓝图材料未送达` });
}

/**
 * 等待建筑完成创建
 *
 * @param title - 步骤标题
 * @param defId - 建筑定义 ID
 * @param cell - 期望位置
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForBuildingCreatedAction(
  title: string,
  defId: string,
  cell: { x: number; y: number },
  timeoutTicks = 400,
): WaitForStep {
  return createWaitForStep(title, ({ harness }: ScenarioStepContext) => {
    const buildings = harness.map.objects.allOfKind(ObjectKind.Building);
    return buildings.some(b => b.defId === defId && b.cell.x === cell.x && b.cell.y === cell.y);
  }, { timeoutTicks, timeoutMessage: `超时：${defId} 建筑未在 (${cell.x}, ${cell.y}) 创建` });
}

/**
 * 断言建筑存在于指定位置
 *
 * @param defId - 建筑定义 ID
 * @param cell - 期望位置
 */
export function assertBuildingExistsAction(defId: string, cell: { x: number; y: number }): AssertStep {
  return createAssertStep(
    `${defId} 建筑存在于 (${cell.x}, ${cell.y})`,
    ({ harness }: ScenarioStepContext) => {
      const buildings = harness.map.objects.allOfKind(ObjectKind.Building);
      return buildings.some(b => b.defId === defId && b.cell.x === cell.x && b.cell.y === cell.y);
    },
    { failureMessage: `${defId} 建筑不存在于 (${cell.x}, ${cell.y})` },
  );
}
