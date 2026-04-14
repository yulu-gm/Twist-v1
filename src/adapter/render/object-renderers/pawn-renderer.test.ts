import { describe, expect, it, vi } from 'vitest';
import { buildDefDatabase } from '../../../defs';
import { createWorld } from '../../../world/world';
import { createPawn } from '../../../features/pawn/pawn.factory';
import { JobState, ToilState, ToilType } from '../../../core/types';

vi.mock('phaser', () => ({
  default: {},
}));

import { PawnRenderer } from './pawn-renderer';

describe('PawnRenderer sleep progress', () => {
  it('prefers the sleep session target over generic waitTicks for sleeping wait toils', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 7 });
    const pawn = createPawn({
      name: 'Sleeper',
      cell: { x: 4, y: 4 },
      mapId: 'main',
      factionId: 'player',
      rng: world.rng,
    });

    pawn.ai.currentJob = {
      id: 'job_sleep_test',
      defId: 'job_sleep',
      pawnId: pawn.id,
      toils: [
        {
          type: ToilType.Wait,
          state: ToilState.InProgress,
          localData: {
            sleeping: true,
            waited: 120,
            waitTicks: 60,
            sleepSessionTargetTicks: 800,
          },
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Active,
    };

    const renderer = new PawnRenderer({} as any, new Map());
    const progress = (renderer as any).getToilProgress(pawn);

    expect(progress).toEqual({ current: 120, total: 800 });
  });
});
