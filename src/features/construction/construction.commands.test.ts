import { describe, expect, it } from 'vitest';
import { ObjectKind, JobState } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createBuilding } from '../building/building.factory';
import { createHaulJob } from '../ai/jobs/haul-job';
import { cancelConstructionHandler, placeBlueprintHandler } from './construction.commands';
import { createBlueprint, createConstructionSite } from './construction.test-utils';

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

describe('cancelConstructionHandler', () => {
  it('cleans up pawns targeting a cancelled construction object through cleanup', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const blueprint = {
      id: 'bp_1',
      kind: ObjectKind.Blueprint,
      defId: 'blueprint_test',
      mapId: map.id,
      cell: { x: 6, y: 6 },
      footprint: { width: 1, height: 1 },
      tags: new Set(['blueprint', 'construction']),
      destroyed: false,
      targetDefId: 'test_building',
      rotation: 0,
      materialsRequired: [],
      materialsDelivered: [],
    };
    map.objects.add(blueprint as never);

    pawn.inventory.carrying = { defId: 'wood', count: 4 };

    const job = {
      id: 'job_construct_1',
      defId: 'job_construct',
      pawnId: pawn.id,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      toils: [],
      currentToilIndex: 0,
      reservations: [map.reservations.tryReserve({
        claimantId: pawn.id,
        targetId: blueprint.id,
        jobId: 'job_construct_1',
        currentTick: world.tick,
      }) as string],
      state: JobState.Active,
    };
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = 0;
    pawn.ai.toilState = { working: true };

    const result = cancelConstructionHandler.execute(world, {
      type: 'cancel_construction',
      payload: { targetId: blueprint.id },
    });

    expect(result.events.some(event => event.type === 'construction_cancelled')).toBe(true);
    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.inventory.carrying).toBeNull();
    expect(map.reservations.isReserved(blueprint.id)).toBe(false);
  });

  it('cleans up haul jobs that are delivering to the cancelled blueprint', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const blueprint = {
      id: 'bp_haul_1',
      kind: ObjectKind.Blueprint,
      defId: 'blueprint_test',
      mapId: map.id,
      cell: { x: 6, y: 6 },
      footprint: { width: 1, height: 1 },
      tags: new Set(['blueprint', 'construction']),
      destroyed: false,
      targetDefId: 'test_building',
      rotation: 0,
      materialsRequired: [{ defId: 'wood', count: 10 }],
      materialsDelivered: [{ defId: 'wood', count: 0 }],
    };
    map.objects.add(blueprint as never);

    const item = createItem({
      defId: 'wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      stackCount: 15,
      defs,
    });
    map.objects.add(item);

    const job = createHaulJob(pawn.id, item.id, item.cell, blueprint.cell, 5, blueprint.id);
    const resId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: item.id,
      jobId: job.id,
      currentTick: world.tick,
    });
    expect(resId).not.toBeNull();

    job.reservations.push(resId as string);
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = 2;
    pawn.ai.toilState = { working: true };
    pawn.inventory.carrying = { defId: 'wood', count: 5 };

    const result = cancelConstructionHandler.execute(world, {
      type: 'cancel_construction',
      payload: { targetId: blueprint.id },
    });

    expect(result.events.some(event => event.type === 'construction_cancelled')).toBe(true);
    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.inventory.carrying).toBeNull();
    expect(map.reservations.isReserved(item.id)).toBe(false);
  });
});

// ── 放置蓝图占地冲突验证 ──

describe('placeBlueprintHandler — 占地冲突验证', () => {
  function createPlacementTestWorld() {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 99999 });
    // 使用 16x16 地图，为多格 footprint 测试提供足够空间
    const map = createGameMap({ id: 'main', width: 16, height: 16 });
    world.maps.set(map.id, map);
    return { defs, world, map };
  }

  it('已有蓝图时拒绝在同格放置', () => {
    const { world, map } = createPlacementTestWorld();
    // 在 (4,4) 放置一个蓝图占位
    createBlueprint(map, { id: 'bp_existing', cell: { x: 4, y: 4 } });

    const result = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 4, y: 4 } },
    });

    expect(result.valid).toBe(false);
    expect((result as { valid: false; reason: string }).reason).toContain('Footprint occupied');
  });

  it('已有施工工地时拒绝在同格放置', () => {
    const { world, map } = createPlacementTestWorld();
    // 在 (5,5) 放置一个施工工地
    createConstructionSite(map, { id: 'site_existing', cell: { x: 5, y: 5 } });

    const result = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 5, y: 5 } },
    });

    expect(result.valid).toBe(false);
    expect((result as { valid: false; reason: string }).reason).toContain('Footprint occupied');
  });

  it('已有建筑时拒绝放置，但格子上只有棋子或物品时允许放置', () => {
    const { defs, world, map } = createPlacementTestWorld();

    // 在 (3,3) 放置一个建筑 → 应被拒绝
    const building = createBuilding({ defId: 'wall_wood', cell: { x: 3, y: 3 }, mapId: map.id, defs });
    map.objects.add(building);

    const resultBlocked = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 3, y: 3 } },
    });
    expect(resultBlocked.valid).toBe(false);
    expect((resultBlocked as { valid: false; reason: string }).reason).toContain('Footprint occupied');

    // 在 (7,7) 只有棋子 → 应允许放置
    const pawn = createPawn({ name: 'Bob', cell: { x: 7, y: 7 }, mapId: map.id, factionId: 'player', rng: world.rng });
    map.objects.add(pawn);

    const resultPawn = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 7, y: 7 } },
    });
    expect(resultPawn.valid).toBe(true);

    // 在 (8,8) 只有物品 → 应允许放置
    const item = createItem({ defId: 'wood', cell: { x: 8, y: 8 }, mapId: map.id, stackCount: 5, defs });
    map.objects.add(item);

    const resultItem = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 8, y: 8 } },
    });
    expect(resultItem.valid).toBe(true);
  });

  it('多格 footprint：床位蓝图在 (9,9) 时，在 (9,10) 的占位导致 (9,9) 处的放置被拒绝', () => {
    const { world, map } = createPlacementTestWorld();
    // bed_wood 尺寸为 1x2，放置于 (9,9) 时 footprint 覆盖 (9,9) 和 (9,10)
    // 在 (9,10) 预先放置一个蓝图，使 footprint 重叠
    createBlueprint(map, { id: 'bp_overlap', cell: { x: 9, y: 10 } });

    const result = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'bed_wood', cell: { x: 9, y: 9 } },
    });

    // footprint 覆盖 (9,10) 时命中已有蓝图，整体应被拒绝
    expect(result.valid).toBe(false);
    expect((result as { valid: false; reason: string }).reason).toContain('Footprint occupied');
  });
});
