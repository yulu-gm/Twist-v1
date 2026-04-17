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

