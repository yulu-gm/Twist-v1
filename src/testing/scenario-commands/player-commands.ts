/**
 * @file player-commands.ts
 * @description Script-time 玩家命令 helpers — 通过正式命令入口执行玩家操作。
 *              只在 script 阶段使用，只发命令和推进 tick，不直接改世界。
 *              Task 4 起：玩家入口统一改用 create_map_work_order，由命令处理器物化为 Designation/Blueprint。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-commands — 场景命令层
 */

import { createCommandStep } from '../scenario-dsl/scenario.builders';
import type { CommandStep } from '../scenario-dsl/scenario.types';
import type { CellCoord } from '@core/types';

/**
 * 放置建造蓝图（通过 create_map_work_order 命令开 build 订单，由处理器物化 Blueprint）
 *
 * @param defId - 建筑定义 ID（如 'wall_wood'）
 * @param cell - 蓝图放置位置
 */
export function placeBlueprintCommand(defId: string, cell: CellCoord): CommandStep {
  return createCommandStep(`放置蓝图：${defId} 在 (${cell.x}, ${cell.y})`, ({ issueCommand, stepTicks }) => {
    issueCommand({
      type: 'create_map_work_order',
      payload: {
        mapId: 'scenario',
        orderKind: 'build',
        title: `建造 ${defId}`,
        items: [{ targetRef: { kind: 'cell', cell, defId } }],
      },
    });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 下达砍树指令（通过 create_map_work_order 命令开 cut 订单，由处理器物化 Designation）
 *
 * @param cell - 树的位置
 */
export function designateCutCommand(cell: CellCoord): CommandStep {
  return createCommandStep(`下达砍树指令 (${cell.x}, ${cell.y})`, ({ issueCommand, query, stepTicks }) => {
    const tree = query.findPlantAt(cell);
    if (!tree) throw new Error(`在 (${cell.x}, ${cell.y}) 没有找到树`);
    issueCommand({
      type: 'create_map_work_order',
      payload: {
        mapId: 'scenario',
        orderKind: 'cut',
        title: `砍树 (${cell.x},${cell.y})`,
        items: [{ targetRef: { kind: 'object', objectId: (tree as any).id } }],
      },
    });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 创建多目标砍树订单 — 一次操作生成一张 cut 订单，目标为多棵树。
 * 每个目标格上必须存在植物，否则抛错；命令一次性提交，不会拆成多张订单。
 *
 * @param title - 订单标题（同时作为后续 byTitle 索引断言的稳定 key）
 * @param cells - 树的格子坐标列表
 * @param priorityIndex - 可选优先级（数值越小优先级越高），透传到 create_map_work_order payload
 */
export function createCutOrderCommand(
  title: string,
  cells: CellCoord[],
  priorityIndex?: number,
): CommandStep {
  return createCommandStep(`创建砍树订单：${title}`, ({ issueCommand, query, stepTicks }) => {
    // 先把所有树解析出来；任意一格没树就直接报错（不允许部分失败）
    const items = cells.map(cell => {
      const tree = query.findPlantAt(cell);
      if (!tree) {
        throw new Error(`创建砍树订单失败：在 (${cell.x}, ${cell.y}) 没有找到树`);
      }
      return { targetRef: { kind: 'object' as const, objectId: (tree as any).id } };
    });

    // 整张订单一次提交：保留"一次操作 = 一张订单"的语义
    const payload: Record<string, unknown> = {
      mapId: 'scenario',
      orderKind: 'cut',
      title,
      items,
    };
    if (priorityIndex !== undefined) {
      payload.priorityIndex = priorityIndex;
    }
    issueCommand({ type: 'create_map_work_order', payload });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 创建结果订单（如工坊配方）— 通过 create_result_work_order 命令开订单。
 * 用于场景中模拟非地图来源的产出请求；目前只创建单一 result_batch item。
 *
 * @param orderKind - 订单子类（如 'craft_meal'），由调用方语义决定
 * @param title - 订单标题（同时作为后续 byTitle 索引断言的稳定 key）
 */
export function createResultWorkOrderCommand(orderKind: string, title: string): CommandStep {
  return createCommandStep(`创建结果订单：${title}`, ({ issueCommand, stepTicks }) => {
    issueCommand({
      type: 'create_result_work_order',
      payload: {
        mapId: 'scenario',
        orderKind,
        title,
        items: [{ targetRef: { kind: 'result_batch', batchId: `${orderKind}_batch_1` } }],
      },
    });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

