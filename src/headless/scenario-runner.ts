/**
 * Headless 场景装载与按期望运行：无 Phaser。
 */

import type { ResourceContainerKind } from "../game/entity/entity-types";
import { createGameplayTreeDraft } from "../game/entity/gameplay-tree-spawn";
import { claimWorkItem, placeBlueprint, spawnWorldEntity } from "../game/world-core";
import { isInsideGrid } from "../game/map";
import type { SpawnOutcome } from "../game/world-internal";
import { applyScenarioResourcesToWorld, applyScenarioZonesToWorld } from "../player/scenario-zone-resource-spawn";
import type { PawnState } from "../game/pawn-state";
import { isSimEventKind } from "./sim-event-log";
import { createHeadlessSim, type HeadlessSim } from "./headless-sim";
import type { AssertionResult, SimReport } from "./sim-reporter";
import { generateReport } from "./sim-reporter";
import type { ScenarioDefinition, ScenarioExpectation } from "./scenario-types";
import {
  recordScenarioPlayerSelection,
  resolveScenarioPlayerInputSemantic,
  type ScenarioHydrationResult,
  type ScenarioPlayerSelectionRecord
} from "./scenario-observers";

const DEFAULT_EXPECTATION_MAX_TICKS = 500;

function isResourceContainerKind(value: string): value is ResourceContainerKind {
  return value === "ground" || value === "pawn" || value === "zone" || value === "building";
}

function throwUnlessSpawnCreated(kind: string, outcome: SpawnOutcome, detail: string): void {
  if (outcome.kind === "created") return;
  const reason =
    outcome.kind === "conflict"
      ? `与 ${outcome.blockingEntityId} 占格冲突`
      : outcome.kind === "invalid-draft"
        ? outcome.reason
        : `越界 (${outcome.cell.col},${outcome.cell.row})`;
  throw new Error(`scenario-runner: failed to spawn ${kind} (${detail}): ${reason}`);
}

function selectPawnsForExpectation(
  sim: HeadlessSim,
  params: Record<string, unknown>
): readonly PawnState[] {
  const all = sim.getPawns();
  const pawnId = params.pawnId;
  if (typeof pawnId === "string") {
    const p = all.find((x) => x.id === pawnId);
    return p ? [p] : [];
  }
  const pawnName = params.pawnName;
  if (typeof pawnName === "string") {
    const p = all.find((x) => x.name === pawnName);
    return p ? [p] : [];
  }
  return all;
}

function expectationSatisfied(sim: HeadlessSim, exp: ScenarioExpectation): boolean {
  const params = exp.params;
  switch (exp.type) {
    case "pawn-reaches-goal": {
      const goalKind = params.goalKind;
      if (typeof goalKind !== "string") return false;
      const selected = selectPawnsForExpectation(sim, params);
      if (params.pawnId !== undefined || params.pawnName !== undefined) {
        if (selected.length === 0) return false;
        return selected.every((p) => p.currentGoal?.kind === goalKind);
      }
      const relevant = sim.getPawns();
      if (relevant.length === 0) return false;
      return relevant.some((p) => p.currentGoal?.kind === goalKind);
    }
    case "event-occurred": {
      const raw = params.eventKind ?? params.kind;
      if (typeof raw !== "string" || !isSimEventKind(raw)) return false;
      return sim.getSimEventCollector().getEvents().some((e) => e.kind === raw);
    }
    case "no-pawn-starved": {
      const minSatiety = typeof params.minSatiety === "number" ? params.minSatiety : 1;
      return sim.getPawns().every((p) => p.satiety >= minSatiety);
    }
    case "work-item-exists": {
      const items = [...sim.getWorldPort().getWorld().workItems.values()];
      const workKind = params.workKind ?? params.kind;
      const status = params.status;
      return items.some((w) => {
        if (typeof workKind === "string" && w.kind !== workKind) return false;
        if (typeof status === "string" && w.status !== status) return false;
        return true;
      });
    }
    case "building-present": {
      const bk = params.buildingKind;
      const cell = params.cell as { col?: unknown; row?: unknown } | undefined;
      if (typeof bk !== "string" || !cell || typeof cell.col !== "number" || typeof cell.row !== "number") {
        return false;
      }
      return [...sim.getWorldPort().getWorld().entities.values()].some(
        (e) =>
          e.kind === "building" &&
          e.buildingKind === bk &&
          e.cell.col === cell.col &&
          e.cell.row === cell.row
      );
    }
    case "entity-kind-exists": {
      const k = params.entityKind;
      if (typeof k !== "string") return false;
      const minCount = typeof params.count === "number" ? Math.max(0, params.count) : 1;
      const n = [...sim.getWorldPort().getWorld().entities.values()].filter((e) => e.kind === k).length;
      return n >= minCount;
    }
    case "entity-kind-absent": {
      const k = params.entityKind;
      if (typeof k !== "string") return false;
      const cell = params.cell as { col?: unknown; row?: unknown } | undefined;
      const entities = [...sim.getWorldPort().getWorld().entities.values()];
      if (cell && typeof cell.col === "number" && typeof cell.row === "number") {
        return !entities.some(
          (e) => e.kind === k && e.cell.col === cell.col && e.cell.row === cell.row
        );
      }
      return !entities.some((e) => e.kind === k);
    }
    case "resource-in-container": {
      const ck = params.containerKind;
      if (typeof ck !== "string" || !isResourceContainerKind(ck)) return false;
      const mk = params.materialKind;
      return [...sim.getWorldPort().getWorld().entities.values()].some(
        (e) =>
          e.kind === "resource" &&
          e.containerKind === ck &&
          (typeof mk !== "string" || e.materialKind === mk)
      );
    }
    case "work-item-completed-kind": {
      const k = params.workKind;
      if (typeof k !== "string") return false;
      return [...sim.getWorldPort().getWorld().workItems.values()].some(
        (w) => w.kind === k && w.status === "completed"
      );
    }
    case "custom": {
      return params.immediatePass === true;
    }
    default:
      return false;
  }
}

