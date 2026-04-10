/**
 * @file types.ts
 * @description 核心类型定义文件，包含全局 ID 类型、坐标系统、枚举常量、基础接口和工具函数
 * @dependencies 无外部依赖（纯类型定义）
 * @part-of core 核心模块 — 被项目中几乎所有模块引用
 */

// ── ID 类型（各子系统的唯一标识符） ──
export type ObjectId = string;       // 游戏对象唯一标识，如 "obj_1", "obj_2"
export type MapId = string;          // 地图唯一标识
export type DefId = string;          // 定义（蓝图/模板）标识
export type FactionId = string;      // 派系标识
export type SkillId = string;        // 技能标识
export type Tag = string;            // 对象标签，如 "haulable", "reservable", "selectable"
export type ZoneId = string;         // 区域标识
export type RoomId = string;         // 房间标识
export type ReservationId = string;  // 预约标识
export type JobId = string;          // 工作标识
export type TerrainDefId = DefId;    // 地形定义标识（DefId 的别名）
export type CellCoordKey = string;   // 格子坐标序列化键，格式为 "x,y"

// ── 坐标系统 ──
/** 二维格子坐标 */
export interface CellCoord {
  x: number;
  y: number;
}

/**
 * 将格子坐标转换为字符串键
 * @param c - 格子坐标 {x, y}
 * @returns 格式为 "x,y" 的字符串键
 */
export function cellKey(c: CellCoord): CellCoordKey {
  return `${c.x},${c.y}`;
}

/**
 * 将字符串键解析为格子坐标
 * @param key - 格式为 "x,y" 的字符串键
 * @returns 解析后的格子坐标 {x, y}
 */
