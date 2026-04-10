/**
 * @file save.commands.ts
 * @description 存档/读档命令处理器，以及序列化/反序列化工具函数
 * @dependencies core/command-bus — 命令处理接口；core/event-bus — 事件类型；
 *               core/serialization — 版本迁移；core/types — ID 计数器、标签等；
 *               world/world — World 与 Faction；world/game-map — GameMap、Zone；
 *               core/grid — Grid 工具；save.types — 存档数据类型
 * @part-of features/save — 存档/读档功能模块
 */

import { CommandHandler, Command } from '../../core/command-bus';
import { GameEvent } from '../../core/event-bus';
import { CURRENT_SAVE_VERSION, applyMigrations } from '../../core/serialization';
import { currentIdCounter, resetIdCounter, MapId, Tag, ObjectKind, ZoneType } from '../../core/types';
import { World, Faction } from '../../world/world';
import { createGameMap } from '../../world/game-map';
import { Grid } from '../../core/grid';
import { SaveData, MapSaveData } from './save.types';
import type { Zone } from '../zone/zone.types';
import { normalizeZoneConfig } from '../zone/zone.types';

/** localStorage 中存档数据的键名 */
const SAVE_KEY = 'opus_world_save';

// ── 序列化辅助函数 ──

/**
 * 将地图对象序列化为纯 JSON 对象
 *
 * @param obj - 包含 Set 等非序列化类型的地图对象
 * @returns 纯 JSON 对象，所有 Set 转换为数组，嵌套对象递归处理
 */
