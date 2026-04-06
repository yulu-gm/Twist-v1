/**
 * 无 Phaser 的 headless 模拟入口：组装 WorldCore、网关、SimAccess 与 GameOrchestrator。
 */

import { DEFAULT_SIM_CONFIG, type SimConfig } from "../game/behavior";
import { createGameOrchestrator, type GameOrchestratorHooks } from "../game/game-orchestrator";
import {
  DEFAULT_WORLD_GRID,
  isInsideGrid,
  type GridCoord,
  type WorldGridConfig
} from "../game/map";
import {
  DEFAULT_PAWN_NEEDS,
  describePawnDebugLabel,
  type PawnState
} from "../game/pawn-state";
import type { WorldTimeSnapshot } from "../game/time/world-time";
import { createWorldCore, getWorldSnapshot } from "../game/world-core";
import { createSeededRng } from "../game/util/seeded-rng";
import type {
  PlayerSelectionCommitInput,
  PlayerSelectionCommitOutcome
} from "../player/commit-player-intent";
import { WorldCoreWorldPort } from "../player/world-core-world-port";
import { createHeadlessSimAccess, type HeadlessGameOrchestratorSimAccess } from "./headless-sim-access";
import { createSimEventCollector, type SimEventCollector } from "./sim-event-log";

const PAWN_FILL_PALETTE = [0xe07a5f, 0x81b29a, 0x3d405b, 0xf2cc8f, 0x9b5de5] as const;

const NOOP_HOOKS: GameOrchestratorHooks = {
  onPaletteChanged: () => {},
  syncTimeHud: () => {},
  syncTreesAndGroundItems: () => {},
  redrawStoneCells: () => {},
  redrawInteractionPoints: () => {},
  syncPawnViews: () => {},
  syncMarkerOverlay: () => {},
  syncHoverFromPointer: () => {},
  syncPawnDetailPanel: () => {}
};

const DEFAULT_HEADLESS_SEED = 0xdecafbad;

export type HeadlessSimOptions = Readonly<{
  /** 32-bit 种子，驱动模拟层 RNG。 */
  seed?: number;
  /** 世界与寻径用网格；默认 {@link DEFAULT_WORLD_GRID}。 */
  worldGrid?: WorldGridConfig;
  /**
   * 交互点模板（床位合并 restSpots 等）；省略时与 `worldGrid` 相同。
   */
  interactionTemplate?: WorldGridConfig;
  simConfig?: SimConfig;
}>;

export type HeadlessSimRunUntilResult = Readonly<{
  reachedPredicate: boolean;
  ticksRun: number;
}>;

export type HeadlessSimRunUntilOptions = Readonly<{
  /** 单次 `tick` 的模拟毫秒；默认 16。 */
  deltaMs?: number;
  /** 安全上限，防止死循环；默认 50_000。 */
  maxTicks?: number;
}>;

export type HeadlessSim = Readonly<{
  tick: (deltaMs: number) => void;
  getTickCount: () => number;
  /** 领域世界时间（随 `tick` 推进）。 */
  getWorldTime: () => WorldTimeSnapshot;
  getPawns: () => readonly PawnState[];
  spawnPawn: (name: string, cell: GridCoord, overrides?: Partial<PawnState>) => PawnState;
  runUntil: (
    predicate: () => boolean,
    options?: HeadlessSimRunUntilOptions
  ) => HeadlessSimRunUntilResult;
  /** 调试或高级用法：底层 SimAccess（与编排器共享引用）。 */
  getSimAccess: () => HeadlessGameOrchestratorSimAccess;
  /** 自上次 `clear()` 以来各 tick 的差分事件收集器。 */
  getSimEventCollector: () => SimEventCollector;
  /** 可变世界端口（放置蓝图、障碍等 headless 场景写入）。 */
  getWorldPort: () => WorldCoreWorldPort;
  /**
   * 与 `GameOrchestrator.commitPlayerSelection` 一致：`buildDomainCommand` → 网关 → 任务标记。
   * 玩法单测应优先走此路径，避免手写领域命令与工具栏/输入形态不一致。
   */
  commitPlayerSelection: (input: PlayerSelectionCommitInput) => PlayerSelectionCommitOutcome;
}>;

