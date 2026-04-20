import { describe, expect, it } from 'vitest';
import '../construction/occupancy.test.mock';
import { ToilState, ToilType, JobState } from '../../core/types';
import { createConstructionTestWorld, createBlueprint } from '../construction/construction.test-utils';
import { executeDeliver } from './toil-handlers/deliver.handler';
import { executeTakeFromStorage } from './toil-handlers/take-from-storage.handler';
import { createBuilding } from '../building/building.factory';
import { createTakeFromStorageToBlueprintJob } from './jobs/storage-job';

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

  it('delivers material after taking it from warehouse inventory', () => {
    const { world, map, pawn, defs } = createConstructionTestWorld();

    const warehouse = createBuilding({
      defId: 'warehouse_shed',
      cell: { x: 12, y: 8 },
      mapId: map.id,
      defs,
    });
    warehouse.storage!.inventory = { wood: 20 };
    warehouse.storage!.storedCount = 20;
    map.objects.add(warehouse);

    const blueprint = createBlueprint(map, {
      cell: { x: 14, y: 10 },
      materialsRequired: [{ defId: 'wood', count: 5 }],
      materialsDelivered: [{ defId: 'wood', count: 0 }],
    });

    const warehouseApproach = warehouse.interaction!.interactionCell;
    const blueprintApproach = { x: blueprint.cell.x - 1, y: blueprint.cell.y };

    const job = createTakeFromStorageToBlueprintJob(
      pawn.id,
      warehouse.id,
      warehouseApproach,
      'wood',
      5,
      blueprint.id,
      blueprintApproach,
    );

    // 第一步：让 pawn 站在仓库交互格上，跑 TakeFromStorage
    pawn.cell = { ...warehouseApproach };
    job.currentToilIndex = 1;
    const takeToil = job.toils[1];
    takeToil.state = ToilState.InProgress;
    executeTakeFromStorage({ pawn, toil: takeToil, job, map, world });

    expect(takeToil.state).toBe(ToilState.Completed);
    expect(warehouse.storage!.inventory.wood).toBe(15);
    expect(warehouse.storage!.storedCount).toBe(15);
    expect(pawn.inventory.carrying).toEqual({ defId: 'wood', count: 5 });

    // 第二步：跳到 Deliver toil，让 pawn 站在蓝图相邻格交付材料
    pawn.cell = { ...blueprintApproach };
    job.currentToilIndex = 3;
    const deliverToil = job.toils[3];
    deliverToil.state = ToilState.InProgress;
    executeDeliver({ pawn, toil: deliverToil, job, map, world });

    expect(deliverToil.state).toBe(ToilState.Completed);
    const delivered = map.objects.get(blueprint.id) as typeof blueprint | undefined;
    // 材料完整交付后蓝图被升级为工地，所以原 blueprint 已被移除
    if (delivered) {
      expect(delivered.materialsDelivered.find(entry => entry.defId === 'wood')?.count).toBe(5);
    }
    expect(pawn.inventory.carrying).toBeNull();
  });
});
