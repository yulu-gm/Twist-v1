import { ObjectKind, TickPhase, nextObjectId, cellKey } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';
import { Fire } from './fire.types';

/** Cardinal + diagonal neighbours. */
const ADJACENT_OFFSETS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

/**
 * Fire simulation system.
 *
 * Every invocation (frequency 5):
 *  - Increment ticksAlive by 5 (the frequency gap).
 *  - Decrease spreadCooldown by 5.
 *  - When spreadCooldown <= 0, attempt to spread to one random adjacent
 *    cell with a probability proportional to intensity.
 *  - Intensity naturally decays over time; when it reaches 0 the fire
 *    is marked destroyed.
 */
function fireExecute(world: World): void {
  const TICK_STEP = 5; // matches system frequency
  const SPREAD_COOLDOWN_RESET = 100; // ticks before next spread attempt
  const SPREAD_CHANCE = 0.15; // base chance to ignite a neighbour
  const DECAY_RATE = 0.002; // intensity lost per invocation

  for (const [, map] of world.maps) {
    const fires = map.objects.allOfKind(ObjectKind.Fire) as Fire[];
    const fireCells = new Set<string>();

    // Build a set of cells already on fire to avoid double-ignition
    for (const fire of fires) {
      if (!fire.destroyed) {
        fireCells.add(cellKey(fire.cell));
      }
    }

    for (const fire of fires) {
      if (fire.destroyed) continue;

      fire.ticksAlive += TICK_STEP;
      fire.spreadCooldown -= TICK_STEP;

      // Natural decay
      fire.intensity = Math.max(0, fire.intensity - DECAY_RATE);

      // If intensity has dropped to zero, fire burns out
      if (fire.intensity <= 0) {
        fire.destroyed = true;
        map.objects.remove(fire.id);
        continue;
      }

      // Try to spread when cooldown expires
      if (fire.spreadCooldown <= 0) {
        fire.spreadCooldown = SPREAD_COOLDOWN_RESET;

        // Pick a random adjacent cell
        const offset = world.rng.pick(ADJACENT_OFFSETS);
        const nx = fire.cell.x + offset.x;
        const ny = fire.cell.y + offset.y;

        // Bounds check
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;

        const targetKey = cellKey({ x: nx, y: ny });
        if (fireCells.has(targetKey)) continue;

        // Chance to spread, scaled by intensity
        if (world.rng.chance(SPREAD_CHANCE * fire.intensity)) {
          const newFire: Fire = {
            id: nextObjectId(),
            kind: ObjectKind.Fire,
            defId: 'fire',
            mapId: map.id,
            cell: { x: nx, y: ny },
            tags: new Set(['fire']),
            destroyed: false,
            intensity: fire.intensity * 0.8,
            ticksAlive: 0,
            spreadCooldown: SPREAD_COOLDOWN_RESET,
          };
          map.objects.add(newFire);
          fireCells.add(targetKey);
        }
      }
    }
  }
}

export const fireSystem: SystemRegistration = {
  id: 'fire',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 5,
  execute: fireExecute,
};
