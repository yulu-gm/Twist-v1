/**
 * 将 {@link ScenarioDefinition} 写入 {@link WorldCore}，并生成与场景顺序一致的初始 {@link PawnState}
 * （与 `headless-sim` 的调色板与 `pawn-*` id 约定一致，供 GameOrchestrator / 场景注入）。
 *
 * 不依赖 Phaser、不引用 `headless-sim`（避免与 headless 层循环依赖）。
 */

import type { ScenarioDefinition } from "../headless/scenario-types";
import { commitPlayerSelectionToWorld } from "./commit-player-intent";
import { WorldCoreWorldPort } from "./world-core-world-port";
import { createGameplayTreeDraft } from "../game/entity/gameplay-tree-spawn";
import {
  claimWorkItem,
  cloneWorldCoreState,
  placeBlueprint,
  removeWorldEntitiesOccupyingCells,
  spawnWorldEntity,
  type WorldCore
} from "../game/world-core";
import { coordKey, isInsideGrid, type WorldGridConfig } from "../game/map";
import {
  DEFAULT_PAWN_NEEDS,
  describePawnDebugLabel,
  type PawnState
} from "../game/pawn-state";
import { toWorldTimeSnapshot } from "../game/time/world-time";
import { ALL_SCENARIOS } from "../../scenarios";

const PAWN_FILL_PALETTE = [0xe07a5f, 0x81b29a, 0x3d405b, 0xf2cc8f, 0x9b5de5] as const;

function gridMatchesScenario(worldGrid: WorldGridConfig, scenarioGrid: WorldGridConfig): boolean {
  return (
    worldGrid.columns === scenarioGrid.columns &&
    worldGrid.rows === scenarioGrid.rows &&
    worldGrid.cellSizePx === scenarioGrid.cellSizePx
  );
}

function applyScenarioTime(world: WorldCore, timeConfig: ScenarioDefinition["timeConfig"]): void {
  if (timeConfig?.startMinuteOfDay === undefined) return;
  world.timeConfig = { ...world.timeConfig, startMinuteOfDay: timeConfig.startMinuteOfDay };
  world.time = toWorldTimeSnapshot(
    { dayNumber: world.time.dayNumber, minuteOfDay: timeConfig.startMinuteOfDay },
    { paused: world.time.paused, speed: world.time.speed }
  );
}

