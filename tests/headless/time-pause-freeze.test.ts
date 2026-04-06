/**
 * refactor-test：TIME-003 场景级主验收入口（`runScenarioHeadless` + HUD 暂停/速度可见断言）。
 */
import { describe, expect, it } from "vitest";
import { TIME_PAUSE_FREEZE_SCENARIO } from "../../scenarios/time-pause-freeze.scenario";
import {
  assertVisibleHudTime,
  captureVisibleState,
  runScenarioHeadless,
  type HeadlessSim
} from "../../src/headless";

type MutableTimeControls = {
  paused: boolean;
  speed: 1 | 2 | 3;
};

function pawnProgressSnapshot(sim: HeadlessSim) {
  const pawn = sim.getPawns()[0]!;
  return {
    logicalCell: { ...pawn.logicalCell },
    moveTarget: pawn.moveTarget ? { ...pawn.moveTarget } : null,
    moveProgress01: pawn.moveProgress01,
    currentGoalKind: pawn.currentGoal?.kind ?? null,
    currentActionKind: pawn.currentAction?.kind ?? null,
    actionTimerSec: pawn.actionTimerSec,
    workTimerSec: pawn.workTimerSec,
    activeWorkItemId: pawn.activeWorkItemId ?? null
  };
}

function visibleWorkSnapshot(sim: HeadlessSim) {
  return captureVisibleState(sim).workItems.map((item) => ({
    id: item.id,
    status: item.status,
    claimedBy: item.claimedBy ?? null,
    failureCount: item.failureCount,
    anchorCell: { ...item.anchorCell }
  }));
}

function pawnHasTimeDrivenProgress(sim: HeadlessSim): boolean {
  const pawn = sim.getPawns()[0];
  if (!pawn) return false;
  return (
    pawn.moveTarget !== undefined ||
    pawn.moveProgress01 > 0 ||
    pawn.currentAction !== undefined ||
    pawn.actionTimerSec > 0 ||
    pawn.workTimerSec > 0
  );
}

describe("TIME-003 time-pause-freeze", () => {
  it("freezes both HUD time and ongoing pawn progress while paused", () => {
    const { results, sim } = runScenarioHeadless(TIME_PAUSE_FREEZE_SCENARIO);
    expect(results.every((result) => result.passed)).toBe(true);

    const reachedActiveProgress = sim.runUntil(
      () => {
        const pawn = sim.getPawns()[0];
        if (!pawn) return false;
        const claimedWorkExists = [...sim.getWorldPort().getWorld().workItems.values()].some(
          (item) => item.status === "claimed" && item.claimedBy === pawn.id
        );
        return claimedWorkExists && pawnHasTimeDrivenProgress(sim);
      },
      { deltaMs: 16, maxTicks: 2_000 }
    );
    expect(reachedActiveProgress.reachedPredicate).toBe(true);

    const beforePauseHud = captureVisibleState(sim).hud;
    const beforePausePawn = pawnProgressSnapshot(sim);
    const beforePauseWork = visibleWorkSnapshot(sim);
    const beforePauseEventCount = sim.getSimEventCollector().getEvents().length;

    const controls = sim.getSimAccess().getTimeControlState() as MutableTimeControls;
    controls.paused = true;
    sim.tick(16);

    const pausedHud = captureVisibleState(sim).hud;
    const pausedPawn = pawnProgressSnapshot(sim);
    const pausedWork = visibleWorkSnapshot(sim);
    expect(assertVisibleHudTime(sim, { paused: true, dayNumber: beforePauseHud.dayNumber }).passed).toBe(true);
    expect(pausedHud.minuteOfDay).toBe(beforePauseHud.minuteOfDay);
    expect(pausedHud.timeLabel).toBe(beforePauseHud.timeLabel);
    expect(pausedPawn).toEqual(beforePausePawn);
    expect(pausedWork).toEqual(beforePauseWork);

    for (let i = 0; i < 120; i += 1) {
      sim.tick(16);
    }

    const frozenHud = captureVisibleState(sim).hud;
    const frozenPawn = pawnProgressSnapshot(sim);
    const frozenWork = visibleWorkSnapshot(sim);
    const afterPauseEventCount = sim.getSimEventCollector().getEvents().length;
    expect(frozenHud.dayNumber).toBe(pausedHud.dayNumber);
    expect(frozenHud.minuteOfDay).toBe(pausedHud.minuteOfDay);
    expect(frozenHud.timeLabel).toBe(pausedHud.timeLabel);
    expect(frozenHud.paused).toBe(true);
    expect(frozenPawn).toEqual(pausedPawn);
    expect(frozenWork).toEqual(pausedWork);
    expect(afterPauseEventCount).toBe(beforePauseEventCount);
  });
});
