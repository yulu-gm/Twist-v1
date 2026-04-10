import { describe, expect, it } from 'vitest';
import '../construction/occupancy.test.mock';
import { JobState, ToilState, ToilType } from '../../core/types';
import { toilExecutorSystem } from './toil-executor';
import { executeWork } from './toil-handlers/work.handler';
import { createBlueprint, createConstructionSite, createConstructionTestWorld } from '../construction/construction.test-utils';

describe('construction toil execution', () => {
  it('interrupts non-eat jobs when food is below the pawn critical hunger threshold', () => {
    const { world, map, pawn } = createConstructionTestWorld();

    pawn.needs.food = 15;
    pawn.needsProfile.hungerCriticalThreshold = 20;
    pawn.ai.currentJob = {
      id: 'job_construct_low_food',
      defId: 'job_construct',
      pawnId: pawn.id,
      targetCell: { x: 6, y: 6 },
      toils: [
        {
          type: ToilType.GoTo,
          targetCell: { x: 6, y: 6 },
          state: ToilState.NotStarted,
          localData: {},
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Active,
    };

    toilExecutorSystem.execute(world);

    expect(pawn.ai.currentJob).toBeNull();
    expect(map.reservations.getAll()).toHaveLength(0);
  });

  it('allows a constructor-side prepare toil to promote a ready blueprint before work starts', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      materialsDelivered: [{ defId: 'wood', count: 5 }],
    });

    pawn.ai.currentJob = {
      id: 'job_construct_prepare',
      defId: 'job_construct',
      pawnId: pawn.id,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      toils: [
        {
          type: 'prepare_construction' as ToilType,
          targetId: blueprint.id,
          targetCell: blueprint.cell,
          state: ToilState.NotStarted,
          localData: {},
        },
        {
          type: ToilType.Work,
          targetId: blueprint.id,
          targetCell: blueprint.cell,
          state: ToilState.NotStarted,
          localData: { workDone: 0, totalWork: 100 },
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Active,
    };

    toilExecutorSystem.execute(world);

    expect(map.objects.get(blueprint.id)).toBeUndefined();
    expect(map.objects.allOfKind('construction_site' as never)).toHaveLength(1);
    expect(pawn.ai.currentJob?.toils[1]?.targetId).not.toBe(blueprint.id);
  });

  it('does not advance construction-site work while the footprint is physically occupied', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const site = createConstructionSite(map, {
      workDone: 10,
      totalWorkAmount: 100,
      buildProgress: 0.1,
    });

    pawn.tags.add('physical_occupant');
    pawn.cell = { x: 6, y: 6 };
    map.spatial.onObjectMoved(pawn.id, { x: 2, y: 2 }, pawn.cell, pawn.footprint);

    const toil = {
      type: ToilType.Work,
      targetId: site.id,
      targetCell: site.cell,
      state: ToilState.InProgress,
      localData: { workDone: 0, totalWork: 90 },
    };

    executeWork({
      pawn,
      toil,
      job: {
        id: 'job_construct_occupied',
        defId: 'job_construct',
        pawnId: pawn.id,
        targetId: site.id,
        targetCell: site.cell,
        toils: [toil],
        currentToilIndex: 0,
        reservations: [],
        state: JobState.Active,
      },
      map,
      world,
    });

    expect(site.workDone).toBe(10);
    expect(site.buildProgress).toBeCloseTo(0.1);
    expect(toil.localData.workDone).toBe(0);
    expect(toil.state).toBe(ToilState.InProgress);
  });
});