export function parseKey(key: CellCoordKey): CellCoord {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * 判断两个格子坐标是否相等
 * @param a - 第一个格子坐标
 * @param b - 第二个格子坐标
 * @returns 坐标相同返回 true
 */
export function cellEquals(a: CellCoord, b: CellCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

// ── 占地尺寸 ──
/** 对象在地图上的占地宽高（以格子为单位） */
export interface Footprint {
  width: number;
  height: number;
}

// ── 材料需求 ──
/** 建造/制造所需的材料条目 */
export interface MaterialReq {
  defId: DefId;
  count: number;
}

// ── 旋转方向枚举 ──
/** 对象朝向，以角度表示（0=北, 90=东, 180=南, 270=西） */
export enum Rotation {
  North = 0,
  East = 90,
  South = 180,
  West = 270,
}

// ── 品质等级枚举 ──
/** 物品/建筑的品质等级，从劣质到传奇 */
export enum QualityLevel {
  Awful = 0,
  Poor = 1,
  Normal = 2,
  Good = 3,
  Excellent = 4,
  Masterwork = 5,
  Legendary = 6,
}

// ── 存储优先级枚举 ──
/** 仓储区的存放优先级，决定物品搬运的目标选择 */
export enum StoragePriority {
  Low = 0,
  Normal = 1,
  Preferred = 2,
  Important = 3,
  Critical = 4,
}

// ── 工作优先级枚举 ──
/** 工作任务的优先级，决定小人选择任务的顺序 */
export enum WorkPriority {
  None = 0,
  Low = 1,
  Normal = 2,
  High = 3,
  Critical = 4,
}

// ── 模拟速度枚举 ──
/** 游戏运行速度档位：暂停、正常、快速、超快 */
export enum SimSpeed {
  Paused = 0,
  Normal = 1,
  Fast = 2,
  UltraFast = 3,
}

// ── 游戏对象种类枚举 ──
/** 地图上所有对象的分类，决定渲染和交互方式 */
export enum ObjectKind {
  Pawn = "pawn",
  Building = "building",
  Item = "item",
  Plant = "plant",
  Fire = "fire",
  Corpse = "corpse",
  Blueprint = "blueprint",
  ConstructionSite = "construction_site",
  Designation = "designation",
}

// ── 指派类型枚举 ──
/** 玩家对地图格子/对象下达的工作指派类型 */
export enum DesignationType {
  Harvest = "harvest",
  Mine = "mine",
  Deconstruct = "deconstruct",
  Repair = "repair",
  Haul = "haul",
  Hunt = "hunt",
  Cut = "cut",
}

// ── Tick 阶段枚举 ──
/** 每个模拟 Tick 内的执行阶段，按顺序依次运行 */
export enum TickPhase {
  COMMAND_PROCESSING = 0,
  WORK_GENERATION = 1,
  AI_DECISION = 2,
  RESERVATION = 3,
  EXECUTION = 4,
  WORLD_UPDATE = 5,
  CLEANUP = 6,
  EVENT_DISPATCH = 7,
}

// ── 劳动步骤（Toil）类型枚举 ──
/** 工作中的单个原子操作类型（移动、拾取、放下等） */
export enum ToilType {
  GoTo = "goto",
  PickUp = "pickup",
  Drop = "drop",
  Work = "work",
  Wait = "wait",
  Deliver = "deliver",
  Interact = "interact",
  PrepareConstruction = "prepare_construction",
}

/** 劳动步骤的执行状态 */
export enum ToilState {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
}

/** 工作（Job）的整体状态，从创建到完成的生命周期 */
export enum JobState {
  Starting = "starting",
  Active = "active",
  Completing = "completing",
  Interrupted = "interrupted",
  Failed = "failed",
  Done = "done",
}

// ── 区域类型枚举 ──
/** 玩家可创建的区域类型 */
export enum ZoneType {
  Stockpile = "stockpile",
  Growing = "growing",
  Animal = "animal",
}

// ── 地图对象基础接口 ──
/** 所有地图对象共享的基础属性 */
export interface MapObjectBase {
  id: ObjectId;            // 对象唯一标识
  kind: ObjectKind;        // 对象种类
  defId: DefId;            // 定义模板标识
  mapId: MapId;            // 所在地图标识
  cell: CellCoord;         // 所在格子坐标
  footprint?: Footprint;   // 占地尺寸（可选）
  tags: Set<Tag>;          // 标签集合
  destroyed: boolean;      // 是否已被销毁
}

/**
 * 类型映射：ObjectKind → 具体对象接口
 *
 * 各 feature 模块通过 declaration merging 注册自己的映射，
 * 使 ObjectPool.allOfKind(kind) 等方法自动返回正确的具体类型，
 * 而 core 层无需 import 任何 feature 类型。
 *
 * @example
 * // 在 feature 的 types 文件末尾：
 * declare module '../../core/types' {
 *   interface KindMap { [ObjectKind.Pawn]: Pawn; }
 * }
 */
export interface KindMap {
  [key: string]: MapObjectBase;
}

// ── 日程安排 ──
/** 小人每日活动安排类型 */
export enum ScheduleActivity {
  Anything = "anything",
  Work = "work",
  Joy = "joy",
  Sleep = "sleep",
}

/** 日程条目：某一小时对应的活动 */
export interface ScheduleEntry {
  hour: number;
  activity: ScheduleActivity;
}

// ── 伤害 ──
/** 小人身体部位的伤害信息 */
export interface Injury {
  partId: string;     // 受伤部位标识
  severity: number;   // 伤害严重程度
  bleeding: boolean;  // 是否正在流血
}

// ── 技能等级 ──
/** 小人某项技能的等级与经验值 */
export interface SkillLevel {
  level: number;  // 当前等级
  xp: number;     // 当前经验值
}

// ── 日志频道 ──
/** 日志输出的分类频道 */
export type LogChannel = "ai" | "job" | "command" | "construction" | "path" | "general" | "event" | "save";

// ── ID 生成器 ──
/** 自增 ID 计数器，用于生成全局唯一的对象标识 */
let _nextId = 1;

/**
 * 生成下一个唯一的对象标识
 * @returns 格式为 "obj_N" 的唯一标识
 */
export function nextObjectId(): ObjectId {
  return `obj_${_nextId++}`;
}

/**
 * 重置 ID 计数器（用于存档加载时恢复状态）
 * @param startFrom - 计数器起始值，默认为 1
 */
export function resetIdCounter(startFrom: number = 1): void {
  _nextId = startFrom;
}

/**
 * 获取当前 ID 计数器的值（用于存档序列化）
 * @returns 当前计数器值
 */
export function currentIdCounter(): number {
  return _nextId;
}

// ── 排序辅助函数 ──
/**
 * 按对象 ID 中的数字部分排序（升序）
 * @param a - 第一个对象（需含 id 字段）
 * @param b - 第二个对象（需含 id 字段）
 * @returns 负数表示 a 在前，正数表示 b 在前
 */
export function byId(a: { id: string }, b: { id: string }): number {
  // Extract numeric part for proper ordering
  const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
  const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
  return numA - numB;
}