export function createHeadlessSim(options: HeadlessSimOptions = {}): HeadlessSim {
  const seed = options.seed ?? DEFAULT_HEADLESS_SEED;
  const rng = createSeededRng(seed);
  const baseGrid = options.worldGrid ?? DEFAULT_WORLD_GRID;
  /** 必须为可变 `Set`，否则 `syncWorldGridForSimulation` 因 falsy 跳过节流写入，石格障碍对寻路不可见。 */
  const worldGrid: WorldGridConfig = {
    ...baseGrid,
    blockedCellKeys: new Set(baseGrid.blockedCellKeys ?? [])
  };
  const interactionTemplate = options.interactionTemplate ?? worldGrid;
  const simConfig = options.simConfig ?? DEFAULT_SIM_CONFIG;

  const worldCore = createWorldCore({ grid: worldGrid });
  const worldPort = new WorldCoreWorldPort(worldCore);
  const simAccess = createHeadlessSimAccess();
  const orchestrator = createGameOrchestrator({
    worldPort,
    worldGrid,
    interactionTemplate,
    sim: simAccess,
    simConfig,
    rng,
    hooks: NOOP_HOOKS
  });
  orchestrator.bootstrapSimulationGrid();

  let tickCount = 0;
  let nextPawnSeq = 0;
  const simEventCollector = createSimEventCollector();

  const tick = (deltaMs: number): void => {
    const pawnsBefore = [...simAccess.getPawns()];
    const worldBefore = getWorldSnapshot(worldPort.getWorld());
    orchestrator.tick(deltaMs);
    tickCount += 1;
    const pawnsAfter = [...simAccess.getPawns()];
    const worldAfter = getWorldSnapshot(worldPort.getWorld());
    simEventCollector.recordPawnDiff(pawnsBefore, pawnsAfter, tickCount);
    simEventCollector.recordWorldDiff(worldBefore, worldAfter, tickCount);
  };

  const getWorldTime = (): WorldTimeSnapshot => {
    const t = worldPort.getWorld().time;
    return {
      dayNumber: t.dayNumber,
      minuteOfDay: t.minuteOfDay,
      dayProgress01: t.dayProgress01,
      currentPeriod: t.currentPeriod,
      paused: t.paused,
      speed: t.speed
    };
  };

  const spawnPawn = (name: string, cell: GridCoord, overrides?: Partial<PawnState>): PawnState => {
    if (!isInsideGrid(worldGrid, cell)) {
      throw new Error(`headless-sim: spawn cell out of grid (${cell.col},${cell.row})`);
    }
    const seq = nextPawnSeq++;
    const id = `pawn-${seq}`;
    const base: PawnState = {
      id,
      name,
      logicalCell: { col: cell.col, row: cell.row },
      moveTarget: undefined,
      moveProgress01: 0,
      fillColor: PAWN_FILL_PALETTE[seq % PAWN_FILL_PALETTE.length]!,
      satiety: 100,
      energy: 100,
      needs: DEFAULT_PAWN_NEEDS,
      currentGoal: undefined,
      currentAction: undefined,
      reservedTargetId: undefined,
      actionTimerSec: 0,
      workTimerSec: 0,
      activeWorkItemId: undefined,
      debugLabel: "goal:none action:idle"
    };
    const merged: PawnState = overrides ? { ...base, ...overrides, id: base.id } : base;
    const labeled: PawnState = {
      ...merged,
      debugLabel: describePawnDebugLabel(merged)
    };
    simAccess.getPawnsRef().push(labeled);
    return labeled;
  };

  const runUntil = (
    predicate: () => boolean,
    runOptions: HeadlessSimRunUntilOptions = {}
  ): HeadlessSimRunUntilResult => {
    const deltaMs = runOptions.deltaMs ?? 16;
    const maxTicks = runOptions.maxTicks ?? 50_000;
    if (predicate()) {
      return { reachedPredicate: true, ticksRun: 0 };
    }
    let ticksRun = 0;
    while (ticksRun < maxTicks) {
      tick(deltaMs);
      ticksRun += 1;
      if (predicate()) {
        return { reachedPredicate: true, ticksRun };
      }
    }
    return { reachedPredicate: false, ticksRun };
  };

  return {
    tick,
    getTickCount: () => tickCount,
    getWorldTime,
    getPawns: () => [...simAccess.getPawns()],
    spawnPawn,
    runUntil,
    getSimAccess: () => simAccess,
    getSimEventCollector: () => simEventCollector,
    getWorldPort: () => worldPort,
    commitPlayerSelection: (input: PlayerSelectionCommitInput) => orchestrator.commitPlayerSelection(input)
  };
}
