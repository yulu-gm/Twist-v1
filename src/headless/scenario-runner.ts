/**
 * Headless 场景装载与按期望运行：无 Phaser。
 */

import type { ResourceContainerKind, ResourceMaterialKind, ZoneKind } from "../game/entity/entity-types";
import { claimWorkItem, placeBlueprint, spawnWorldEntity } from "../game/world-core";
import { coordKey, isInsideGrid, type GridCoord } from "../game/map/world-grid";
import type { SpawnOutcome } from "../game/world-internal";
import { validateZoneCells } from "../game/map/zone-manager";
import type { PawnState } from "../game/pawn-state";
import type { SimEventKind } from "./sim-event-log";
import { toWorldTimeSnapshot } from "../game/time/world-time";
import { createHeadlessSim, type HeadlessSim } from "./headless-sim";
import type { AssertionResult, SimReport } from "./sim-reporter";
import { generateReport } from "./sim-reporter";
import type { ScenarioDefinition, ScenarioExpectation } from "./scenario-types";

const DEFAULT_EXPECTATION_MAX_TICKS = 500;

const RESOURCE_MATERIAL_KINDS = new Set<ResourceMaterialKind>(["wood", "food", "generic"]);

const ZONE_KINDS = new Set<ZoneKind>(["storage", "forbidden", "priority-build", "custom"]);

function parseScenarioResourceMaterialKind(raw: string): ResourceMaterialKind {
  if (RESOURCE_MATERIAL_KINDS.has(raw as ResourceMaterialKind)) {
    return raw as ResourceMaterialKind;
  }
  throw new Error(`scenario-runner: unknown resource materialKind "${raw}"`);
}

function parseScenarioZoneKind(raw: string | undefined): ZoneKind {
  if (raw === undefined) {
    return "custom";
  }
  if (ZONE_KINDS.has(raw as ZoneKind)) {
    return raw as ZoneKind;
  }
  throw new Error(`scenario-runner: unknown zoneKind "${raw}"`);
}

function uniqueGridCoords(cells: readonly GridCoord[]): GridCoord[] {
  const seen = new Set<string>();
  const out: GridCoord[] = [];
  for (const c of cells) {
    const k = coordKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ col: c.col, row: c.row });
  }
  return out;
}

function isResourceContainerKind(value: string): value is ResourceContainerKind {
  return value === "ground" || value === "pawn" || value === "zone" || value === "building";
}

function throwUnlessSpawnCreated(kind: string, outcome: SpawnOutcome, detail: string): void {
  if (outcome.kind === "created") return;
  const reason =
    outcome.kind === "conflict"
      ? `与 ${outcome.blockingEntityId} 占格冲突`
      : `越界 (${outcome.cell.col},${outcome.cell.row})`;
  throw new Error(`scenario-runner: failed to spawn ${kind} (${detail}): ${reason}`);
}

function isSimEventKind(value: string): value is SimEventKind {
  return (
    value === "pawn-moved" ||
    value === "pawn-motion-changed" ||
    value === "pawn-goal-changed" ||
    value === "pawn-action-changed" ||
    value === "pawn-need-changed" ||
    value === "work-created" ||
    value === "work-claimed" ||
    value === "work-completed" ||
    value === "entity-spawned" ||
    value === "entity-removed"
  );
}

