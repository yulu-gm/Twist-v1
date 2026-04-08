/**
 * @file plant.system.ts
 * @description 植物生长系统，每 50 tick 推进所有植物的生长进度
 * @dependencies core/types（ObjectKind, TickPhase）, core/tick-runner, world/world,
 *               world/def-database（PlantDef）, plant.types
 * @part-of 植物系统（plant）
 *
 * 组成部分：
 *   - TICKS_PER_DAY：每游戏日的 tick 数常量
 *   - growPlantsExecute：生长逻辑核心函数
 *   - growPlantsSystem：系统注册配置
 */

import { ObjectKind, TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';
import { PlantDef } from '../../world/def-database';
import { Plant } from './plant.types';

/**
 * 每游戏日的 tick 数：100 ticks/小时 * 24 小时 = 2400
 * 用于将 PlantDef.growthDays（生长天数）转换为每 tick 的生长增量
 */
const TICKS_PER_DAY = 2400;

/**
 * 植物生长核心逻辑
 * 遍历所有地图上的存活植物，根据定义的生长天数计算每次调用的生长增量，
 * 更新生长进度和视觉阶段，当完全成熟且可收获时标记为收获就绪
 *
 * @param world - 游戏世界实例，用于访问地图和植物定义
 */
function growPlantsExecute(world: World): void {
  for (const [, map] of world.maps) {
    const plants = map.objects.allOfKind(ObjectKind.Plant) as Plant[];

    for (const plant of plants) {
      if (plant.destroyed) continue;
      if (plant.growthProgress >= 1) continue;

      const def = world.defs.plants.get(plant.defId) as PlantDef | undefined;
      if (!def) continue;

      // 计算完全成熟所需的总 tick 数
      // Total ticks to fully grow
      const totalGrowthTicks = def.growthDays * TICKS_PER_DAY;
      if (totalGrowthTicks <= 0) continue;

      // 每次系统调用的生长增量（系统每 50 tick 执行一次）
      // Growth increment per invocation (system runs every 50 ticks)
      const increment = 50 / totalGrowthTicks;
      plant.growthProgress = Math.min(1, plant.growthProgress + increment);

      // 更新视觉生长阶段索引
      // Update visual growth stage
      const stageCount = def.growthStages || 1;
      plant.growthStage = Math.min(
        stageCount - 1,
        Math.floor(plant.growthProgress * stageCount),
      );

      // 完全成熟且定义了收获产出时，标记为可收获
      // Mark harvest-ready when fully grown and harvestable
      if (plant.growthProgress >= 1 && def.harvestYield) {
        plant.harvestReady = true;
      }
    }
  }
}

/**
 * 植物生长系统注册配置
 * 在 WORLD_UPDATE 阶段每 50 tick 执行一次生长逻辑
 */
export const growPlantsSystem: SystemRegistration = {
  id: 'growPlants',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 50,
  execute: growPlantsExecute,
};
