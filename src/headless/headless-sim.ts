/**
 * 无 Phaser 的 headless 模拟入口：组装 WorldCore、网关、SimAccess 与 GameOrchestrator。
 *
 * **验收入口**：本模块是场景驱动与单测的合法无头装配面，与 `GameOrchestrator` / `WorldCore` 同构于可运行世界，
 * 不因 `oh-gen-doc` 未单列「无头子系统」而视为非验收路径。策划侧「小人从地图醒来」的叙事对应生产/bootstrap 流程；
 * 此处通过 {@link HeadlessSim.spawnPawn} 等在内存中注入初始 `PawnState` 属于**测试/夹具 API**，
 * 与设计文档中实体生成表述并存时，以显式注释为准，避免审计无法定性（行动点 #0216）。
 * 小人实体构造经 {@link createFixturePawnState}，注册经 {@link registerPawnWithSimAccess}，与编排器 Sim 契约一致（行动点 #0217）。
 */

import { DEFAULT_SIM_CONFIG, type SimConfig } from "../game/behavior";
import {
  createGameOrchestrator,
  registerPawnWithSimAccess,
  type GameOrchestratorHooks
} from "../game/game-orchestrator";
import {
  DEFAULT_SCENARIO_INTERACTION_POINTS,
  DEFAULT_WORLD_GRID,
  isInsideGrid,
  type GridCoord,
  type WorldGridConfig
} from "../game/map";
import { createFixturePawnState, FIXTURE_PAWN_FILL_PALETTE, type PawnState } from "../game/pawn-state";
import { toWorldTimeSnapshot, type TimeSpeed, type WorldTimeSnapshot } from "../game/time";
import { createWorldCore, getWorldSnapshot } from "../game/world-core";
import { createSeededRng } from "../game/util/seeded-rng";
import type {
  PlayerSelectionCommitInput,
  PlayerSelectionCommitOutcome
} from "../player/commit-player-intent";
import { WorldCoreWorldPort } from "../player/world-core-world-port";
import { createHeadlessSimAccess, type HeadlessGameOrchestratorSimAccess } from "./headless-sim-access";
import { createSimEventCollector, type SimEventCollector } from "./sim-event-log";

/**
 * 与 {@link GameOrchestratorHooks} 键集一一对应；类型增删字段时此处必须同步，否则 `satisfies` 报错。
 * 用于运行时校验 noop 与契约测试导出（行动点 #0218）。
 */
const GAME_ORCHESTRATOR_HOOK_KEY_TABLE = {
  onPaletteChanged: true,
  syncTimeHud: true,
  syncTreesAndGroundItems: true,
  redrawStoneCells: true,
  redrawInteractionPoints: true,
  syncPawnViews: true,
  syncMarkerOverlay: true,
  syncHoverFromPointer: true,
  syncPawnDetailPanel: true
} as const satisfies Record<keyof GameOrchestratorHooks, true>;

const NOOP_HOOKS = {
  onPaletteChanged: () => {},
  syncTimeHud: () => {},
  syncTreesAndGroundItems: () => {},
  redrawStoneCells: () => {},
  redrawInteractionPoints: () => {},
  syncPawnViews: () => {},
  syncMarkerOverlay: () => {},
  syncHoverFromPointer: () => {},
  syncPawnDetailPanel: () => {}
} satisfies GameOrchestratorHooks;

for (const key of Object.keys(GAME_ORCHESTRATOR_HOOK_KEY_TABLE) as (keyof GameOrchestratorHooks)[]) {
  if (typeof NOOP_HOOKS[key] !== "function") {
    throw new Error(`headless-sim: GameOrchestratorHooks noop incomplete: ${String(key)}`);
  }
}

/**
 * 稳定排序的 hook 名列表；Phaser 场景 `hooks: { ... }` 仍由 `GameOrchestratorHooks` 类型约束，
 * 本列表供单测断言键集与 headless noop 同源，降低双路径漂移风险。
 */
export const GAME_ORCHESTRATOR_HOOK_KEYS_SORTED_FOR_CONTRACT: readonly (keyof GameOrchestratorHooks)[] = [
  ...Object.keys(GAME_ORCHESTRATOR_HOOK_KEY_TABLE)
].sort() as (keyof GameOrchestratorHooks)[];

const DEFAULT_HEADLESS_SEED = 0xdecafbad;