function applyScenarioTime(sim: HeadlessSim, timeConfig: ScenarioDefinition["timeConfig"]): void {
  if (timeConfig?.startMinuteOfDay === undefined) return;
  const world = sim.getWorldPort().getWorld();
  world.timeConfig = { ...world.timeConfig, startMinuteOfDay: timeConfig.startMinuteOfDay };
  world.time = toWorldTimeSnapshot(
    { dayNumber: world.time.dayNumber, minuteOfDay: timeConfig.startMinuteOfDay },
    { paused: world.time.paused, speed: world.time.speed }
  );
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
      return ![...sim.getWorldPort().getWorld().entities.values()].some((e) => e.kind === k);
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
export function hydrateScenario(sim: HeadlessSim, def: ScenarioDefinition): void {
  const grid = sim.getWorldPort().getWorld().grid;
  applyScenarioTime(sim, def.timeConfig);

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
          : `越界 (${spawned.outcome.cell.col},${spawned.outcome.cell.row})`;
      throw new Error(`scenario-runner: failed to spawn obstacle: ${reason}`);
    }
    world = spawned.world;
  }
  sim.getWorldPort().setWorld(world);

  world = sim.getWorldPort().getWorld();
  for (let zi = 0; zi < (def.zones ?? []).length; zi++) {
    const z = def.zones![zi]!;
    const cellsRaw = z.cells;
    if (cellsRaw.length === 0) {
      throw new Error("scenario-runner: zone cells must be non-empty");
    }
    const cells = uniqueGridCoords(cellsRaw);
    if (cells.length === 0) {
      throw new Error("scenario-runner: zone cells must be non-empty");
    }
    for (const c of cells) {
      if (!isInsideGrid(grid, c)) {
        throw new Error(`scenario-runner: zone cell out of grid (${c.col},${c.row})`);
      }
    }
    const validation = validateZoneCells(cells, world.occupancy);
    if (!validation.ok) {
      const cellInfo =
        validation.reason === "cell_occupied" && validation.cell
          ? ` (${validation.cell.col},${validation.cell.row}) occupant=${validation.occupantId ?? "?"}`
          : validation.cell
            ? ` (${validation.cell.col},${validation.cell.row})`
            : "";
      throw new Error(`scenario-runner: zone #${zi} validation failed: ${validation.reason}${cellInfo}`);
    }
    const zoneKind = parseScenarioZoneKind(z.zoneKind);
    const spawned = spawnWorldEntity(world, {
      kind: "zone",
      cell: cells[0]!,
      coveredCells: cells,
      occupiedCells: [],
      zoneKind,
      acceptedMaterialKinds: [],
      label: `scenario-zone-${zoneKind}-${zi}`
    });
    throwUnlessSpawnCreated("zone", spawned.outcome, `#${zi}`);
    world = spawned.world;
  }
  sim.getWorldPort().setWorld(world);

  world = sim.getWorldPort().getWorld();
  for (let ti = 0; ti < (def.trees ?? []).length; ti++) {
    const t = def.trees![ti]!;
    if (!isInsideGrid(grid, t.cell)) {
      throw new Error(`scenario-runner: tree cell out of grid (${t.cell.col},${t.cell.row})`);
    }
    const spawned = spawnWorldEntity(world, {
      kind: "tree",
      cell: t.cell,
      occupiedCells: [t.cell],
      loggingMarked: false,
      label: `scenario-tree-${ti}`
    });
    throwUnlessSpawnCreated("tree", spawned.outcome, `#${ti}`);
    world = spawned.world;
  }
  sim.getWorldPort().setWorld(world);

  world = sim.getWorldPort().getWorld();
  for (let ri = 0; ri < (def.resources ?? []).length; ri++) {
    const r = def.resources![ri]!;
    if (!isInsideGrid(grid, r.cell)) {
      throw new Error(`scenario-runner: resource cell out of grid (${r.cell.col},${r.cell.row})`);
    }
    const materialKind = parseScenarioResourceMaterialKind(r.materialKind);
    const spawned = spawnWorldEntity(world, {
      kind: "resource",
      cell: r.cell,
      occupiedCells: [r.cell],
      materialKind,
      containerKind: "ground",
      pickupAllowed: r.pickupAllowed ?? true,
      label: `scenario-resource-${materialKind}-${ri}`
    });
    throwUnlessSpawnCreated("resource", spawned.outcome, `#${ri}`);
    world = spawned.world;
  }
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

  const claimerName = def.claimConstructBlueprintAsPawnName;
  if (claimerName) {
    const pawn = sim.getPawns().find((x) => x.name === claimerName);
    const work = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (w) => w.kind === "construct-blueprint" && w.status === "open"
    );
    if (pawn && work) {
      const { world, outcome } = claimWorkItem(sim.getWorldPort().getWorld(), work.id, pawn.id);
      if (outcome.kind === "claimed") {
        sim.getWorldPort().setWorld(world);
      }
    }
  }
}

export type ScenarioHeadlessRunResult = Readonly<{
  sim: HeadlessSim;
  report: SimReport;
  results: readonly AssertionResult[];
}>;

/**
 * 构造 headless 模拟、装载场景、按顺序跑每条 expectation（默认每条约 500 tick 上限），再生成报告。
 */
export function runScenarioHeadless(def: ScenarioDefinition): ScenarioHeadlessRunResult {
  const sim = createHeadlessSim({
    seed: def.seed,
    worldGrid: def.gridConfig
  });
  hydrateScenario(sim, def);
  const results = runAllExpectations(sim, def.expectations ?? []);
  const baseReport = generateReport(sim);
  const report: SimReport = { ...baseReport, assertionResults: results };
  return { sim, report, results };
}