/**
 * Headless 模拟只读快照与断言汇总（不修改 sim、不依赖 Phaser）。
 */

import type { PawnState } from "../game/pawn-state";
import type { WorldTimeSnapshot } from "../game/time/world-time";
import type { HeadlessSim } from "./headless-sim";
import type { SimEventSummary } from "./sim-event-log";

/** 小人当前状态摘要，供报告与人类阅读。 */
export type PawnSummary = Readonly<{
  id: string;
  name: string;
  logicalCell: Readonly<{ col: number; row: number }>;
  moveTarget: Readonly<{ col: number; row: number }> | undefined;
  moveProgress01: number;
  satiety: number;
  energy: number;
  needs: Readonly<{ hunger: number; rest: number; recreation: number }>;
  currentGoalKind: string | undefined;
  currentActionKind: string | undefined;
  debugLabel: string;
}>;

/** 单条断言的求值结果。 */
export type AssertionResult = Readonly<{
  passed: boolean;
  label: string;
  message: string;
}>;

/** 可传入 {@link generateReport} 的断言描述：`predicate` 在只读访问 `sim` 的前提下应为真。 */
export type SimAssertion = Readonly<{
  label: string;
  predicate: (sim: HeadlessSim) => boolean;
  /** 失败时优先展示；省略则使用默认说明。 */
  messageOnFailure?: string;
}>;

/** 某一时刻模拟状态的汇总报告。 */
export type SimReport = Readonly<{
  tickCount: number;
  worldTime: WorldTimeSnapshot;
  pawns: readonly PawnSummary[];
  eventSummary: SimEventSummary;
  /** 仅当调用方传入 `assertions` 时存在（含空数组）。 */
  assertionResults?: readonly AssertionResult[];
}>;

function toPawnSummary(p: PawnState): PawnSummary {
  return {
    id: p.id,
    name: p.name,
    logicalCell: { col: p.logicalCell.col, row: p.logicalCell.row },
    moveTarget: p.moveTarget ? { col: p.moveTarget.col, row: p.moveTarget.row } : undefined,
    moveProgress01: p.moveProgress01,
    satiety: p.satiety,
    energy: p.energy,
    needs: {
      hunger: p.needs.hunger,
      rest: p.needs.rest,
      recreation: p.needs.recreation
    },
    currentGoalKind: p.currentGoal?.kind,
    currentActionKind: p.currentAction?.kind,
    debugLabel: p.debugLabel
  };
}

function defaultFailureMessage(label: string): string {
  return `断言未通过：${label}`;
}

function evaluateAssertion(sim: HeadlessSim, assertion: SimAssertion): AssertionResult {
  const { label, predicate, messageOnFailure } = assertion;
  try {
    const ok = predicate(sim);
    if (ok) {
      return { passed: true, label, message: "ok" };
    }
    return {
      passed: false,
      label,
      message: messageOnFailure ?? defaultFailureMessage(label)
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      passed: false,
      label,
      message: `${messageOnFailure ?? defaultFailureMessage(label)}（predicate 抛错：${detail}）`
    };
  }
}

/**
 * 汇总当前 `sim` 的只读快照；可选地对 `assertions` 逐项求值。
 *
 * 仅调用 `HeadlessSim` 的 getter 与 `SimEventCollector` 的只读查询，不 `tick`、不清事件、不改状态。
 */
export function generateReport(
  sim: HeadlessSim,
  assertions?: ReadonlyArray<SimAssertion>
): SimReport {
  const tickCount = sim.getTickCount();
  const worldTime = sim.getWorldTime();
  const pawns = sim.getPawns().map(toPawnSummary);
  const eventSummary = sim.getSimEventCollector().summary();

  if (assertions === undefined) {
    return { tickCount, worldTime, pawns, eventSummary };
  }

  const assertionResults = assertions.map((a) => evaluateAssertion(sim, a));
  return { tickCount, worldTime, pawns, eventSummary, assertionResults };
}