function buildPawnStatesForScenario(def: ScenarioDefinition): PawnState[] {
  return def.pawns.map((p, i) => {
    const base: PawnState = {
      id: `pawn-${i}`,
      name: p.name,
      logicalCell: { col: p.cell.col, row: p.cell.row },
      moveTarget: undefined,
      moveProgress01: 0,
      fillColor: PAWN_FILL_PALETTE[i % PAWN_FILL_PALETTE.length]!,
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
    const merged: PawnState = p.overrides
      ? { ...base, ...p.overrides, id: base.id, logicalCell: base.logicalCell, name: base.name }
      : base;
    return {
      ...merged,
      debugLabel: describePawnDebugLabel(merged)
    };
  });
}

export type ScenarioLoadResult = Readonly<{
  /** 更新后的世界；调用方应以此替换原 `WorldCore` 引用（与 `applyDomainCommandToWorldCore` 相同惯例）。 */
  world: WorldCore;
  /** 与 `def.pawns` 顺序一致；`satiety` / `energy` 已应用 `overrides`。 */
  pawnStates: PawnState[];
}>;

/**
 * 将场景定义载入世界：`pawns` / `blueprints` / `obstacles` / 可调时间；忽略 `expectations`。
 *
 * 在写入 obstacle / tree / blueprint / pawn 前，会先对对应 footprint **移除已有占格实体**（与单测 headless、浏览器热切换共用），
 * 避免随机地形石、上一状态残留或与定义顺序冲突导致占格失败（后写入的格点覆盖前者）。
 *
 * `domainCommandsAfterHydrate` / `playerSelectionAfterHydrate` 在认领前应用，与无头 `hydrateScenario` 一致；
 * `playerSelectionAfterHydrate` 走 `commitPlayerSelectionToWorld`（与实机命令菜单 `commandId` + 选区形态一致）。
 * `claimConstructBlueprintAsPawnName`：按小人名认领首个 open 的 construct-blueprint（`pawnStates` 的 id 为 `pawn-${索引}`）。
 * `def.seed` 仅影响 headless RNG，WorldCore 无对应字段，此处不处理。
 */
export function loadScenarioIntoGame(world: WorldCore, def: ScenarioDefinition): ScenarioLoadResult {
  let w = cloneWorldCoreState(world);

  if (def.gridConfig !== undefined && !gridMatchesScenario(w.grid, def.gridConfig)) {
    throw new Error(
      "scenario-loader: gridConfig 与当前 world.grid 不一致（columns/rows/cellSizePx）；请在 createWorldCore 时使用相同网格或省略 def.gridConfig"
    );
  }

  applyScenarioTime(w, def.timeConfig);

  const grid = w.grid;

  for (const obs of def.obstacles ?? []) {
    if (!isInsideGrid(grid, obs.cell)) {
      throw new Error(`scenario-loader: obstacle 越界 (${obs.cell.col},${obs.cell.row})`);
    }
    w = removeWorldEntitiesOccupyingCells(w, [obs.cell]);
    const spawned = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: obs.cell,
      occupiedCells: [obs.cell],
      label: obs.label ?? "scenario-obstacle"
    });
    if (spawned.outcome.kind !== "created") {
      const reason =
        spawned.outcome.kind === "conflict"
          ? `与 ${spawned.outcome.blockingEntityId} 占格冲突`
          : `越界 (${spawned.outcome.cell.col},${spawned.outcome.cell.row})`;
      throw new Error(`scenario-loader: 无法生成 obstacle — ${reason}`);
    }
    w = spawned.world;
  }

  for (let ti = 0; ti < (def.trees ?? []).length; ti++) {
    const t = def.trees![ti]!;
    if (!isInsideGrid(grid, t.cell)) {
      throw new Error(`scenario-loader: tree 越界 (${t.cell.col},${t.cell.row})`);
    }
    w = removeWorldEntitiesOccupyingCells(w, [t.cell]);
    const spawned = spawnWorldEntity(
      w,
      createGameplayTreeDraft(t.cell, `scenario-tree-${coordKey(t.cell)}-${ti}`)
    );
    if (spawned.outcome.kind !== "created") {
      const reason =
        spawned.outcome.kind === "conflict"
          ? `与 ${spawned.outcome.blockingEntityId} 占格冲突`
          : `越界 (${spawned.outcome.cell.col},${spawned.outcome.cell.row})`;
      throw new Error(`scenario-loader: 无法生成 tree — ${reason}`);
    }
    w = spawned.world;
  }

  for (const bp of def.blueprints ?? []) {
    if (!isInsideGrid(grid, bp.cell)) {
      throw new Error(`scenario-loader: blueprint 越界 (${bp.cell.col},${bp.cell.row})`);
    }
    w = removeWorldEntitiesOccupyingCells(w, [bp.cell]);
    const placed = placeBlueprint(w, { buildingKind: bp.kind, cell: bp.cell });
    w = placed.world;
  }

  for (const p of def.pawns) {
    if (!isInsideGrid(grid, p.cell)) {
      throw new Error(`scenario-loader: pawn 越界 (${p.cell.col},${p.cell.row})`);
    }
    w = removeWorldEntitiesOccupyingCells(w, [p.cell]);
    const spawned = spawnWorldEntity(w, {
      kind: "pawn",
      cell: p.cell,
      occupiedCells: [p.cell],
      label: p.name
    });
    if (spawned.outcome.kind !== "created") {
      const reason =
        spawned.outcome.kind === "conflict"
          ? `与 ${spawned.outcome.blockingEntityId} 占格冲突`
          : `越界 (${spawned.outcome.cell.col},${spawned.outcome.cell.row})`;
      throw new Error(`scenario-loader: 无法生成 pawn「${p.name}」— ${reason}`);
    }
    w = spawned.world;
  }

  const port = new WorldCoreWorldPort(w);
  for (const cmd of def.domainCommandsAfterHydrate ?? []) {
    port.submit(cmd, 0);
  }
  for (const sel of def.playerSelectionAfterHydrate ?? []) {
    commitPlayerSelectionToWorld(port, {
      commandId: sel.commandId,
      selectionModifier: sel.selectionModifier,
      cellKeys: new Set(sel.cellKeys),
      inputShape: sel.inputShape,
      currentMarkers: new Map(),
      nowMs: 0
    });
  }
  w = port.getWorld();

  const claimerName = def.claimConstructBlueprintAsPawnName;
  if (claimerName) {
    const idx = def.pawns.findIndex((p) => p.name === claimerName);
    if (idx >= 0) {
      const pawnId = `pawn-${idx}`;
      const work = [...w.workItems.values()].find(
        (x) => x.kind === "construct-blueprint" && x.status === "open"
      );
      if (work) {
        const { world: wClaimed, outcome } = claimWorkItem(w, work.id, pawnId);
        if (outcome.kind === "claimed") {
          w = wClaimed;
        }
      }
    }
  }

  return {
    world: w,
    pawnStates: buildPawnStatesForScenario(def)
  };
}

/** 自 `scenarios/index` 静态汇总的导出列表（无运行时 fs）。 */
export function listAvailableScenarios(): ScenarioDefinition[] {
  return [...ALL_SCENARIOS];
}
