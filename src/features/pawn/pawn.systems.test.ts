import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from './pawn.factory';
import { createDefaultNeedsProfile, needDecaySystem } from './pawn.systems';

function createPawnTestWorld() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'main', width: 12, height: 12 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'Alice',
    cell: { x: 2, y: 2 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  map.objects.add(pawn);

  return { world, map, pawn };
}

describe('pawn needs systems', () => {
  it('creates trait-adjusted needs profiles for pawns', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });

    const pawn = createPawn({
      name: 'Glutton',
      cell: { x: 1, y: 1 },
      mapId: 'main',
      factionId: 'player',
      rng: world.rng,
      traitIds: ['glutton'],
    });

    const baseline = createDefaultNeedsProfile();

    expect(pawn.traits.map(trait => trait.traitId)).toEqual(['glutton']);
    expect(pawn.needsProfile.foodDecayPerTick).toBeGreaterThan(baseline.foodDecayPerTick);
    expect(pawn.needsProfile.hungerSeekThreshold).toBeGreaterThan(baseline.hungerSeekThreshold);
  });

  it('uses the pawn needs profile for decay and includes timed thoughts in mood', () => {
    const { world, pawn } = createPawnTestWorld();

    pawn.needs.food = 90;
    pawn.needs.rest = 90;
    pawn.needs.joy = 80;
    pawn.needsProfile.foodDecayPerTick = 0.5;
    pawn.needsProfile.restDecayPerTick = 0.25;
    pawn.needsProfile.joyDecayPerTick = 0.1;
    pawn.thoughts.push({
      type: 'SleptOnGround',
      moodOffset: -15,
      remainingTicks: 20,
    });

    needDecaySystem(world);

    expect(pawn.needs.food).toBe(85);
    expect(pawn.needs.rest).toBe(87.5);
    expect(pawn.needs.joy).toBe(79);
    expect(pawn.thoughts[0]?.remainingTicks).toBe(10);
    expect(pawn.needs.mood).toBeCloseTo(69.375);
  });

  it('applies starvation damage on the configured interval and resets once food recovers', () => {
    const { world, pawn } = createPawnTestWorld();

    pawn.needs.food = 0;
    pawn.health.hp = 20;
    pawn.needsProfile.foodDecayPerTick = 0;
    pawn.needsProfile.restDecayPerTick = 0;
    pawn.needsProfile.joyDecayPerTick = 0;
    pawn.needsProfile.starvationDamageInterval = 20;
    pawn.needsProfile.starvationDamageAmount = 3;

    needDecaySystem(world);
    expect(pawn.health.hp).toBe(20);
    expect(pawn.thoughts.some(thought => thought.type === 'Starving')).toBe(true);

    needDecaySystem(world);
    expect(pawn.health.hp).toBe(17);

    pawn.needs.food = 5;
    needDecaySystem(world);
    needDecaySystem(world);

    expect(pawn.health.hp).toBe(17);
    expect(pawn.needsState.starvationTicks).toBe(0);
  });
});
