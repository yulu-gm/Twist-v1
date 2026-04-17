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
import { log } from './core/logger';

import { inspector } from './core/inspector';
import { bootstrapPhaser } from './adapter/bootstrap';
import { mountUiApp } from './ui/app/app-root';
import { createEngineSnapshotBridge } from './ui/kernel/ui-bridge';
import { readEngineSnapshot } from './ui/kernel/snapshot-reader';
import type { FeedbackSnapshot } from './ui/kernel/ui-types';

// 导入功能模块
import { createPawn } from './features/pawn/pawn.factory';
import { createItem } from './features/item/item.factory';
import { createPlant } from './features/plant/plant.factory';
import type { World } from './world/world';

// 导入共享的启动基础设施
import { buildDefaultSystems, registerDefaultCommands } from './bootstrap/default-registrations';
import type { PresentationState } from './presentation/presentation-state';
import { ToolType, applyObjectSelection, applyToolSelection } from './presentation/presentation-state';
import type { UiPorts } from './ui/kernel/ui-ports';
import type { DesignationType, ObjectId, ZoneType } from './core/types';

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
  const traitIdsByName: Record<string, string[]> = {
    Alice: ['glutton'],
    Bob: ['light_sleeper'],
    Charlie: ['hardy'],
  };

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
      traitIds: traitIdsByName[name] ?? [],
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

// buildSystems 和 registerCommands 已抽离到 bootstrap/default-registrations.ts
// 供生产入口和测试 harness 共同复用

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
function createLazyPorts(world: World, getPresentation: () => PresentationState | undefined): UiPorts {
  function pres(): PresentationState {
    const p = getPresentation();
    if (!p) throw new Error('Presentation not ready');
    return p;
  }

  return {
    dispatchCommand(command) {
      world.commandQueue.push(command);
    },
    setSpeed(speed: number) {
      world.commandQueue.push({ type: 'set_speed', payload: { speed } });
    },
    selectObjects(ids: ObjectId[]) {
      const p = pres();
      applyObjectSelection(p, ids);
    },
    selectColonist(id: string) {
      const p = pres();
      applyObjectSelection(p, [id]);
    },
    setTool(tool: string, designationType?: string | null, buildDefId?: string | null, zoneType?: string | null) {
      const p = pres();
      applyToolSelection(p, {
        tool: tool as ToolType,
        designationType: (designationType ?? null) as DesignationType | null,
        buildDefId: buildDefId ?? null,
        zoneType: (zoneType ?? null) as ZoneType | null,
      });
    },
    jumpCameraTo(_cell: { x: number; y: number }) {
      // Will be wired to Phaser camera later
    },
    assignBedOwner(bedId: string, pawnId: string) {
      world.commandQueue.push({ type: 'assign_bed_owner', payload: { bedId, pawnId } });
    },
    clearBedOwner(bedId: string) {
      world.commandQueue.push({ type: 'clear_bed_owner', payload: { bedId } });
    },
    pauseWorkOrder(orderId: string) {
      world.commandQueue.push({ type: 'pause_work_order', payload: { mapId: 'main', orderId } });
    },
    resumeWorkOrder(orderId: string) {
      world.commandQueue.push({ type: 'resume_work_order', payload: { mapId: 'main', orderId } });
    },
    cancelWorkOrder(orderId: string) {
      world.commandQueue.push({ type: 'cancel_work_order', payload: { mapId: 'main', orderId } });
    },
    reorderWorkOrders(orderIds: string[]) {
      world.commandQueue.push({ type: 'reorder_work_orders', payload: { mapId: 'main', orderIds } });
    },
    createResultWorkOrder(payload: { orderKind: string; title: string; items: Array<Record<string, unknown>> }) {
      world.commandQueue.push({ type: 'create_result_work_order', payload: { mapId: 'main', ...payload } });
    },
  };
}

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

  // 6. 注册命令处理器（使用共享的默认注册函数）
  registerDefaultCommands(world);

  // 7. 注册 tick 系统（使用共享的默认系统构建函数）
  const systems = buildDefaultSystems();
  world.tickRunner.registerAll(systems);

  // 8. 设置检查器
  inspector.setWorld(world);

  log.info('general', `World created: ${map.objects.size} objects on ${map.width}x${map.height} map`);

  // 9. 创建事件反馈缓冲
  const feedbackBuffer: FeedbackSnapshot = { recentEvents: [] };
  world.eventBus.onAny((event) => {
    feedbackBuffer.recentEvents.unshift({
      type: event.type,
      tick: event.tick,
      summary: typeof event.data === 'object' ? JSON.stringify(event.data) : String(event.data),
    });
    if (feedbackBuffer.recentEvents.length > 40) {
      feedbackBuffer.recentEvents.length = 40;
    }
  });

  // 10. 创建 UI 桥接（延迟读取 — 场景创建后才有 presentation 和 activeMap）
  let sceneRef: any = null;
  const bridge = createEngineSnapshotBridge(() => {
    if (!sceneRef?.presentation) {
      // 场景尚未创建，返回空快照
      return {
        tick: 0, speed: 0, clockDisplay: '', colonistCount: 0,
        presentation: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
        selection: { primaryId: null, selectedIds: [] },
        colonists: {}, build: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, lastZoneType: 'stockpile', activeBuildDefId: null, activeModeLabel: 'Select' },
        feedback: feedbackBuffer, debugInfo: '', objects: {},
        // 工作订单空快照 — 场景未就绪时无地图可投影
        workOrders: { list: [], byId: {} },
      };
    }
    return readEngineSnapshot(world, sceneRef.activeMap, sceneRef.presentation, feedbackBuffer);
  });

  // 11. 启动 Phaser 渲染引擎
  const game = bootstrapPhaser(world, bridge);

  // 获取场景引用（Phaser 创建后可用）
  game.events.on('ready', () => {
    sceneRef = game.scene.getScene('MainScene');
  });

  // 12. 挂载 Preact UI
  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    // ports 需要延迟创建（presentation 在场景 create 时初始化）
    const lazyPorts = createLazyPorts(world, () => sceneRef?.presentation);
    mountUiApp(uiRoot, bridge, lazyPorts);
  }
}

if (!(import.meta as ImportMeta & { vitest?: unknown }).vitest) {
  boot().catch(console.error);
}
