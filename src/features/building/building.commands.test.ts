/**
 * @file building.commands.test.ts
 * @description 建筑命令处理器的单元测试 — 床位所有权指派与清除
 * @dependencies building.commands, building.factory, pawn.factory, world, game-map, defs
 * @part-of 建筑系统（building）
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createBuilding } from './building.factory';
import {
  assignBedOwnerHandler,
  clearBedOwnerHandler,
} from './building.commands';

/** 创建标准测试世界，包含一个地图 */
function createTestWorld() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'main', width: 12, height: 12 });
  world.maps.set(map.id, map);
  return { defs, world, map };
}

describe('assignBedOwnerHandler', () => {
  it('moves ownership from the old bed to the new bed', () => {
    const { defs, world, map } = createTestWorld();

    // 创建棋子 Alice
    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    // 创建旧床（已分配给 Alice）和新床（空闲）
    const oldBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      defs,
    });
    oldBed.bed!.ownerPawnId = 'Alice';
    map.objects.add(oldBed);

    const newBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 6, y: 2 },
      mapId: map.id,
      defs,
    });
    map.objects.add(newBed);

    // 验证命令合法
    const validation = assignBedOwnerHandler.validate(world, {
      type: 'assign_bed_owner',
      payload: { bedId: newBed.id, pawnId: pawn.id },
    });
    expect(validation).toEqual({ valid: true });

    // 执行指派命令
    const result = assignBedOwnerHandler.execute(world, {
      type: 'assign_bed_owner',
      payload: { bedId: newBed.id, pawnId: pawn.id },
    });

    // 旧床所有权被清除，新床归 Alice 所有
    expect(oldBed.bed!.ownerPawnId).toBeUndefined();
    expect(newBed.bed!.ownerPawnId).toBe('Alice');

    // 返回 bed_owner_assigned 事件
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('bed_owner_assigned');
    expect(result.events[0].data).toMatchObject({
      bedId: newBed.id,
      pawnId: pawn.id,
      pawnName: 'Alice',
    });
  });

  it('rejects when bed not found', () => {
    const { world } = createTestWorld();

    const result = assignBedOwnerHandler.validate(world, {
      type: 'assign_bed_owner',
      payload: { bedId: 'nonexistent_bed', pawnId: 'some_pawn' },
    });

    expect(result).toEqual({ valid: false, reason: expect.stringContaining('not found') });
  });

  it('rejects when pawn not found', () => {
    const { defs, world, map } = createTestWorld();

    // 创建一张床，但不创建棋子
    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      defs,
    });
    map.objects.add(bed);

    const result = assignBedOwnerHandler.validate(world, {
      type: 'assign_bed_owner',
      payload: { bedId: bed.id, pawnId: 'nonexistent_pawn' },
    });

    expect(result).toEqual({ valid: false, reason: expect.stringContaining('not found') });
  });
});

describe('clearBedOwnerHandler', () => {
  it('clears only the owner field, preserving occupant', () => {
    const { defs, world, map } = createTestWorld();

    // 创建一张有主且有人占用的床
    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      defs,
    });
    bed.bed!.ownerPawnId = 'Alice';
    bed.bed!.occupantPawnId = 'pawn_sleeping';
    map.objects.add(bed);

    // 验证命令合法
    const validation = clearBedOwnerHandler.validate(world, {
      type: 'clear_bed_owner',
      payload: { bedId: bed.id },
    });
    expect(validation).toEqual({ valid: true });

    // 执行清除命令
    const result = clearBedOwnerHandler.execute(world, {
      type: 'clear_bed_owner',
      payload: { bedId: bed.id },
    });

    // 所有权被清除，占用者不受影响
    expect(bed.bed!.ownerPawnId).toBeUndefined();
    expect(bed.bed!.occupantPawnId).toBe('pawn_sleeping');

    // 返回 bed_owner_cleared 事件
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('bed_owner_cleared');
    expect(result.events[0].data).toMatchObject({ bedId: bed.id });
  });
});
