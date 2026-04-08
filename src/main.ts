/**
 * @file main.ts
 * @description 游戏启动入口，负责初始化定义数据库、创建世界、生成地形/植被/棋子、
 *              注册命令和系统，最终启动 Phaser 渲染引擎
 * @dependencies world/world — 世界创建；world/game-map — 地图创建；defs/index — 定义构建；
 *               core/* — 类型、日志、检查器、tick 阶段；adapter/bootstrap — Phaser 启动；
 *               features/* — 各功能模块的工厂、系统和命令处理器
 * @part-of 根模块 — 应用程序启动点
 */

import { createWorld } from './world/world';
import { createGameMap, GameMap } from './world/game-map';
import { buildDefDatabase } from './defs/index';
import { SimSpeed, TickPhase, ObjectKind } from './core/types';
import { log } from './core/logger';
import { inspector } from './core/inspector';
import { bootstrapPhaser } from './adapter/bootstrap';
import { SystemRegistration } from './core/tick-runner';

// 导入功能模块
import { createPawn } from './features/pawn/pawn.factory';
import { createItem } from './features/item/item.factory';
import { createPlant } from './features/plant/plant.factory';
import { needDecayRegistration } from './features/pawn/pawn.systems';
import { movementSystem } from './features/movement/movement.system';
import { toilExecutorSystem } from './features/ai/toil-executor';
import { jobSelectionSystem } from './features/ai/job-selector';
import { growPlantsSystem } from './features/plant/plant.system';
import { fireSystem } from './features/fire/fire.system';
import { constructionProgressSystem } from './features/construction/construction.system';
import { constructionCommandHandlers } from './features/construction/construction.commands';
import { designationCommandHandlers } from './features/designation/designation.commands';
import { workGenerationSystem } from './features/designation/designation.system';
import { pawnCommandHandlers } from './features/pawn/pawn.commands';
import { zoneCommandHandlers } from './features/zone/zone.commands';
import { saveCommandHandlers } from './features/save/save.commands';
import { corpseDecaySystem } from './features/corpse/corpse.system';
import { roomRebuildSystem } from './features/room/room.system';
import { buildingTickSystem } from './features/building/building.systems';
import type { World } from './world/world';

/**
 * 生成地形 — 用随机噪声为地图分配地形类型
 *
 * @param map - 目标地图
 * @param world - 世界对象（提供 RNG）
 *
 * 地形概率分布：5% 水、7% 岩石、13% 泥土、5% 沙地、70% 草地
 */
function generateTerrain(map: GameMap, world: World): void {
  const rng = world.rng;

  map.terrain.forEach((x, y) => {
    const noise = rng.next();

    if (noise < 0.05) {
      map.terrain.set(x, y, 'water');
    } else if (noise < 0.12) {
      map.terrain.set(x, y, 'rock');
    } else if (noise < 0.25) {
      map.terrain.set(x, y, 'dirt');
    } else if (noise < 0.30) {
      map.terrain.set(x, y, 'sand');
    } else {
      map.terrain.set(x, y, 'grass');
    }
  });
}

/**
 * 生成初始植被 — 在草地上随机放置树木和浆果灌木
 *
 * @param map - 目标地图
 * @param world - 世界对象（提供 RNG 和定义数据库）
 *
 * 草地格子上：8% 概率生成树木（橡树/松树各半）、3% 概率生成浆果灌木
 */
function spawnInitialVegetation(map: GameMap, world: World): void {
  const rng = world.rng;

  map.terrain.forEach((x, y, defId) => {
    if (defId !== 'grass') return;

    if (rng.chance(0.08)) {
      const treeDef = rng.chance(0.5) ? 'tree_oak' : 'tree_pine';
      const plant = createPlant({
        defId: treeDef,
        cell: { x, y },
        mapId: map.id,
        growthProgress: rng.nextFloat(0.3, 1.0),
        defs: world.defs,
      });
      map.objects.add(plant);
    } else if (rng.chance(0.03)) {
      const plant = createPlant({
        defId: 'bush_berry',
        cell: { x, y },
        mapId: map.id,
        growthProgress: rng.nextFloat(0.5, 1.0),
        defs: world.defs,
      });
      map.objects.add(plant);
    }
  });
}

/**
 * 生成初始棋子和资源 — 在地图中央创建 3 个棋子、5 堆木材和 3 堆食物
 *
 * @param map - 目标地图
 * @param world - 世界对象（提供 RNG）
 */
