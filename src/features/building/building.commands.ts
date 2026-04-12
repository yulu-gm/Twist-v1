/**
 * @file building.commands.ts
 * @description 建筑相关的命令处理器 — 床位所有权指派与清除
 * @dependencies core/types, core/command-bus, building.types
 * @part-of 建筑系统（building）
 */

import { ObjectKind } from '../../core/types';
import type { Command, CommandHandler, ValidationResult, ExecutionResult } from '../../core/command-bus';
import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import type { Building } from './building.types';
import type { Pawn } from '../pawn/pawn.types';

// ── 辅助函数 ──

/**
 * 在所有地图中查找指定ID的床位建筑
 * @param world - 世界对象
 * @param bedId - 建筑ID
 * @returns 找到的带 bed 组件的建筑，未找到则返回 undefined
 */
function findBed(world: World, bedId: string): Building | undefined {
  for (const [, map] of world.maps) {
    const building = map.objects.getAs(bedId, ObjectKind.Building);
    if (building?.bed) return building;
  }
  return undefined;
}

/**
 * 在所有地图中查找指定ID的棋子
 * @param world - 世界对象
 * @param pawnId - 棋子ID
 * @returns 找到的棋子对象，未找到则返回 undefined
 */
function findPawn(world: World, pawnId: string): Pawn | undefined {
  for (const [, map] of world.maps) {
    const pawn = map.objects.getAs(pawnId, ObjectKind.Pawn);
    if (pawn) return pawn;
  }
  return undefined;
}

// ── assign_bed_owner（指派床位所有者命令） ──

/**
 * 指派床位所有者命令处理器
 * 将指定床位分配给棋子，同时清除该棋子在其他床位上的所有权（一人一床规则）
 */
export const assignBedOwnerHandler: CommandHandler = {
  type: 'assign_bed_owner',

  /** 验证：检查床位和棋子是否存在 */
  validate(world: World, cmd: Command): ValidationResult {
    const bedId = cmd.payload.bedId as string | undefined;
    const pawnId = cmd.payload.pawnId as string | undefined;

    if (!bedId) return { valid: false, reason: 'Missing bedId' };
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };

    const bed = findBed(world, bedId);
    if (!bed) return { valid: false, reason: `Bed ${bedId} not found` };

    const pawn = findPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };

    return { valid: true };
  },

  /** 执行：清除棋子在其他床位的所有权，将新床位指派给棋子 */
  execute(world: World, cmd: Command): ExecutionResult {
    const bedId = cmd.payload.bedId as string;
    const pawnId = cmd.payload.pawnId as string;

    // 查找棋子以获取名字（ownerPawnId 存储 pawn.name 而非 pawn.id）
    const pawn = findPawn(world, pawnId)!;
    const pawnName = pawn.name;

    // 一人一床规则：清除该棋子在所有地图上的其他床位所有权
    for (const [, map] of world.maps) {
      const buildings = map.objects.allOfKind(ObjectKind.Building);
      for (const building of buildings) {
        if (building.bed && building.bed.ownerPawnId === pawnName) {
          building.bed.ownerPawnId = undefined;
        }
      }
    }

    // 将新床位指派给棋子
    const bed = findBed(world, bedId)!;
    bed.bed!.ownerPawnId = pawnName;

    return {
      events: [{
        type: 'bed_owner_assigned',
        tick: world.tick,
        data: { bedId, pawnId, pawnName },
      }],
    };
  },
};

// ── clear_bed_owner（清除床位所有者命令） ──

/**
 * 清除床位所有者命令处理器
 * 仅清除床位的 ownerPawnId，不影响 occupantPawnId（占用者）
 */
export const clearBedOwnerHandler: CommandHandler = {
  type: 'clear_bed_owner',

  /** 验证：检查床位是否存在 */
  validate(world: World, cmd: Command): ValidationResult {
    const bedId = cmd.payload.bedId as string | undefined;
    if (!bedId) return { valid: false, reason: 'Missing bedId' };

    const bed = findBed(world, bedId);
    if (!bed) return { valid: false, reason: `Bed ${bedId} not found` };

    return { valid: true };
  },

  /** 执行：清除床位所有权，发出 bed_owner_cleared 事件 */
  execute(world: World, cmd: Command): ExecutionResult {
    const bedId = cmd.payload.bedId as string;

    const bed = findBed(world, bedId)!;
    bed.bed!.ownerPawnId = undefined;

    return {
      events: [{
        type: 'bed_owner_cleared',
        tick: world.tick,
        data: { bedId },
      }],
    };
  },
};

// ── 导出所有建筑命令处理器 ──
export const buildingCommandHandlers: CommandHandler[] = [
  assignBedOwnerHandler,
  clearBedOwnerHandler,
];
