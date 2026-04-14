/**
 * @file pawn.types.ts
 * @description 棋子（Pawn）相关的核心类型定义，包括劳作（Toil）、工作（Job）和棋子（Pawn）接口
 * @dependencies core/types — ObjectId, CellCoord, MapObjectBase 等基础类型
 * @part-of features/pawn 棋子功能模块
 */

import type {
  ObjectId,
  ObjectKind,
  CellCoord,
  MapObjectBase,
  DefId,
  FactionId,
  Injury,
  ScheduleEntry,
  SkillId,
  SkillLevel,
  ToilType,
  ToilState,
  JobState,
  JobId,
} from '../../core/types';
import type { PawnWorkDecisionSnapshot } from '../ai/work-types';

// ── 手持物品（地图外的临时堆） ──
export interface CarriedItemStack {
  /** 物品定义 ID */
  defId: DefId;
  /** 当前手持数量 */
  count: number;
}

// ── Toil（劳作：工作中的单个原子步骤） ──
export interface Toil {
  /** 劳作类型（如前往、采集、搬运等） */
  type: ToilType;
  /** 目标对象ID（可选，如操作某个物品） */
  targetId?: ObjectId;
  /** 目标格子坐标（可选，如前往某个位置） */
  targetCell?: CellCoord;
  /** 当前劳作的执行状态 */
  state: ToilState;
  /** 劳作的局部数据，用于存储步骤内的临时信息 */
  localData: Record<string, unknown>;
}

// ── Job（工作：由多个劳作步骤组成的完整任务） ──
export interface Job {
  /** 工作唯一标识 */
  id: JobId;
  /** 工作定义ID（如 "goto"、"haul" 等） */
  defId: DefId;
  /** 执行此工作的棋子ID */
  pawnId: ObjectId;
  /** 工作目标对象ID（可选） */
  targetId?: ObjectId;
  /** 工作目标格子坐标（可选） */
  targetCell?: CellCoord;
  /** 工作包含的劳作步骤列表 */
  toils: Toil[];
  /** 当前正在执行的劳作步骤索引 */
  currentToilIndex: number;
  /** 工作持有的资源预留列表 */
  reservations: string[];
  /** 工作的整体执行状态 */
  state: JobState;
}

/** 棋子需求数值档案 — 描述需求衰减速率、阈值和恢复参数 */
export interface PawnNeedsProfile {
  /** 每 tick 食物衰减量 */
  foodDecayPerTick: number;
  /** 每 tick 休息衰减量 */
  restDecayPerTick: number;
  /** 每 tick 娱乐衰减量 */
  joyDecayPerTick: number;
  /** 食物低于此值时触发寻找食物 */
  hungerSeekThreshold: number;
  /** 食物低于此值视为饥饿危急 */
  hungerCriticalThreshold: number;
  /** 饥饿伤害触发间隔（tick 数） */
  starvationDamageInterval: number;
  /** 每次饥饿伤害扣除的血量 */
  starvationDamageAmount: number;
  /** 休息低于此值时触发寻找睡眠 */
  sleepSeekThreshold: number;
  /** 休息低于此值视为极度疲劳 */
  sleepCriticalThreshold: number;
  /** 睡醒时休息值恢复到的目标值 */
  wakeTargetRest: number;
  /** 在床上每 tick 恢复的休息值 */
  bedRestGainPerTick: number;
  /** 在地板上每 tick 恢复的休息值 */
  floorRestGainPerTick: number;
  /** 在地板睡觉时的心情惩罚值 */
  floorSleepMoodPenalty: number;
  /** 进食后食物恢复到的目标值 */
  mealTargetFood: number;
}

/** 棋子特质 — 永久修改棋子属性参数的个性标签 */
export interface PawnTrait {
  /** 特质唯一标识 */
  traitId: string;
  /** 特质显示名称 */
  label: string;
  /** 特质描述文本 */
  description: string;
}

/** 棋子想法 — 有时限的心情偏移事件 */
export interface PawnThought {
  /** 想法类型标识（如 'Hungry'、'Tired'） */
  type: string;
  /** 对心情值的偏移量（正值为加成，负值为惩罚） */
  moodOffset: number;
  /** 剩余持续 tick 数 */
  remainingTicks: number;
  /** 触发该想法的来源对象ID（可选） */
  sourceId?: ObjectId;
}

export interface PawnChronotype {
  scheduleShiftHours: number;
  sleepStartHour: number;
  sleepDurationHours: number;
  sleepEndHour: number;
  nightOwlBias: number;
}

// ── Pawn（棋子：游戏中可操控的角色实体） ──
export interface Pawn extends MapObjectBase {
  /** 对象类型标识，固定为 Pawn */
  kind: ObjectKind.Pawn;
  /** 棋子显示名称 */
  name: string;
  /** 所属阵营ID */
  factionId: FactionId;
  /** 是否处于征召状态（征召后由玩家直接控制） */
  drafted: boolean;

  // ── 移动相关 ──
  movement: {
    /** 当前移动路径（格子坐标数组），空数组表示无路径 */
    path: CellCoord[];
    /** 当前路径中正在前往的节点索引 */
    pathIndex: number;
    /** 当前格子间的移动进度（与 movement 模块 MOVE_PROGRESS_PER_CELL 同刻度） */
    moveProgress: number;
    /** 移动速度（每 tick 增加的进度，刻度同上） */
    speed: number;
  };

  // ── 需求系统 ──
  needs: {
    /** 食物需求值（0-100） */
    food: number;
    /** 休息需求值（0-100） */
    rest: number;
    /** 娱乐需求值（0-100） */
    joy: number;
    /** 心情值（0-100），由其他需求加权计算 */
    mood: number;
  };
  /** 需求衰减参数档案（由特质调整后的数值） */
  needsProfile: PawnNeedsProfile;
  /** 棋子特质列表 */
  traits: PawnTrait[];
  chronotype: PawnChronotype;
  /** 当前活跃的想法列表（影响心情） */
  thoughts: PawnThought[];
  /** 需求系统的持久状态数据 */
  needsState: {
    /** 饥饿持续 tick 计数（用于计算饥饿伤害间隔） */
    starvationTicks: number;
  };

  // ── 健康系统 ──
  health: {
    /** 当前生命值 */
    hp: number;
    /** 最大生命值 */
    maxHp: number;
    /** 受伤列表 */
    injuries: Injury[];
  };

  /** 技能表：技能ID -> 技能等级与经验 */
  skills: Record<SkillId, SkillLevel>;

  // ── 物品栏 ──
  inventory: {
    /** 当前手持的物品堆，null 表示未搬运 */
    carrying: CarriedItemStack | null;
    /** 最大搬运件数 */
    carryCapacity: number;
  };

  // ── AI 控制 ──
  ai: {
    /** 当前正在执行的工作，null 表示空闲 */
    currentJob: Job | null;
    /** 当前劳作步骤索引 */
    currentToilIndex: number;
    /** 劳作步骤的临时状态数据 */
    toilState: Record<string, unknown>;
    /** 空闲 tick 计数（用于 AI 决策间隔） */
    idleTicks: number;
    /** 工作决策快照 — 最近一次选工过程的冻结说明 */
    workDecision: PawnWorkDecisionSnapshot | null;
  };

  // ── 日程安排 ──
  schedule: {
    /** 24小时日程条目列表 */
    entries: ScheduleEntry[];
  };
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Pawn]: Pawn;
  }
}
