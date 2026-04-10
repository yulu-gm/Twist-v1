/**
 * @file player-commands.ts
 * @description Script-time 玩家命令 helpers — 通过正式命令入口执行玩家操作。
 *              只在 script 阶段使用，只发命令和推进 tick，不直接改世界。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-commands — 场景命令层
 */

import { createCommandStep } from '../scenario-dsl/scenario.builders';
import type { CommandStep } from '../scenario-dsl/scenario.types';
import type { CellCoord } from '@core/types';

/**
 * 放置建造蓝图（通过 place_blueprint 命令）
 *
 * @param defId - 建筑定义 ID（如 'wall_wood'）
 * @param cell - 蓝图放置位置
 */
export function placeBlueprintCommand(defId: string, cell: CellCoord): CommandStep {
  return createCommandStep(`放置蓝图：${defId} 在 (${cell.x}, ${cell.y})`, ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'place_blueprint', payload: { defId, cell, rotation: 0, mapId: 'scenario' } });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 征召 pawn（通过 draft_pawn 命令，中断当前工作并触发 cleanup）
 *
 * @param pawnName - 棋子名字
 */
export function draftPawnCommand(pawnName: string): CommandStep {
  return createCommandStep(`征召 ${pawnName}`, ({ issueCommand, query, stepTicks }) => {
    const pawn = query.findPawnByName(pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    issueCommand({ type: 'draft_pawn', payload: { pawnId: pawn.id } });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 下达砍树指令（通过 designate_cut 命令）
 *
 * @param cell - 树的位置
 */
export function designateCutCommand(cell: CellCoord): CommandStep {
  return createCommandStep(`下达砍树指令 (${cell.x}, ${cell.y})`, ({ issueCommand, query, stepTicks }) => {
    const tree = query.findPlantAt(cell);
    if (!tree) throw new Error(`在 (${cell.x}, ${cell.y}) 没有找到树`);
    issueCommand({ type: 'designate_cut', payload: { targetObjectId: (tree as any).id, mapId: 'scenario' } });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 强制 pawn 前往指定位置（通过 force_job 命令）
 *
 * @param pawnName - 棋子名字
 * @param targetCell - 目标格子
 */
export function forceGotoCommand(pawnName: string, targetCell: CellCoord): CommandStep {
  return createCommandStep(`强制 ${pawnName} 前往 (${targetCell.x}, ${targetCell.y})`, ({ issueCommand, query, stepTicks }) => {
    const pawn = query.findPawnByName(pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    issueCommand({ type: 'force_job', payload: { pawnId: pawn.id, targetCell } });
    stepTicks(1);
  });
}