export type HeadlessSimOptions = Readonly<{
  /** 32-bit 种子，驱动模拟层 RNG。 */
  seed?: number;
  /** 世界与寻径用网格；默认 {@link DEFAULT_WORLD_GRID}。 */
  worldGrid?: WorldGridConfig;
  /**
   * 交互点模板（床位合并 restSpots 等）；省略时若 `worldGrid` 已含交互点则用之，否则套用默认关卡样板。
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

/** 与 `ScenarioDefinition.timeConfig` 同形；经 {@link createHeadlessSim} 写入 SimAccess 与世界时间快照。 */
export type HeadlessScenarioTimeConfig = Readonly<{
  startMinuteOfDay?: number;
  paused?: boolean;
  speed?: TimeSpeed;
}>;

export type HeadlessSim = Readonly<{
  tick: (deltaMs: number) => void;
  getTickCount: () => number;
  /** 领域世界时间（随 `tick` 推进）。 */
  getWorldTime: () => WorldTimeSnapshot;
  getPawns: () => readonly PawnState[];
  /**
   * 测试/场景夹具：在合法格内构造 `PawnState` 并追加到 SimAccess 小人列表；
   * 非经世界编排或地图侧统一「登场」路径，仅用于 headless 可重复初始状态。
   */
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
  /**
   * 应用场景初始时钟：`SimAccess.setTimeControlState` + {@link toWorldTimeSnapshot} 写回世界时间并对齐日内状态，
   * 避免在 `scenario-runner` 内旁路改写 `getTimeControlState()` 返回体或散落写 `world.time`。
   */
  applyScenarioTimeConfig: (config: HeadlessScenarioTimeConfig | undefined) => void;
}>;

export function createHeadlessSim(options: HeadlessSimOptions = {}): HeadlessSim {
  const seed = options.seed ?? DEFAULT_HEADLESS_SEED;
  const rng = createSeededRng(seed);
  const baseGrid = options.worldGrid ?? DEFAULT_WORLD_GRID;
  /**
   * 必须为可变 `Set` 实例并与 `WorldCore`/编排器共用同一引用语义，否则 `syncWorldGridForSimulation` 在 falsy
   * 或非 Set 时会跳过节流写入，石格/墙/蓝图占格无法反映到可走性。设计侧约定见 `oh-code-design/地图系统.yaml`
   * →「设计闭合」→「阻挡格集合可变性与仿真同步」（行动点 #0219）。
   */
  const worldGrid: WorldGridConfig = {
    ...baseGrid,
    blockedCellKeys: new Set(baseGrid.blockedCellKeys ?? [])
  };
  const interactionTemplate =
    options.interactionTemplate ??
    (worldGrid.interactionPoints.length > 0
      ? worldGrid
      : { ...worldGrid, interactionPoints: [...DEFAULT_SCENARIO_INTERACTION_POINTS] });
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

  /** @see HeadlessSim.spawnPawn */
  const spawnPawn = (name: string, cell: GridCoord, overrides?: Partial<PawnState>): PawnState => {
    if (!isInsideGrid(worldGrid, cell)) {
      throw new Error(`headless-sim: spawn cell out of grid (${cell.col},${cell.row})`);
    }
    const seq = nextPawnSeq++;
    const id = `pawn-${seq}`;
    const labeled = createFixturePawnState(name, cell, {
      id,
      fillColor: FIXTURE_PAWN_FILL_PALETTE[seq % FIXTURE_PAWN_FILL_PALETTE.length]!,
      overrides
    });
    registerPawnWithSimAccess(simAccess, labeled);
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

  const applyScenarioTimeConfig = (config: HeadlessScenarioTimeConfig | undefined): void => {
    if (config === undefined) return;
    const prevControls = simAccess.getTimeControlState();
    const controls = {
      paused: config.paused ?? prevControls.paused,
      speed: config.speed ?? prevControls.speed
    };
    simAccess.setTimeControlState(controls);
    let world = worldPort.getWorld();
    if (config.startMinuteOfDay !== undefined) {
      world = {
        ...world,
        timeConfig: { ...world.timeConfig, startMinuteOfDay: config.startMinuteOfDay }
      };
    }
    world = {
      ...world,
      time: toWorldTimeSnapshot(
        {
          dayNumber: world.time.dayNumber,
          minuteOfDay: config.startMinuteOfDay ?? world.time.minuteOfDay
        },
        controls,
        world.timeConfig
      )
    };
    worldPort.setWorld(world);
    simAccess.setTimeOfDayState({
      dayNumber: world.time.dayNumber,
      minuteOfDay: world.time.minuteOfDay
    });
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
    commitPlayerSelection: (input: PlayerSelectionCommitInput) => orchestrator.commitPlayerSelection(input),
    applyScenarioTimeConfig
  };
}
