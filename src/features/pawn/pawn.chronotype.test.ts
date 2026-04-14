import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createWorld } from '../../world/world';
import { createPawn } from './pawn.factory';

function createPawnForTraits(traitIds: string[] = [], seed = 12345) {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed });
  return createPawn({
    name: 'Tester',
    cell: { x: 1, y: 1 },
    mapId: 'main',
    factionId: 'player',
    rng: world.rng,
    traitIds,
  });
}

describe('pawn chronotype', () => {
  it('creates a default chronotype and 24-hour schedule mirror for normal pawns', () => {
    const pawn = createPawnForTraits();

    expect(pawn.chronotype.sleepStartHour).toBeGreaterThanOrEqual(21);
    expect(pawn.chronotype.sleepStartHour).toBeLessThanOrEqual(24);
    expect(pawn.chronotype.sleepDurationHours).toBe(8);
    expect(pawn.schedule.entries).toHaveLength(24);
    expect(pawn.schedule.entries.filter(entry => entry.activity === 'sleep')).toHaveLength(8);
  });

  it('shifts night_owl pawns later than the same-seed baseline', () => {
    const normal = createPawnForTraits([], 777);
    const owl = createPawnForTraits(['night_owl'], 777);

    expect(owl.chronotype.sleepStartHour).toBeGreaterThan(normal.chronotype.sleepStartHour);
    expect(owl.chronotype.nightOwlBias).toBeLessThan(normal.chronotype.nightOwlBias);
  });

  it('lets high_energy pawns resist sleep pressure more than the same-seed baseline', () => {
    const normal = createPawnForTraits([], 888);
    const energetic = createPawnForTraits(['high_energy'], 888);

    expect(energetic.needsProfile.restDecayPerTick).toBeLessThan(normal.needsProfile.restDecayPerTick);
    expect(energetic.chronotype.nightOwlBias).toBeLessThan(normal.chronotype.nightOwlBias);
  });
});
