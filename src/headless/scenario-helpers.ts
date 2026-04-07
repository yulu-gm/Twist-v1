/**
 * Headless 场景用 runUntil 谓词工厂、断言与常用 spawn 快捷方式。
 */

import type { GoalKind } from "../game/behavior/goal-driven-planning";
import { isResourceContainerKind } from "../game/entity/entity-types";
import { coordKey, isWalkableCell, type GridCoord } from "../game/map";
import { DEFAULT_PAWN_NAMES, type PawnId, type PawnState } from "../game/pawn-state";
import { getWorldSnapshot, removeWorldEntity } from "../game/world-core";
import { cleanupStaleTargetWorkItems } from "../game/world-work-tick";
import type { HeadlessSim } from "./headless-sim";
import type { SimEvent, SimEventKind } from "./sim-event-log";
import type { AssertionResult } from "./sim-reporter";

function sameCell(a: GridCoord, b: GridCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

function workSnapshot(sim: HeadlessSim) {
  return getWorldSnapshot(sim.getWorldPort().getWorld()).workItems;
}

/** 当前 tick 下小人已站在该格且未处于跨格移动中。 */
export function pawnReachesCell(sim: HeadlessSim, pawnId: PawnId, cell: GridCoord): () => boolean {
  return () => {
    const p = sim.getPawns().find((x) => x.id === pawnId);
    if (!p) return false;
    return p.moveTarget === undefined && sameCell(p.logicalCell, cell);
  };
}

/** 指定小人当前目标类型为 `goalKind`（对齐 {@link PawnState.currentGoal}）。 */
export function pawnStartsGoal(
  sim: HeadlessSim,
  pawnId: PawnId,
  goalKind: GoalKind
): () => boolean {
  return () => {
    const p = sim.getPawns().find((x) => x.id === pawnId);
    return p?.currentGoal?.kind === goalKind;
  };
}

/** 任意小人当前目标为 `goalKind`。 */
export function anyPawnStartsGoal(sim: HeadlessSim, goalKind: GoalKind): () => boolean {
  return () => sim.getPawns().some((p) => p.currentGoal?.kind === goalKind);
}

/**
 * 世界工单快照：列表为空，或全部为 `completed`。
 * `open` / `claimed` 存在时谓词为 false。
 */
export function allWorkCompleted(sim: HeadlessSim): () => boolean {
  return () => {
    const items = workSnapshot(sim);
    if (items.length === 0) return true;
    return items.every((w) => w.status === "completed");
  };
}

/**
 * 当前世界时间的 `minuteOfDay` 已达到或超过 `minuteOfDay`（与 {@link HeadlessSim.getWorldTime} 一致）。
 * 跨日时 `minuteOfDay` 会重置；跨日场景可配合 {@link dayReaches}。
 */
export function gameTimeReaches(sim: HeadlessSim, minuteOfDay: number): () => boolean {
  return () => sim.getWorldTime().minuteOfDay >= minuteOfDay;
}

export function dayReaches(sim: HeadlessSim, dayNumber: number): () => boolean {
  return () => sim.getWorldTime().dayNumber >= dayNumber;
}

const defaultAssertLabel = (prefix: string, detail: string): string => `${prefix}: ${detail}`;

export function assertEntityKindExists(
  sim: HeadlessSim,
  kind: string,
  minCount: number = 1,
  label: string = defaultAssertLabel("assertEntityKindExists", kind)
): AssertionResult {
  const n = Math.max(0, minCount);
  const count = [...sim.getWorldPort().getWorld().entities.values()].filter((e) => e.kind === kind).length;
  if (count >= n) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `实体 kind=${kind} 数量为 ${count}，期望至少 ${n}`
  };
}

export function assertEntityKindAbsent(
  sim: HeadlessSim,
  kind: string,
  label: string = defaultAssertLabel("assertEntityKindAbsent", kind)
): AssertionResult {
  const hit = [...sim.getWorldPort().getWorld().entities.values()].find((e) => e.kind === kind);
  if (!hit) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `不应存在 kind=${kind} 的实体（发现 id=${hit.id}）`
  };
}

export function assertResourceInContainer(
  sim: HeadlessSim,
  containerKind: string,
  label: string = defaultAssertLabel("assertResourceInContainer", containerKind)
): AssertionResult {
  if (!isResourceContainerKind(containerKind)) {
    return { passed: false, label, message: `非法 containerKind: ${containerKind}` };
  }
  const ok = [...sim.getWorldPort().getWorld().entities.values()].some(
    (e) => e.kind === "resource" && e.containerKind === containerKind
  );
  if (ok) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `未发现 containerKind=${containerKind} 的 resource 实体`
  };
}

export function assertPawnAtCell(
  sim: HeadlessSim,
  pawnId: PawnId,
  cell: GridCoord,
  label: string = defaultAssertLabel("assertPawnAtCell", pawnId)
): AssertionResult {
  const p = sim.getPawns().find((x) => x.id === pawnId);
  if (!p) {
    return { passed: false, label, message: `未找到 pawn ${pawnId}` };
  }
  if (p.moveTarget !== undefined) {
    return {
      passed: false,
      label,
      message: `pawn ${pawnId} 仍在移动（logicalCell 为起点格）`
    };
  }
  if (!sameCell(p.logicalCell, cell)) {
    return {
      passed: false,
      label,
      message: `pawn ${pawnId} 在 (${p.logicalCell.col},${p.logicalCell.row})，期望 (${cell.col},${cell.row})`
    };
  }
  return { passed: true, label, message: "ok" };
}

