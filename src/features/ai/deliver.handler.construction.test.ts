import { describe, expect, it } from 'vitest';
import '../construction/occupancy.test.mock';
import { ToilState, ToilType, JobState } from '../../core/types';
import { createConstructionTestWorld, createBlueprint } from '../construction/construction.test-utils';
import { executeDeliver } from './toil-handlers/deliver.handler';

describe('executeDeliver construction integration', () => {
  it('promotes a blueprint to a construction site when the final delivery arrives', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      cell: { x: 2, y: 2 },
      materialsRequired: [{ defId: 'wood', count: 5 }],
      materialsDelivered: [{ defId: 'wood', count: 4 }],
    });

    pawn.cell = { x: 2, y: 2 };
    pawn.inventory.carrying = { defId: 'wood', count: 1 };

    const toil = {
      type: ToilType.Deliver,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      state: ToilState.InProgress,
      localData: { count: 1 },
    };
    const job = {
      id: 'job_deliver_1',
      defId: 'job_deliver_materials',
      pawnId: pawn.id,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      toils: [toil],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Active,
    };

    executeDeliver({ pawn, toil, job, map, world });

    expect(toil.state).toBe(ToilState.Completed);
    expect(map.objects.get(blueprint.id)).toBeUndefined();
    expect(map.objects.allOfKind('construction_site' as never)).toHaveLength(1);
  });

  it('keeps excess carried materials after partially fulfilling the final missing blueprint amount', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      cell: { x: 2, y: 2 },
      materialsRequired: [{ defId: 'wood', count: 5 }],
      materialsDelivered: [{ defId: 'wood', count: 4 }],
    });

    pawn.cell = { x: 2, y: 2 };
    pawn.inventory.carrying = { defId: 'wood', count: 3 };

    const toil = {
      type: ToilType.Deliver,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      state: ToilState.InProgress,
      localData: { count: 3 },
    };
    const job = {
      id: 'job_deliver_2',
      defId: 'job_deliver_materials',
      pawnId: pawn.id,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      toils: [toil],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Active,
    };

    executeDeliver({ pawn, toil, job, map, world });

    expect(toil.state).toBe(ToilState.Completed);
    expect(map.objects.get(blueprint.id)).toBeUndefined();
    expect(map.objects.allOfKind('construction_site' as never)).toHaveLength(1);
    expect(pawn.inventory.carrying).toEqual({ defId: 'wood', count: 2 });
    expect(map.objects.allOfKind('item' as never)).toHaveLength(0);
  });

  it('allows final delivery from a footprint-adjacent cell for multi-tile beds', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      cell: { x: 6, y: 6 },
      targetDefId: 'bed_wood',
      footprint: { width: 1, height: 2 },
      materialsRequired: [{ defId: 'wood', count: 8 }],
      materialsDelivered: [{ defId: 'wood', count: 7 }],
    });

    pawn.cell = { x: 5, y: 6 };
    pawn.inventory.carrying = { defId: 'wood', count: 1 };

    const toil = {
      type: ToilType.Deliver,
      targetId: blueprint.id,
      targetCell: { x: 5, y: 6 },
      state: ToilState.InProgress,
      localData: { count: 1 },
    };
    const job = {
      id: 'job_deliver_bed_adjacent',
      defId: 'job_deliver_materials',
      pawnId: pawn.id,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      toils: [toil],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Active,
    };

    executeDeliver({ pawn, toil, job, map, world });

    expect(toil.state).toBe(ToilState.Completed);
    expect(map.objects.get(blueprint.id)).toBeUndefined();
    expect(map.objects.allOfKind('construction_site' as never)).toHaveLength(1);
  });
});