function serializeObject(obj: any): any {
  const serialized: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value instanceof Set) {
      serialized[key] = Array.from(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested plain objects to catch nested Sets
      serialized[key] = serializeObject(value);
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

/**
 * 将序列化后的对象还原为带 Set 类型的地图对象
 *
 * @param data - 纯 JSON 对象（tags 为字符串数组）
 * @returns 还原后的对象，tags 恢复为 Set<Tag>，storage.allowedDefIds 恢复为 Set
 */
function deserializeObject(data: any): any {
  const obj: any = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (key === 'tags' && Array.isArray(value)) {
      obj[key] = new Set<Tag>(value);
    } else if (key === 'cells' && Array.isArray(value)) {
      obj[key] = new Set(value);
    } else if (key === 'storage' && value && typeof value === 'object') {
      obj[key] = {
        ...value,
        allowedDefIds: Array.isArray(value.allowedDefIds)
          ? new Set(value.allowedDefIds)
          : value.allowedDefIds,
      };
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

/**
 * 将区域（Zone）序列化为纯 JSON 对象
 *
 * @param zone - 包含 Set<CellCoordKey> cells 的区域对象
 * @returns 纯 JSON 对象，cells 转换为数组
 */
function serializeZone(zone: Zone): any {
  return {
    id: zone.id,
    zoneType: zone.zoneType,
    cells: Array.from(zone.cells),
    config: serializeObject(zone.config),
  };
}

/**
 * 将纯 JSON 对象反序列化为区域（Zone）
 *
 * @param data - 序列化后的区域数据
 * @returns 还原后的 Zone 对象，cells 恢复为 Set
 */
function deserializeZone(data: any): Zone {
  const zoneType = data.zoneType as ZoneType;
  return {
    id: data.id,
    zoneType,
    cells: new Set(data.cells),
    config: normalizeZoneConfig(zoneType, data.config),
  };
}

// ── save_game 命令处理器 ──

/**
 * 保存游戏命令处理器
 *
 * 将整个世界状态序列化为 JSON 并存入 localStorage。
 * 包括：tick、时钟、RNG、速度、地图（地形+对象+区域+预约）、派系、故事状态。
 */
export const saveGameHandler: CommandHandler = {
  type: 'save_game',

  /** 验证：保存操作无需前置条件，始终有效 */
  validate(_world: any, _cmd: Command) {
    return { valid: true };
  },

  /**
   * 执行保存：遍历所有地图和派系，构建 SaveData 并写入 localStorage
   *
   * @param world - 当前世界状态
   * @returns 包含 'game_saved' 事件的结果
   */
  execute(world: World, _cmd: Command) {
    const mapSaves: MapSaveData[] = [];

    for (const [, map] of world.maps) {
      const objects = map.objects.all().map(serializeObject);
      const zones = map.zones.getAll().map(serializeZone);
      const reservations = map.reservations.getAll();

      mapSaves.push({
        id: map.id,
        width: map.width,
        height: map.height,
        terrain: map.terrain.toFlatArray(),
        objects,
        zones,
        reservations,
      });
    }

    const factions: SaveData['factions'] = [];
    for (const [, faction] of world.factions) {
      factions.push({
        id: faction.id,
        name: faction.name,
        isPlayer: faction.isPlayer,
        hostile: faction.hostile,
      });
    }

    const saveData: SaveData = {
      version: CURRENT_SAVE_VERSION,
      tick: world.tick,
      clockState: {
        totalTicks: world.clock.totalTicks,
        hour: world.clock.hour,
        day: world.clock.day,
        season: world.clock.season,
        year: world.clock.year,
      },
      rngState: world.rng.getState(),
      speed: world.speed,
      maps: mapSaves,
      factions,
      storyState: {
        threatLevel: world.storyState.threatLevel,
        daysSinceLastRaid: world.storyState.daysSinceLastRaid,
        totalWealth: world.storyState.totalWealth,
      },
      nextObjectId: currentIdCounter(),
    };

    const json = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY, json);

    const events: GameEvent[] = [
      {
        type: 'game_saved',
        tick: world.tick,
        data: {},
      },
    ];

    return { events };
  },
};

// ── load_game 命令处理器 ──

/**
 * 加载游戏命令处理器
 *
 * 从 localStorage 读取存档 JSON，应用版本迁移，
 * 然后完整还原世界状态：tick、时钟、RNG、速度、派系、地图、对象、
 * 区域、预约和寻路网格。加载后清除棋子的运行时 AI/移动/背包状态。
 */
export const loadGameHandler: CommandHandler = {
  type: 'load_game',

  /** 验证：检查 localStorage 中是否存在存档数据 */
  validate(_world: any, _cmd: Command) {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { valid: false, reason: 'No save data found in localStorage' };
    }
    return { valid: true };
  },

  /**
   * 执行加载：从 localStorage 解析存档数据并还原完整世界状态
   *
   * @param world - 需要被还原的世界对象
   * @returns 包含 'game_loaded' 事件的结果
   */
  execute(world: World, _cmd: Command) {
    const raw = localStorage.getItem(SAVE_KEY)!;
    let savedData: SaveData = JSON.parse(raw);

    // 应用版本迁移，确保旧存档兼容新版本
    savedData = applyMigrations(savedData) as SaveData;

    // 还原顶层世界状态
    world.tick = savedData.tick;
    world.clock.totalTicks = savedData.clockState.totalTicks;
    world.clock.hour = savedData.clockState.hour;
    world.clock.day = savedData.clockState.day;
    world.clock.season = savedData.clockState.season;
    world.clock.year = savedData.clockState.year;
    world.rng.setState(savedData.rngState);
    world.speed = savedData.speed;
    resetIdCounter(savedData.nextObjectId);

    // 还原故事生成器状态
    world.storyState.threatLevel = savedData.storyState.threatLevel;
    world.storyState.daysSinceLastRaid = savedData.storyState.daysSinceLastRaid;
    world.storyState.totalWealth = savedData.storyState.totalWealth;

    // 还原派系
    world.factions.clear();
    for (const f of savedData.factions) {
      const faction: Faction = {
        id: f.id,
        name: f.name,
        isPlayer: f.isPlayer,
        hostile: f.hostile,
      };
      world.factions.set(f.id, faction);
    }

    // 还原地图
    world.maps.clear();
    for (const mapData of savedData.maps) {
      const map = createGameMap({
        id: mapData.id,
        width: mapData.width,
        height: mapData.height,
      });

      // 从平铺数组重建地形网格
      const terrainGrid = Grid.fromFlatArray(mapData.width, mapData.height, mapData.terrain);
      terrainGrid.forEach((x, y, value) => {
        map.terrain.set(x, y, value);
      });

      // 重建对象（将 string[] 还原为 Set<Tag>）
      for (const objData of mapData.objects) {
        const obj = deserializeObject(objData);
        map.objects.add(obj);
      }

      // 重建区域
      for (const zoneData of mapData.zones) {
        const zone = deserializeZone(zoneData);
        map.zones.add(zone);
      }

      // 重建预约（通过 tryReserve 重新创建，预约 ID 可能不同，但核心状态保留）
      for (const resData of mapData.reservations) {
        // 通过 tryReserve 重建，ID 可能不同但核心数据（持有者、目标、任务、过期时间）保留
        map.reservations.tryReserve({
          claimantId: resData.claimantId,
          targetId: resData.targetId,
          jobId: resData.jobId,
          currentTick: world.tick,
          maxTick: resData.expiresAtTick - world.tick,
        });
      }

      world.maps.set(mapData.id as MapId, map);

      // 根据地形和建筑重建寻路网格
      map.pathGrid.rebuildFrom(map, world.defs);

      // 清除棋子运行时状态 — 反序列化后 AI 任务/移动路径可能无效
      const pawns = map.objects.allOfKind(ObjectKind.Pawn);
      for (const pawn of pawns) {
        if (pawn.ai) {
          pawn.ai.currentJob = null;
          pawn.ai.currentToilIndex = 0;
          pawn.ai.toilState = {};
          pawn.ai.idleTicks = 0;
        }
        if (pawn.movement) {
          pawn.movement.path = [];
          pawn.movement.pathIndex = 0;
          pawn.movement.moveProgress = 0;
        }
        if (pawn.inventory) {
          pawn.inventory.carrying = null;
        }
      }
    }

    // 清空命令队列和事件缓冲区
    world.commandQueue.length = 0;
    world.eventBuffer.length = 0;

    const events: GameEvent[] = [
      {
        type: 'game_loaded',
        tick: world.tick,
        data: {},
      },
    ];

    return { events };
  },
};

/** 导出所有存档相关的命令处理器 */
export const saveCommandHandlers: CommandHandler[] = [
  saveGameHandler,
  loadGameHandler,
];
