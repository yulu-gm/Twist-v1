/**
 * @file zone-commands.ts
 * @description Script-time zone 命令 helpers — 通过正式命令入口操作 zone。
 *              只在 script 阶段使用，只发命令和推进 tick，不直接改世界。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-commands — 场景命令层
 */

import { createCommandStep } from '../scenario-dsl/scenario.builders';
import type { CommandStep } from '../scenario-dsl/scenario.types';
import type { CellCoord } from '@core/types';

/**
 * 创建 zone 区域（通过 zone_set_cells 命令）
 *
 * @param zoneType - zone 类型（如 'stockpile'）
 * @param cells - zone 覆盖的格子列表
 */
export function createZoneCommand(zoneType: string, cells: CellCoord[]): CommandStep {
  return createCommandStep(`创建 ${zoneType} 区域`, ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'zone_set_cells', payload: { mapId: 'scenario', zoneType, cells } });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 移除指定 zone 格子（通过 zone_remove_cells 命令）
 *
 * @param cells - 要移除的格子列表
 */
export function removeZoneCellsCommand(cells: CellCoord[]): CommandStep {
  return createCommandStep('移除指定 zone 格子', ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'zone_remove_cells', payload: { mapId: 'scenario', cells } });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}

/**
 * 删除整个 zone（通过 zone_delete 命令）
 *
 * @param zoneId - zone ID
 */
export function deleteZoneCommand(zoneId: string): CommandStep {
  return createCommandStep(`删除 zone：${zoneId}`, ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'zone_delete', payload: { mapId: 'scenario', zoneId } });
    // 推进 1 tick 让命令被处理
    stepTicks(1);
  });
}