function spawnInitialPawns(map: GameMap, world: World): void {
  const rng = world.rng;
  const centerX = Math.floor(map.width / 2);
  const centerY = Math.floor(map.height / 2);

  const names = ['Alice', 'Bob', 'Charlie'];

  for (const name of names) {
    let px = centerX + rng.nextInt(-3, 3);
    let py = centerY + rng.nextInt(-3, 3);

    const terrain = map.terrain.get(px, py);
    const tDef = world.defs.terrains.get(terrain);
    if (!tDef?.passable) {
      px = centerX;
      py = centerY;
    }

    const pawn = createPawn({
      name,
      cell: { x: px, y: py },
      mapId: map.id,
      factionId: 'player',
      rng,
    });
    map.objects.add(pawn);
  }

  // 生成初始资源：5 堆木材
  for (let i = 0; i < 5; i++) {
    const item = createItem({
      defId: 'wood',
      cell: { x: centerX + rng.nextInt(-2, 2), y: centerY + rng.nextInt(-2, 2) },
      mapId: map.id,
      stackCount: rng.nextInt(10, 25),
      defs: world.defs,
    });
    map.objects.add(item);
  }

  // 生成初始食物：3 堆简单餐食
  for (let i = 0; i < 3; i++) {
    const item = createItem({
      defId: 'meal_simple',
      cell: { x: centerX + rng.nextInt(-2, 2), y: centerY + rng.nextInt(-2, 2) },
      mapId: map.id,
      stackCount: rng.nextInt(3, 8),
      defs: world.defs,
    });
    map.objects.add(item);
  }
}

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
 * 5. 世界更新 — 需求衰减、植物生长、火焰、尸体腐烂、房间重建、建筑 tick
 * 6. 清理 — 移除已销毁对象、清理过期预约
 * 7. 事件分发 — 占位（实际在 main-scene 中分发）
 */
function buildSystems(): SystemRegistration[] {
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
      // 释放已销毁对象的预约
      for (const res of gmap.reservations.getAll()) {
          const obj = gmap.objects.get(res.targetId);
          if (obj && obj.destroyed) {
            gmap.reservations.release(res.id);
          }
        }
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
  systems.push(fireSystem);
  systems.push(corpseDecaySystem);
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
function registerCommands(world: World): void {
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
}

/**
 * 游戏启动函数 — 按顺序执行完整的初始化流程
 *
 * 启动步骤：
 * 1. 构建定义数据库
 * 2. 创建世界
 * 3. 添加派系（玩家殖民地 + 野生动物）
 * 4. 创建 80x80 地图
 * 5. 生成地形 → 初始化寻路网格 → 生成植被 → 生成棋子和资源
 * 6. 注册命令处理器
 * 7. 注册 tick 系统
 * 8. 设置检查器
 * 9. 启动 Phaser 渲染引擎
 */
async function boot(): Promise<void> {
  log.info('general', 'Booting Opus World...');

  // 1. 构建定义数据库
  const defs = buildDefDatabase();
  log.info('general', `Loaded defs: ${defs.buildings.size} buildings, ${defs.items.size} items, ${defs.plants.size} plants, ${defs.terrains.size} terrains`);

  // 2. 创建世界
  const world = createWorld({ defs, seed: 12345 });

  // 3. 添加派系
  world.factions.set('player', { id: 'player', name: 'Colony', isPlayer: true, hostile: false });
  world.factions.set('wild', { id: 'wild', name: 'Wildlife', isPlayer: false, hostile: false });

  // 4. 创建地图
  const map = createGameMap({ id: 'main', width: 80, height: 80 });
  world.maps.set(map.id, map);

  // 5. 生成地形并填充内容
  generateTerrain(map, world);

  // 5b. 根据地形初始化寻路网格（标记岩石/水域为不可通行）
  map.pathGrid.rebuildFrom(map, defs);

  spawnInitialVegetation(map, world);
  spawnInitialPawns(map, world);

  // 6. 注册命令处理器
  registerCommands(world);

  // 7. 注册 tick 系统
  const systems = buildSystems();
  world.tickRunner.registerAll(systems);

  // 8. 设置检查器
  inspector.setWorld(world);

  log.info('general', `World created: ${map.objects.size} objects on ${map.width}x${map.height} map`);

  // 9. 启动 Phaser 渲染引擎
  bootstrapPhaser(world);
}

boot().catch(console.error);
