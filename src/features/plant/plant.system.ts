import { ObjectKind, TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';
import { PlantDef } from '../../world/def-database';
import { Plant } from './plant.types';

/**
 * Ticks per in-game day: 100 ticks/hour * 24 hours = 2400.
 * Used to convert PlantDef.growthDays into per-tick growth increments.
 */
const TICKS_PER_DAY = 2400;

/**
 * Advance plant growth each tick.
 *
 * For each living plant on every map, compute how much growth occurs
 * per system invocation (frequency 50 ticks) and add it. When growth
 * reaches 1.0, check if the def has a harvestYield; if so, mark the
 * plant as harvest-ready.
 */
function growPlantsExecute(world: World): void {
  for (const [, map] of world.maps) {
    const plants = map.objects.allOfKind(ObjectKind.Plant) as Plant[];

    for (const plant of plants) {
      if (plant.destroyed) continue;
      if (plant.growthProgress >= 1) continue;

      const def = world.defs.plants.get(plant.defId) as PlantDef | undefined;
      if (!def) continue;

      // Total ticks to fully grow
      const totalGrowthTicks = def.growthDays * TICKS_PER_DAY;
      if (totalGrowthTicks <= 0) continue;

      // Growth increment per invocation (system runs every 50 ticks)
      const increment = 50 / totalGrowthTicks;
      plant.growthProgress = Math.min(1, plant.growthProgress + increment);

      // Update visual growth stage
      const stageCount = def.growthStages || 1;
      plant.growthStage = Math.min(
        stageCount - 1,
        Math.floor(plant.growthProgress * stageCount),
      );

      // Mark harvest-ready when fully grown and harvestable
      if (plant.growthProgress >= 1 && def.harvestYield) {
        plant.harvestReady = true;
      }
    }
  }
}

export const growPlantsSystem: SystemRegistration = {
  id: 'growPlants',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 50,
  execute: growPlantsExecute,
};
