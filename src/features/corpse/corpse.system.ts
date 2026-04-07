import { ObjectKind, TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';
import { Corpse } from './corpse.types';

/**
 * Corpse decay system.
 *
 * Every 50 ticks, advance each corpse's decayProgress by 0.01.
 * When decayProgress reaches 1.0, the corpse is marked destroyed
 * and removed from the object pool.
 */
function corpseDecayExecute(world: World): void {
  for (const [, map] of world.maps) {
    const corpses = map.objects.allOfKind(ObjectKind.Corpse) as Corpse[];

    for (const corpse of corpses) {
      if (corpse.destroyed) continue;

      corpse.decayProgress = Math.min(1, corpse.decayProgress + 0.01);

      if (corpse.decayProgress >= 1.0) {
        corpse.destroyed = true;
        map.objects.remove(corpse.id);
      }
    }
  }
}

export const corpseDecaySystem: SystemRegistration = {
  id: 'corpseDecay',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 50,
  execute: corpseDecayExecute,
};
