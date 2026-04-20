/**
 * @file job-selector.reachability.test.ts
 * @description 验证 selector 在仓库目标存在/被阻挡时的可达性筛选
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from '../building/building.factory';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { jobSelectionSystem } from './job-selector';

/** 在指定格子上添加仓库建筑（占地 2x2） */
function addWarehouse(
  map: ReturnType<typeof createGameMap>,
  defs: ReturnType<typeof buildDefDatabase>,
  cell: { x: number; y: number },
) {
  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell,
    mapId: map.id,
    defs,
  });
  map.objects.add(warehouse);
  return warehouse;
}

describe('job selector reachability', () => {
  it('uses the pawn hunger seek threshold from the needs profile', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 40;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    const item = createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 2,
      defs,
    });
    map.objects.add(item);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_eat');
    expect(pawn.ai.currentJob?.targetId).toBe(item.id);
  });

  it('does not assign haul jobs for unreachable items', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    const item = createItem({
      defId: 'wood',
      cell: { x: 4, y: 4 },
      mapId: map.id,
      stackCount: 10,
      defs,
    });
    map.objects.add(item);

    for (const cell of [
      { x: 4, y: 3 },
      { x: 4, y: 5 },
      { x: 3, y: 4 },
      { x: 5, y: 4 },
    ]) {
      map.objects.add(createBuilding({
        defId: 'wall_wood',
        cell,
        mapId: map.id,
        defs,
      }));
    }

    addWarehouse(map, defs, { x: 8, y: 1 });
    map.pathGrid.rebuildFrom(map, defs);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob).toBeNull();
  });

  it('assigns store-in-storage jobs to a reachable warehouse when the nearest one is unreachable', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    const item = createItem({
      defId: 'wood',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 10,
      defs,
    });
    map.objects.add(item);

    // 近仓库被墙完全围住——其交互格不可达
    const nearWarehouse = addWarehouse(map, defs, { x: 4, y: 3 });
    // 远仓库无障碍可达
    const farWarehouse = addWarehouse(map, defs, { x: 9, y: 1 });

    const nearApproach = nearWarehouse.interaction!.interactionCell;
    for (const cell of [
      { x: nearApproach.x - 1, y: nearApproach.y },
      { x: nearApproach.x + 1, y: nearApproach.y },
      { x: nearApproach.x, y: nearApproach.y - 1 },
      { x: nearApproach.x, y: nearApproach.y + 1 },
    ]) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) continue;
      map.objects.add(createBuilding({
        defId: 'wall_wood',
        cell,
        mapId: map.id,
        defs,
      }));
    }

    map.pathGrid.rebuildFrom(map, defs);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_store_in_storage');
    // 入库 Job 的第 4 个 toil（StoreInStorage）目标即仓库交互格
    const storeToil = pawn.ai.currentJob?.toils[3];
    expect(storeToil?.targetCell).toEqual(farWarehouse.interaction!.interactionCell);
  });
});
