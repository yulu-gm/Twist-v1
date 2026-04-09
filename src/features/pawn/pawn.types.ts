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
    /** 当前格子间的移动进度（0~1） */
    moveProgress: number;
    /** 移动速度（每 tick 移动的进度量） */
    speed: number;
    /** 上一次移动前所在的格子（用于渲染插值），null 表示尚未移动过 */
    prevCell: CellCoord | null;
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
    /** 当前搬运的物品ID，null 表示未搬运 */
    carrying: ObjectId | null;
    /** 最大搬运重量 */
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
