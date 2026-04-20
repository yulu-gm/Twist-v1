import { describe, expect, it } from 'vitest';
import { ObjectKind, ToilState, JobState } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createBuilding } from '../building/building.factory';
import { createHaulJob } from './jobs/haul-job';
import { advanceToil } from './job-lifecycle';
import { jobSelectionSystem } from './job-selector';

function createTestWorld() {
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

  return { defs, world, map, pawn };
}

function makeBlueprint(map: ReturnType<typeof createGameMap>, itemDefId: string) {
  const blueprint = {
    id: 'bp_1',
    kind: ObjectKind.Blueprint,
    defId: 'blueprint_test',
    mapId: map.id,
    cell: { x: 8, y: 8 },
    footprint: { width: 1, height: 1 },
    tags: new Set(['blueprint', 'construction']),
    destroyed: false,
    targetDefId: 'test_building',
    rotation: 0,
    materialsRequired: [{ defId: itemDefId, count: 10 }],
    materialsDelivered: [{ defId: itemDefId, count: 5 }],
  };

  map.objects.add(blueprint as never);
  // 把蓝图挂到一个 build 工作订单上，evaluator 才会把它当作有效的运送材料目标
  const order = map.workOrders.createMapOrder({
    orderKind: 'build',
    title: '测试蓝图订单',
    items: [{ targetRef: { kind: 'cell', cell: blueprint.cell, defId: blueprint.targetDefId }, artifactId: blueprint.id }],
    createdAtTick: 0,
  });
  (blueprint as any).workOrderId = order.id;
  (blueprint as any).workOrderItemId = order.items[0].id;
  return blueprint;
}

function addWarehouseAt(
  map: ReturnType<typeof createGameMap>,
  defs: ReturnType<typeof buildDefDatabase>,
  coord: { x: number; y: number },
  itemDefId: string,
  stock: number,
) {
  const warehouse = createBuilding({ defId: 'warehouse_shed', cell: coord, mapId: map.id, defs });
  map.objects.add(warehouse);
  if (warehouse.storage) {
    warehouse.storage.inventory[itemDefId] = stock;
    warehouse.storage.storedCount = stock;
  }
  return warehouse;
}

describe('reservation lifecycle', () => {
  it('releases haul reservations when the final toil completes', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const item = createItem({ defId: 'wood', cell: { x: 4, y: 2 }, mapId: map.id, stackCount: 15, defs });
    map.objects.add(item);

    const job = createHaulJob(pawn.id, item.id, item.cell, { x: 8, y: 8 }, 5, 'bp_1');
    const resId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: item.id,
      jobId: job.id,
      currentTick: world.tick,
    });
    expect(resId).not.toBeNull();
    job.reservations.push(resId as string);
    job.currentToilIndex = job.toils.length - 1;
    job.toils[job.currentToilIndex].state = ToilState.Completed;
    job.state = JobState.Active;
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = job.currentToilIndex;

    advanceToil(pawn, job, map, world);

    expect(map.reservations.isReserved(item.id)).toBe(false);
    expect(pawn.ai.currentJob).toBeNull();
    expect(job.state).toBe(JobState.Done);
  });

  it('allows the same stack to be selected again after the reservation is released', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const item = createItem({ defId: 'wood', cell: { x: 4, y: 2 }, mapId: map.id, stackCount: 15, defs });
    map.objects.add(item);
    const blueprint = makeBlueprint(map, item.defId);
    // 仓库储备充足材料，使 deliver evaluator 能够选中蓝图并发起 take_from_storage Job
    addWarehouseAt(map, defs, { x: 5, y: 5 }, item.defId, 10);

    const job = createHaulJob(pawn.id, item.id, item.cell, { x: 8, y: 8 }, 5, 'bp_1');
    const resId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: item.id,
      jobId: job.id,
      currentTick: world.tick,
    });
    expect(resId).not.toBeNull();
    job.reservations.push(resId as string);
    job.currentToilIndex = job.toils.length - 1;
    job.toils[job.currentToilIndex].state = ToilState.Completed;
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = job.currentToilIndex;

    advanceToil(pawn, job, map, world);

    expect(map.reservations.isReserved(item.id)).toBe(false);

    jobSelectionSystem.execute(world);

    // stockpile 已下线 — pawn 现在应被分配从仓库取材送往蓝图的 take_from_storage Job
    expect(pawn.ai.currentJob).not.toBeNull();
    expect(pawn.ai.currentJob?.defId).toBe('job_take_from_storage');
    void blueprint;
  });

});