export function assertEventOccurred<K extends SimEventKind>(
  sim: HeadlessSim,
  kind: K,
  match?: (event: Extract<SimEvent, { kind: K }>) => boolean,
  label: string = defaultAssertLabel("assertEventOccurred", kind)
): AssertionResult {
  const list = sim.getSimEventCollector().getEventsByKind(kind) as ReadonlyArray<
    Extract<SimEvent, { kind: K }>
  >;
  const hit = match === undefined ? list.length > 0 : list.some(match);
  if (hit) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message:
      match === undefined
        ? `未发现任何 kind=${kind} 的事件`
        : `未发现满足条件的 kind=${kind} 事件（共 ${list.length} 条同 kind）`
  };
}

export function assertEventSequence(
  sim: HeadlessSim,
  expectedKinds: readonly SimEventKind[],
  label: string = defaultAssertLabel("assertEventSequence", expectedKinds.join(" -> "))
): AssertionResult {
  const events = sim.getSimEventCollector().getEvents();
  let matched = 0;
  for (const event of events) {
    if (event.kind !== expectedKinds[matched]) continue;
    matched += 1;
    if (matched === expectedKinds.length) {
      return { passed: true, label, message: "ok" };
    }
  }
  return {
    passed: false,
    label,
    message: `matched ${matched}/${expectedKinds.length} events, actual=${events.map((e) => e.kind).join(", ")}`
  };
}

export function assertWorkItemCompleted(
  sim: HeadlessSim,
  workItemId: string,
  label: string = defaultAssertLabel("assertWorkItemCompleted", workItemId)
): AssertionResult {
  const w = workSnapshot(sim).find((x) => x.id === workItemId);
  if (!w) {
    return { passed: false, label, message: `工单 ${workItemId} 不存在` };
  }
  if (w.status !== "completed") {
    return {
      passed: false,
      label,
      message: `工单 ${workItemId} 状态为 ${w.status}，期望 completed`
    };
  }
  return { passed: true, label, message: "ok" };
}

/** 所有小人 `satiety > 0`（0 视为饿死阈值）。 */
export function assertNoPawnStarved(
  sim: HeadlessSim,
  label: string = "assertNoPawnStarved"
): AssertionResult {
  const bad = sim.getPawns().filter((p) => p.satiety <= 0);
  if (bad.length === 0) {
    return { passed: true, label, message: "ok" };
  }
  const ids = bad.map((p) => p.id).join(", ");
  return {
    passed: false,
    label,
    message: `以下 pawn 饱食度<=0（可能饿死）：${ids}`
  };
}

/**
 * 场景用：模拟目标实体在作业中途被外部移除。经 {@link removeWorldEntity} 写入世界（与运行时一致：
 * 占用格、`restSpots` 等与实体移除对齐），并立即执行 {@link cleanupStaleTargetWorkItems}，等同
 * {@link GameOrchestrator} 每 tick 开头的 stale-target 工单清理与小人工单字段复位。
 */
export function invalidateScenarioEntity(sim: HeadlessSim, entityId: string): boolean {
  const world = sim.getWorldPort().getWorld();
  const { world: afterRemove, outcome } = removeWorldEntity(world, entityId);
  if (outcome.kind === "missing-entity") {
    return false;
  }
  sim.getWorldPort().setWorld(afterRemove);
  const stale = cleanupStaleTargetWorkItems(afterRemove, sim.getPawns());
  if (stale.changed) {
    sim.getWorldPort().setWorld(stale.world);
    sim.getSimAccess().setPawns(stale.pawns);
  }
  return true;
}

/**
 * 在世界网格上于可走、边界内格子上生成若干默认小人；优先使用 `grid.defaultSpawnPoints` 前 `count` 格。
 * @param count 默认 3
 */
export function spawnDefaultColony(sim: HeadlessSim, count: number = 3): readonly PawnState[] {
  if (count < 0) {
    throw new Error("spawnDefaultColony: count must be non-negative");
  }
  const grid = sim.getWorldPort().getWorld().grid;
  const out: PawnState[] = [];
  const used = new Set<string>();

  const trySpawn = (cell: GridCoord, name: string): boolean => {
    const key = coordKey(cell);
    if (!isWalkableCell(grid, cell) || used.has(key)) return false;
    used.add(key);
    out.push(sim.spawnPawn(name, cell));
    return true;
  };

  for (const cell of grid.defaultSpawnPoints) {
    if (out.length >= count) break;
    const name = DEFAULT_PAWN_NAMES[out.length % DEFAULT_PAWN_NAMES.length]!;
    trySpawn(cell, name);
  }

  for (let row = 0; row < grid.rows && out.length < count; row++) {
    for (let col = 0; col < grid.columns && out.length < count; col++) {
      const cell: GridCoord = { col, row };
      const name = DEFAULT_PAWN_NAMES[out.length % DEFAULT_PAWN_NAMES.length]!;
      trySpawn(cell, name);
    }
  }

  if (out.length < count) {
    throw new Error(
      `spawnDefaultColony: 无法在网格上放置 ${count} 名小人（仅成功 ${out.length}）`
    );
  }

  return out;
}
