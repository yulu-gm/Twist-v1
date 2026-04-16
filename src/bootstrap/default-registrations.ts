/**
 * @file default-registrations.ts
 * @description 默认的命令处理器和系统注册 — 从 main.ts 抽离的共享逻辑，
 *              供生产入口和测试 harness 共同复用。
 * @dependencies core/types — 枚举常量；core/tick-runner — 系统注册类型；
 *               features/* — 各功能模块的系统和命令处理器
 * @part-of bootstrap — 启动/共享基础设施层
 */

import { SimSpeed, TickPhase } from '../core/types';
import type { SystemRegistration } from '../core/tick-runner';
import type { World } from '../world/world';
import type { GameMap } from '../world/game-map';

// ── 系统导入 ──
import { needDecayRegistration } from '../features/pawn/pawn.systems';
import { movementSystem } from '../features/movement/movement.system';
import { toilExecutorSystem } from '../features/ai/toil-executor';
import { jobSelectionSystem } from '../features/ai/job-selector';
import { growPlantsSystem } from '../features/plant/plant.system';
import { constructionProgressSystem } from '../features/construction/construction.system';
import { workGenerationSystem } from '../features/designation/designation.system';
import { roomRebuildSystem } from '../features/room/room.system';
import { buildingTickSystem } from '../features/building/building.systems';
import { releaseMissingTargetReservations } from '../features/reservation/reservation.cleanup';

// ── 命令处理器导入 ──
import { constructionCommandHandlers } from '../features/construction/construction.commands';
import { designationCommandHandlers } from '../features/designation/designation.commands';
import { pawnCommandHandlers } from '../features/pawn/pawn.commands';
import { zoneCommandHandlers } from '../features/zone/zone.commands';
import { saveCommandHandlers } from '../features/save/save.commands';
import { buildingCommandHandlers } from '../features/building/building.commands';
import { createItem } from '../features/item/item.factory';

/**
 * 构建所有系统的注册列表 — 按 tick 阶段组织
 *
 * @returns 系统注册列表，包含所有游戏系统
 *
 * 阶段顺序：
 * 0. 命令处理 — 处理命令队列
 * 1. 工作生成 — 从指派创建可用工作
 * 2. AI 决策 — 棋子选择任务
 * 3. 预约管理 — 释放已销毁对象的预约
 * 4. 执行 — 移动、工序执行、建造进度
 * 5. 世界更新 — 需求衰减、植物生长、房间重建、建筑 tick
 * 6. 清理 — 移除已销毁对象、清理过期预约
 * 7. 事件分发 — 占位（实际在 main-scene 中分发）
 */
export function buildDefaultSystems(): SystemRegistration[] {
  const systems: SystemRegistration[] = [];

  // 阶段 0：命令处理
  systems.push({
    id: 'command_processor',
    phase: TickPhase.COMMAND_PROCESSING,
    frequency: 1,
    execute: (w: any) => {
      w.commandBus.processQueue(w);
    },
  });

  // 阶段 1：工作生成
  systems.push(workGenerationSystem);

  // 阶段 2：AI 决策
  systems.push(jobSelectionSystem);

  // 阶段 3：预约管理
  systems.push({
    id: 'reservation_mgr',
    phase: TickPhase.RESERVATION,
    frequency: 1,
    execute: (w: any) => {
      for (const [, gmap] of w.maps) {
        releaseMissingTargetReservations(gmap);
      }
    },
  });

  // 阶段 4：执行
  systems.push(movementSystem);
  systems.push(toilExecutorSystem);
  systems.push(constructionProgressSystem);

  // 阶段 5：世界更新
  systems.push(needDecayRegistration);
  systems.push(growPlantsSystem);
  systems.push(roomRebuildSystem);
  systems.push(buildingTickSystem);

  // 阶段 6：清理
  systems.push({
    id: 'cleanup',
    phase: TickPhase.CLEANUP,
    frequency: 1,
    execute: (w: any) => {
      for (const [, gmap] of w.maps) {
        const toRemove: string[] = [];
        for (const obj of gmap.objects.all()) {
          if (obj.destroyed) toRemove.push(obj.id);
        }
        for (const id of toRemove) {
          gmap.objects.remove(id);
        }
        gmap.reservations.cleanupExpired(w.tick);
      }
    },
  });

  // 阶段 7：事件分发（实际在 main-scene 中处理）
  systems.push({
    id: 'event_dispatch',
    phase: TickPhase.EVENT_DISPATCH,
    frequency: 1,
    execute: () => {},
  });

  return systems;
}

/**
 * 注册所有命令处理器 — 包括速度控制、调试命令和各功能模块命令
 *
 * @param world - 游戏世界对象
 *
 * 注册的命令类型：
 * - set_speed: 设置游戏速度
 * - debug_spawn: 调试生成物品
 * - debug_destroy: 调试销毁对象
 * - debug_advance_ticks: 调试快进 tick
 * - 建造、指派、棋子、区域、存档等功能模块命令
 */
export function registerDefaultCommands(world: World): void {
  // 速度切换命令
  world.commandBus.register({
    type: 'set_speed',
    validate: (_w, cmd) => {
      const speed = cmd.payload.speed as number;
      if (speed < 0 || speed > 3) return { valid: false, reason: 'Invalid speed' };
      return { valid: true };
    },
    execute: (w, cmd) => {
      w.speed = cmd.payload.speed as SimSpeed;
      return { events: [{ type: 'speed_changed', tick: w.tick, data: { speed: cmd.payload.speed } }] };
    },
  });

  // 调试生成物品命令
  world.commandBus.register({
    type: 'debug_spawn',
    validate: () => ({ valid: true }),
    execute: (w, cmd) => {
      const { defId, cell, count } = cmd.payload as { defId: string; cell: any; count: number };
      const map = w.maps.values().next().value;
      if (!map) return { events: [] };
      const item = createItem({ defId, cell, mapId: (map as GameMap).id, stackCount: count ?? 1, defs: w.defs });
      (map as GameMap).objects.add(item);
      return { events: [{ type: 'debug_spawned', tick: w.tick, data: { defId, cell } }] };
    },
  });

  // 调试销毁对象命令
  world.commandBus.register({
    type: 'debug_destroy',
    validate: () => ({ valid: true }),
    execute: (w, cmd) => {
      const { objectId } = cmd.payload as { objectId: string };
      for (const [, map] of w.maps) {
        const obj = (map as GameMap).objects.get(objectId);
        if (obj) { obj.destroyed = true; break; }
      }
      return { events: [{ type: 'debug_destroyed', tick: w.tick, data: { objectId } }] };
    },
  });

  // 调试快进 tick 命令
  world.commandBus.register({
    type: 'debug_advance_ticks',
    validate: (_w, cmd) => {
      const count = cmd.payload.count as number;
      if (!count || count <= 0 || count > 10000) return { valid: false, reason: 'count must be 1-10000' };
      return { valid: true };
    },
    execute: (w, cmd) => {
      const count = cmd.payload.count as number;
      for (let i = 0; i < count; i++) {
        w.tick++;
        w.tickRunner.executeTick(w);
      }
      return { events: [{ type: 'debug_ticks_advanced', tick: w.tick, data: { count } }] };
    },
  });

  // 注册功能模块命令
  world.commandBus.registerAll(constructionCommandHandlers);
  world.commandBus.registerAll(designationCommandHandlers);
  world.commandBus.registerAll(pawnCommandHandlers);
  world.commandBus.registerAll(zoneCommandHandlers);
  world.commandBus.registerAll(saveCommandHandlers);
  world.commandBus.registerAll(buildingCommandHandlers);
}
