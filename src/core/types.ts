// ── Primitive ID types ──
export type ObjectId = string;   // "obj_1", "obj_2", ...
export type MapId = string;
export type DefId = string;
export type FactionId = string;
export type SkillId = string;
export type Tag = string;        // "haulable", "reservable", "selectable", ...
export type ZoneId = string;
export type RoomId = string;
export type ReservationId = string;
export type JobId = string;
export type TerrainDefId = DefId;
export type CellCoordKey = string; // "x,y"

// ── Coordinates ──
export interface CellCoord {
  x: number;
  y: number;
}

export function cellKey(c: CellCoord): CellCoordKey {
  return `${c.x},${c.y}`;
}

export function parseKey(key: CellCoordKey): CellCoord {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function cellEquals(a: CellCoord, b: CellCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

// ── Footprint ──
export interface Footprint {
  width: number;
  height: number;
}

// ── Material requirement ──
export interface MaterialReq {
  defId: DefId;
  count: number;
}

// ── Rotation ──
export enum Rotation {
  North = 0,
  East = 90,
  South = 180,
  West = 270,
}

// ── Quality ──
export enum QualityLevel {
  Awful = 0,
  Poor = 1,
  Normal = 2,
  Good = 3,
  Excellent = 4,
  Masterwork = 5,
  Legendary = 6,
}

// ── Storage priority ──
export enum StoragePriority {
  Low = 0,
  Normal = 1,
  Preferred = 2,
  Important = 3,
  Critical = 4,
}

// ── Work priority ──
export enum WorkPriority {
  None = 0,
  Low = 1,
  Normal = 2,
  High = 3,
  Critical = 4,
}

// ── Simulation speed ──
export enum SimSpeed {
  Paused = 0,
  Normal = 1,
  Fast = 2,
  UltraFast = 3,
}

// ── Object kind ──
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

// ── Designation type ──
export enum DesignationType {
  Harvest = "harvest",
  Mine = "mine",
  Deconstruct = "deconstruct",
  Repair = "repair",
  Haul = "haul",
  Hunt = "hunt",
  Cut = "cut",
}

// ── Tick phases ──
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

// ── Toil types ──
export enum ToilType {
  GoTo = "goto",
  PickUp = "pickup",
  Drop = "drop",
  Work = "work",
  Wait = "wait",
  Deliver = "deliver",
  Interact = "interact",
}

export enum ToilState {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
}

export enum JobState {
  Starting = "starting",
  Active = "active",
  Completing = "completing",
  Interrupted = "interrupted",
  Failed = "failed",
  Done = "done",
}

// ── Zone type ──
export enum ZoneType {
  Stockpile = "stockpile",
  Growing = "growing",
  Animal = "animal",
}

// ── Map object base ──
export interface MapObjectBase {
  id: ObjectId;
  kind: ObjectKind;
  defId: DefId;
  mapId: MapId;
  cell: CellCoord;
  footprint?: Footprint;
  tags: Set<Tag>;
  destroyed: boolean;
}

// ── Schedule ──
export enum ScheduleActivity {
  Anything = "anything",
  Work = "work",
  Joy = "joy",
  Sleep = "sleep",
}

export interface ScheduleEntry {
  hour: number;
  activity: ScheduleActivity;
}

// ── Injury ──
export interface Injury {
  partId: string;
  severity: number;
  bleeding: boolean;
}

// ── Skill level ──
export interface SkillLevel {
  level: number;
  xp: number;
}

// ── Log channel ──
export type LogChannel = "ai" | "job" | "command" | "construction" | "path" | "general" | "event" | "save";

// ── ID generator ──
let _nextId = 1;

export function nextObjectId(): ObjectId {
  return `obj_${_nextId++}`;
}

export function resetIdCounter(startFrom: number = 1): void {
  _nextId = startFrom;
}

export function currentIdCounter(): number {
  return _nextId;
}

// ── Sorting helper ──
export function byId(a: { id: string }, b: { id: string }): number {
  // Extract numeric part for proper ordering
  const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
  const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
  return numA - numB;
}