function runSingleExpectation(
  sim: HeadlessSim,
  exp: ScenarioExpectation
): AssertionResult {
  const maxTicks = exp.maxTicks ?? DEFAULT_EXPECTATION_MAX_TICKS;
  if (expectationSatisfied(sim, exp)) {
    return { passed: true, label: exp.label, message: "ok" };
  }
  const run = sim.runUntil(() => expectationSatisfied(sim, exp), { maxTicks });
  if (run.reachedPredicate) {
    return { passed: true, label: exp.label, message: "ok" };
  }
  return {
    passed: false,
    label: exp.label,
    message: `在 ${maxTicks} tick 内未满足期望（${exp.type}）`
  };
}

export function runAllExpectations(
  sim: HeadlessSim,
  expectations: readonly ScenarioExpectation[]
): AssertionResult[] {
  return expectations.map((exp) => runSingleExpectation(sim, exp));
}

/**
 * 将场景定义写入现有模拟：时间、pawns、蓝图、障碍物。
 */
export function hydrateScenario(sim: HeadlessSim, def: ScenarioDefinition): ScenarioHydrationResult {
  const grid = sim.getWorldPort().getWorld().grid;
  sim.applyScenarioTimeConfig(def.timeConfig);
  if (def.worldPortConfig) {
    sim.getWorldPort().applyMockConfig({
      alwaysAccept: def.worldPortConfig.alwaysAccept,
      rejectIfTouchesCellKeys:
        def.worldPortConfig.rejectIfTouchesCellKeys !== undefined
          ? new Set(def.worldPortConfig.rejectIfTouchesCellKeys)
          : undefined
    });
  }
  const playerSelections: ScenarioPlayerSelectionRecord[] = [];

  let world = sim.getWorldPort().getWorld();
  for (const obs of def.obstacles ?? []) {
    if (!isInsideGrid(grid, obs.cell)) {
      throw new Error(`scenario-runner: obstacle cell out of grid (${obs.cell.col},${obs.cell.row})`);
    }
    const spawned = spawnWorldEntity(world, {
      kind: "obstacle",
      cell: obs.cell,
      occupiedCells: [obs.cell],
      label: obs.label ?? "scenario-obstacle"
    });
    if (spawned.outcome.kind !== "created") {
      const reason =
        spawned.outcome.kind === "conflict"
          ? `与 ${spawned.outcome.blockingEntityId} 占格冲突`
          : spawned.outcome.kind === "invalid-draft"
            ? spawned.outcome.reason
            : `越界 (${spawned.outcome.cell.col},${spawned.outcome.cell.row})`;
      throw new Error(`scenario-runner: failed to spawn obstacle: ${reason}`);
    }
    world = spawned.world;
  }
  sim.getWorldPort().setWorld(world);

  world = sim.getWorldPort().getWorld();
  world = applyScenarioZonesToWorld(world, def.zones, grid, "scenario-runner");
  sim.getWorldPort().setWorld(world);

  world = sim.getWorldPort().getWorld();
  for (let ti = 0; ti < (def.trees ?? []).length; ti++) {
    const t = def.trees![ti]!;
    if (!isInsideGrid(grid, t.cell)) {
      throw new Error(`scenario-runner: tree cell out of grid (${t.cell.col},${t.cell.row})`);
    }
    const spawned = spawnWorldEntity(world, createGameplayTreeDraft(t.cell, `scenario-tree-${ti}`));
    throwUnlessSpawnCreated("tree", spawned.outcome, `#${ti}`);
    world = spawned.world;
  }
  sim.getWorldPort().setWorld(world);

  world = sim.getWorldPort().getWorld();
  world = applyScenarioResourcesToWorld(world, def.resources, grid, "scenario-runner");
  sim.getWorldPort().setWorld(world);

  for (const bp of def.blueprints ?? []) {
    if (!isInsideGrid(grid, bp.cell)) {
      throw new Error(`scenario-runner: blueprint cell out of grid (${bp.cell.col},${bp.cell.row})`);
    }
    const w = sim.getWorldPort().getWorld();
    const placed = placeBlueprint(w, { buildingKind: bp.kind, cell: bp.cell });
    sim.getWorldPort().setWorld(placed.world);
  }

  for (const p of def.pawns) {
    sim.spawnPawn(p.name, p.cell, p.overrides);
  }

  if (def.domainCommandsAfterHydrate) {
    for (const cmd of def.domainCommandsAfterHydrate) {
      sim.getWorldPort().submit(cmd, 0);
    }
  }

  if (def.playerSelectionAfterHydrate) {
    let currentMarkers = new Map<string, string>();
    for (const sel of def.playerSelectionAfterHydrate) {
      const semantic = resolveScenarioPlayerInputSemantic(sel);
      if (semantic === "no-tool") {
        playerSelections.push(recordScenarioPlayerSelection(sel));
        continue;
      }
      const outcome = sim.commitPlayerSelection({
        commandId: sel.commandId,
        selectionModifier: sel.selectionModifier,
        cellKeys: new Set(sel.cellKeys),
        inputShape: sel.inputShape,
        currentMarkers,
        nowMs: 0
      });
      currentMarkers = outcome.nextMarkers;
      playerSelections.push(recordScenarioPlayerSelection(sel, outcome));
    }
  }

  const claimerName = def.claimConstructBlueprintAsPawnName;
  if (claimerName) {
    const pawn = sim.getPawns().find((x) => x.name === claimerName);
    if (!pawn) {
      throw new Error(
        `scenario-runner: claimConstructBlueprintAsPawnName="${claimerName}" but no pawn with that name exists`
      );
    }
    const work = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (w) => w.kind === "construct-blueprint" && w.status === "open"
    );
    if (!work) {
      throw new Error(
        "scenario-runner: claimConstructBlueprintAsPawnName set but no open construct-blueprint work item exists"
      );
    }
    const { world, outcome } = claimWorkItem(sim.getWorldPort().getWorld(), work.id, pawn.id);
    if (outcome.kind === "already-claimed") {
      throw new Error(
        `scenario-runner: failed to claim construct-blueprint work (already claimed by ${outcome.claimedBy})`
      );
    }
    if (outcome.kind === "missing-work-item") {
      throw new Error("scenario-runner: failed to claim construct-blueprint work (work item missing)");
    }
    sim.getWorldPort().setWorld(world);
  }

  return {
    playerSelections
  };
}

export type ScenarioHeadlessRunResult = Readonly<{
  sim: HeadlessSim;
  report: SimReport;
  results: readonly AssertionResult[];
  hydration: ScenarioHydrationResult;
}>;

/**
 * 构造 headless 模拟、装载场景、按顺序跑每条 expectation（默认每条约 500 tick 上限），再生成报告。
 */
export function runScenarioHeadless(def: ScenarioDefinition): ScenarioHeadlessRunResult {
  const sim = createHeadlessSim({
    seed: def.seed,
    worldGrid: def.gridConfig
  });
  const hydration = hydrateScenario(sim, def);
  for (const deltaMs of def.tickScheduleAfterHydrate ?? []) {
    sim.tick(deltaMs);
  }
  const results = runAllExpectations(sim, def.expectations ?? []);
  const baseReport = generateReport(sim);
  const report: SimReport = { ...baseReport, assertionResults: results };
  return { sim, report, results, hydration };
}
