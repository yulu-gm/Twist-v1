import { describe, expect, it } from 'vitest';
import '../construction/occupancy.test.mock';
import { ObjectKind } from '../../core/types';
import { cleanupProtocol } from './cleanup';
import { createConstructJob } from './jobs/construct-job';
import { jobSelectionSystem } from './job-selector';
import {
  createAdditionalPawn,
  createBlueprint,
  createConstructionSite,
  createConstructionTestWorld,
} from '../construction/construction.test-utils';

describe('construction job selection', () => {
  it('assigns a construction job for a fully delivered blueprint and includes a prepare step', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      materialsDelivered: [{ defId: 'wood', count: 5 }],
    });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_construct');
    expect(pawn.ai.currentJob?.targetId).toBe(blueprint.id);
    expect(pawn.ai.currentJob?.toils.some(toil => toil.type === 'prepare_construction')).toBe(true);
  });

  it('does not assign construction jobs for occupied blueprints or occupied sites', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      id: 'bp_occ',
      cell: { x: 6, y: 6 },
      materialsDelivered: [{ defId: 'wood', count: 5 }],
    });
    const site = createConstructionSite(map, {
      id: 'site_occ',
      cell: { x: 9, y: 6 },
      targetDefId: 'table',
      footprint: { width: 2, height: 1 },
      totalWorkAmount: 80,
      workDone: 10,
      buildProgress: 0.125,
    });

    pawn.tags.add('physical_occupant');
    pawn.cell = { x: 6, y: 6 };
    map.spatial.onObjectMoved(pawn.id, { x: 2, y: 2 }, pawn.cell, pawn.footprint);

    const blocker = createAdditionalPawn(world, map, 'Bob', { x: 10, y: 6 });
    blocker.tags.add('physical_occupant');

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob).toBeNull();
    expect(map.objects.getAs(blueprint.id, ObjectKind.Blueprint)).toBeDefined();
    expect(map.objects.getAs(site.id, ObjectKind.ConstructionSite)).toBeDefined();
  });

  it('preserves site progress across interruption and allows later re-claim when unoccupied', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const otherPawn = createAdditionalPawn(world, map, 'Bob', { x: 1, y: 2 });
    const site = createConstructionSite(map, {
      targetDefId: 'wall_wood',
      totalWorkAmount: 100,
      workDone: 55,
      buildProgress: 0.55,
    });

    jobSelectionSystem.execute(world);
    expect(pawn.ai.currentJob?.defId).toBe('job_construct');

    cleanupProtocol(pawn, map, world, 'test_interrupt');

    expect(site.workDone).toBe(55);
    expect(site.buildProgress).toBeCloseTo(0.55);

    jobSelectionSystem.execute(world);

    const assignee = pawn.ai.currentJob?.defId === 'job_construct' ? pawn : otherPawn;
    expect(assignee.ai.currentJob?.defId).toBe('job_construct');
    const workToil = assignee.ai.currentJob?.toils.find(toil => toil.type === 'work');
    expect(workToil?.localData.totalWork).toBe(45);
  });

  it('builds a prepare-construction toil when the job factory targets a blueprint', () => {
    const { map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      materialsDelivered: [{ defId: 'wood', count: 5 }],
    });

    const job = (createConstructJob as (...args: unknown[]) => { toils: Array<{ type: string }> })(
      pawn.id,
      blueprint.id,
      blueprint.cell,
      map,
      { requiresPrepare: true },
    );

    expect(job.toils.map(toil => toil.type)).toContain('prepare_construction');
  });
});
