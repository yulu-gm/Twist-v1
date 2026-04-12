/**
 * @file construction.placement.test.ts
 * @description 建造放置判定单元测试 — 验证 analyzeBuildingPlacement 在各对象类型下的阻挡逻辑
 * @part-of 建造系统（construction）
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from '../building/building.factory';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createBlueprint, createConstructionSite } from './construction.test-utils';
import { analyzeBuildingPlacement } from './construction.placement';
import type { GameMap } from '../../world/game-map';

/** 创建测试用地图与上下文（独立于 createConstructionTestWorld，避免预置 pawn 干扰） */
function createPlacementTestContext() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 99999 });
  const map = createGameMap({ id: 'placement_test', width: 16, height: 16 });
  world.maps.set(map.id, map);
  return { defs, world, map };
}

describe('analyzeBuildingPlacement', () => {
  let map: GameMap;
  let defs: ReturnType<typeof buildDefDatabase>;
  let world: ReturnType<typeof createWorld>;

  beforeEach(() => {
    ({ defs, world, map } = createPlacementTestContext());
  });

  // ── 单格阻挡对象测试 ──

  it('蓝图阻止放置（blocked=true，reason 正确）', () => {
    // 在目标格放置一个蓝图，分析该格的放置结果
    const bp = createBlueprint(map, { cell: { x: 5, y: 5 } });

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 1, height: 1 });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('occupied_by_construction_or_building');
    expect(result.blockingObjects.map(o => o.id)).toContain(bp.id);
  });

  it('建造工地阻止放置（blocked=true，reason 正确）', () => {
    // 在目标格放置一个工地，分析该格的放置结果
    const site = createConstructionSite(map, { cell: { x: 5, y: 5 } });

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 1, height: 1 });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('occupied_by_construction_or_building');
    expect(result.blockingObjects.map(o => o.id)).toContain(site.id);
  });

  it('建筑阻止放置（blocked=true，reason 正确）', () => {
    // 在目标格创建并添加一个真实建筑，分析该格的放置结果
    const building = createBuilding({ defId: 'wall_wood', cell: { x: 5, y: 5 }, mapId: map.id, defs });
    map.objects.add(building);

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 1, height: 1 });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('occupied_by_construction_or_building');
    expect(result.blockingObjects.map(o => o.id)).toContain(building.id);
  });

  // ── 非阻挡对象测试 ──

  it('小人不阻止放置（blocked=false）', () => {
    // Pawn 在目标格，不应构成放置冲突
    const pawn = createPawn({
      name: 'Bob',
      cell: { x: 5, y: 5 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 1, height: 1 });

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.blockingObjects).toHaveLength(0);
  });

  it('物品不阻止放置（blocked=false）', () => {
    // Item 在目标格，不应构成放置冲突
    const item = createItem({ defId: 'wood', cell: { x: 5, y: 5 }, mapId: map.id, stackCount: 10, defs });
    map.objects.add(item);

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 1, height: 1 });

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.blockingObjects).toHaveLength(0);
  });

  // ── 多格 footprint 测试 ──

  it('多格 footprint 任一格命中阻挡对象时整体 blocked，并返回冲突对象', () => {
    // 2×1 footprint，左格(5,5)空，右格(6,5)有蓝图
    const bp = createBlueprint(map, { id: 'bp_multi', cell: { x: 6, y: 5 } });

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 2, height: 1 });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('occupied_by_construction_or_building');
    expect(result.blockingObjects.map(o => o.id)).toContain(bp.id);
  });

  it('多格 footprint 所有格均无阻挡对象时 blocked=false', () => {
    // 2×2 footprint，区域内无任何阻挡对象
    const result = analyzeBuildingPlacement(map, { x: 8, y: 8 }, { width: 2, height: 2 });

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.blockingObjects).toHaveLength(0);
  });
});
