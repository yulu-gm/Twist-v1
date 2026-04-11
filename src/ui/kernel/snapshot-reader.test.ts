/**
 * @file snapshot-reader.test.ts
 * @description 引擎快照读取器测试 — 验证 pawn workDecision 投影到 colonist snapshot
 * @part-of ui/kernel — UI 内核层
 */

import { describe, expect, it } from 'vitest';
import { ToilState } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../../features/pawn/pawn.factory';
import { createPresentationState } from '../../presentation/presentation-state';
import { readEngineSnapshot } from './snapshot-reader';

describe('readEngineSnapshot work decision projection', () => {
  it('projects pawn workDecision into colonist snapshot data', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 8, height: 8 });
    const presentation = createPresentationState();
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.ai.workDecision = {
      evaluatedAtTick: 12,
      selectedWorkKind: 'eat',
      selectedWorkLabel: 'Eat',
      selectedJobId: 'job_eat_1',
      activeToilLabel: 'pickup',
      activeToilState: ToilState.NotStarted,
      options: [
        {
          kind: 'eat',
          label: 'Eat',
          status: 'active',
          priority: 100,
          score: 120,
          failureReasonCode: 'none',
          failureReasonText: null,
          detail: 'meal_simple',
          jobDefId: 'job_eat',
          evaluatedAtTick: 12,
        },
        {
          kind: 'haul_to_stockpile',
          label: 'Haul To Stockpile',
          status: 'deferred',
          priority: 15,
          score: 10,
          failureReasonCode: 'none',
          failureReasonText: null,
          detail: 'wood',
          jobDefId: 'job_haul',
          evaluatedAtTick: 12,
        },
      ],
    };
    map.objects.add(pawn);

    const snapshot = readEngineSnapshot(world, map, presentation, { recentEvents: [] });
    const colonist = snapshot.colonists[pawn.id];

    expect(colonist.workDecision).not.toBeNull();
    expect(colonist.workDecision!.selectedWorkKind).toBe('eat');
    expect(colonist.workDecision!.activeToilLabel).toBe('pickup');
    expect(colonist.workDecision!.options).toHaveLength(2);
    expect(colonist.workDecision!.options[0]).toMatchObject({
      kind: 'eat',
      status: 'active',
      detail: 'meal_simple',
    });
    expect(colonist.workDecision!.options[1]).toMatchObject({
      kind: 'haul_to_stockpile',
      status: 'deferred',
    });
  });

  it('returns null workDecision when pawn has no decision snapshot', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 8, height: 8 });
    const presentation = createPresentationState();
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Bob',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    const snapshot = readEngineSnapshot(world, map, presentation, { recentEvents: [] });
    expect(snapshot.colonists[pawn.id].workDecision).toBeNull();
  });
});
