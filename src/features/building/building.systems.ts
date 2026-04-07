import { TickPhase } from '../../core/types';
import type { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import { getAllBuildings } from './building.queries';

/**
 * Building tick system — handles power connectivity and storage logic.
 * Currently a placeholder for future expansion.
 */
export const buildingTickSystem: SystemRegistration = {
  id: 'building_tick',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 10,
  execute(world: World) {
    for (const [, map] of world.maps) {
      const buildings = getAllBuildings(map);
      for (const building of buildings) {
        if (building.destroyed) continue;
        // Power connectivity placeholder
        if (building.power) {
          building.power.connected = true;
        }
      }
    }
  },
};
