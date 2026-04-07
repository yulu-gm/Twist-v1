import { TickPhase, ObjectKind } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';

/**
 * WORK_GENERATION phase: scans designations and ensures they're visible
 * to the AI system for job selection. Also cleans up designations whose
 * targets no longer exist.
 */
function scanDesignationsForWork(world: World): void {
  for (const [, map] of world.maps) {
    const designations = map.objects.allOfKind(ObjectKind.Designation);

    for (const des of designations) {
      if (des.destroyed) continue;

      const designation = des as any;

      // If designation targets a specific object, verify it still exists
      if (designation.targetObjectId) {
        const target = map.objects.get(designation.targetObjectId);
        if (!target || target.destroyed) {
          // Target gone — remove designation
          des.destroyed = true;
          continue;
        }
      }

      // If designation targets a cell (mining), verify the terrain is still mineable
      if (designation.designationType === 'mine' && designation.targetCell) {
        const terrain = map.terrain.get(designation.targetCell.x, designation.targetCell.y);
        const tDef = world.defs.terrains.get(terrain);
        if (!tDef || !tDef.mineable) {
          // Already mined — remove designation
          des.destroyed = true;
          continue;
        }
      }
    }
  }
}

export const workGenerationSystem: SystemRegistration = {
  id: 'work_scanner',
  phase: TickPhase.WORK_GENERATION,
  frequency: 5,
  execute: scanDesignationsForWork,
};
