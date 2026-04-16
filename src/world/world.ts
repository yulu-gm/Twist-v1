/**
 * @file world.ts
 * @description 游戏世界（World）的顶层数据结构和工厂函数。
 *              World 是整个游戏状态的根对象，聚合了时钟、地图、派系、
 *              定义数据库、命令/事件系统等所有核心子系统。
 * @dependencies core/types, core/seeded-random, core/clock, core/command-bus,
 *               core/event-bus, core/tick-runner, world/def-database, world/game-map
 * @part-of world 模块——游戏世界数据层
 */

import {
  SimSpeed, MapId, FactionId,
} from '../core/types';
import { SeededRandom } from '../core/seeded-random';
import { SimulationClock, createClock } from '../core/clock';
import { CommandBus, Command, ExecutedCommand } from '../core/command-bus';
import { EventBus, GameEvent } from '../core/event-bus';
import { TickRunner } from '../core/tick-runner';
import { DefDatabase } from './def-database';
import { GameMap } from './game-map';

// ── 派系 ──
export interface Faction {
  /** 派系唯一标识符 */
  id: FactionId;
  /** 派系名称 */
  name: string;
  /** 是否为玩家派系 */
  isPlayer: boolean;
  /** 是否敌对 */
  hostile: boolean;
}

// ── 故事状态（AI叙事驱动） ──
interface StoryState {
  /** 当前威胁等级（影响事件生成的难度） */
  threatLevel: number;
  /** 距离上次袭击的天数 */
  daysSinceLastRaid: number;
  /** 殖民地总财富值（影响袭击规模） */
  totalWealth: number;
}

// ── 游戏世界 ──
export interface World {
  // ── 时间与模拟 ──
  /** 当前游戏刻（每帧递增的逻辑时间单位） */
  tick: number;
  /** 模拟时钟（管理游戏内日期/时间） */
  clock: SimulationClock;
  /** 带种子的随机数生成器（确保可重放） */
  rng: SeededRandom;
  /** 当前模拟速度（暂停/正常/快进等） */
  speed: SimSpeed;

  // ── 数据与地图 ──
  /** 定义数据库（所有 Def 的注册表） */
  defs: DefDatabase;
  /** 所有游戏地图（按 MapId 索引） */
  maps: Map<MapId, GameMap>;

  // ── 派系与叙事 ──
  /** 所有派系（按 FactionId 索引） */
  factions: Map<FactionId, Faction>;
  /** 故事状态（AI 叙事驱动数据） */
  storyState: StoryState;

  // ── 命令与事件系统 ──
  /** 待处理的命令队列 */
  commandQueue: Command[];
  /** 当前帧的事件缓冲区 */
  eventBuffer: GameEvent[];
  /** 已执行命令的历史日志 */
  commandLog: ExecutedCommand[];
  /** 命令总线（分发命令给处理器） */
  commandBus: CommandBus;
  /** 事件总线（广播游戏事件给监听器） */
  eventBus: EventBus;
  /** Tick 执行器（管理每帧执行的系统） */
  tickRunner: TickRunner;
}

/**
 * 创建一个新的游戏世界实例
 * @param config.defs - 已构建好的定义数据库
 * @param config.seed - 随机数种子（用于可重放的随机生成）
 * @returns 初始化完成的 World 对象，tick=0，速度为正常
 */
export function createWorld(config: {
  defs: DefDatabase;
  seed: number;
}): World {
  return {
    tick: 0,
    clock: createClock(),
    rng: new SeededRandom(config.seed),
    speed: SimSpeed.Normal,
    defs: config.defs,
    maps: new Map(),
    factions: new Map(),
    storyState: {
      threatLevel: 0,
      daysSinceLastRaid: 0,
      totalWealth: 0,
    },
    commandQueue: [],
    eventBuffer: [],
    commandLog: [],
    commandBus: new CommandBus(),
    eventBus: new EventBus(),
    tickRunner: new TickRunner(),
  };
}
