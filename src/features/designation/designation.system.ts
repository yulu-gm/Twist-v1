/**
 * @file designation.system.ts
 * @description 工作生成系统——扫描所有指派对象，清理目标已不存在的无效指派，确保有效指派对AI系统可见
 * @dependencies TickPhase, ObjectKind — 核心类型；SystemRegistration — tick系统注册接口；World — 世界状态
 * @part-of features/designation — 指派/工作指令功能
 */

import { TickPhase, ObjectKind } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';

/**
 * 扫描所有指派并清理无效项
 * @param world - 世界状态对象
 * 操作：遍历所有地图的指派对象，检查目标对象是否仍存在、目标地形是否仍可挖掘，
 *       若目标已消失则标记指派为已销毁
 */
function scanDesignationsForWork(world: World): void {
  for (const [, map] of world.maps) {
    const designations = map.objects.allOfKind(ObjectKind.Designation);

    for (const des of designations) {
      if (des.destroyed) continue;

      const designation = des as any;

      // 如果指派目标是某个具体对象，验证该对象是否仍然存在
      if (designation.targetObjectId) {
        const target = map.objects.get(designation.targetObjectId);
        if (!target || target.destroyed) {
          // 目标已消失——移除指派
          des.destroyed = true;
          continue;
        }
      }

      // 如果指派是挖矿类型且指定了目标格子，验证地形是否仍然可挖
      if (designation.designationType === 'mine' && designation.targetCell) {
        const terrain = map.terrain.get(designation.targetCell.x, designation.targetCell.y);
        const tDef = world.defs.terrains.get(terrain);
        if (!tDef || !tDef.mineable) {
          // 已被挖空——移除指派
          des.destroyed = true;
          continue;
        }
      }
    }
  }
}

/** 工作生成系统注册：在 WORK_GENERATION 阶段以频率5执行，扫描并清理指派 */
export const workGenerationSystem: SystemRegistration = {
  id: 'work_scanner',
  phase: TickPhase.WORK_GENERATION,
  frequency: 5,
  execute: scanDesignationsForWork,
};
