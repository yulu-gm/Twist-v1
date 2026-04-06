/**
 * refactor-test：保留回归（目标消失与工单清理直连），WORK-003 主证据以 `chop-tree-command.scenario.ts`
 * + `chop-tree-command.test.ts` / `scenario-runner.test.ts` 为准。
 */
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { captureVisibleState, createHeadlessSim } from "../../src/headless";
import { invalidateScenarioEntity } from "../../src/headless/scenario-helpers";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import { CHOP_TREE_COMMAND_SCENARIO } from "../../scenarios/chop-tree-command.scenario";

describe("WORK-003 stale-work-cleanup", () => {
  it("cleans up stale chop work and releases the worker after the target disappears", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_COMMAND_SCENARIO.seed });
    hydrateScenario(sim, {
      ...CHOP_TREE_COMMAND_SCENARIO,
      domainCommandsAfterHydrate: undefined,
      expectations: undefined
    });

    const treeCell = CHOP_TREE_COMMAND_SCENARIO.trees![0]!.cell;
    const outcome = sim.commitPlayerSelection({
      toolId: "lumber",
      selectionModifier: "replace",
      cellKeys: new Set([coordKey(treeCell)]),
      inputShape: "rect-selection",
      currentMarkers: new Map(),
      nowMs: 0
    });

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("assign_tool_task:lumber");
    expect(outcome.submitResult?.accepted).toBe(true);
    expect(
      captureVisibleState(sim).workItems.some(
        (item) => item.kind === "chop-tree" && item.status === "open"
      )
    ).toBe(true);

    const claimed = sim.runUntil(
      () =>
        [...sim.getWorldPort().getWorld().workItems.values()].some(
          (item) => item.kind === "chop-tree" && item.status === "claimed"
        ),
      { maxTicks: 400, deltaMs: 16 }
    );
    expect(claimed.reachedPredicate).toBe(true);

    const workBeforeStart = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (item) => item.kind === "chop-tree"
    );
    expect(workBeforeStart).toBeDefined();
    expect(workBeforeStart?.claimedBy).toBeDefined();
    expect(workBeforeStart?.targetEntityId).toBeDefined();

    const active = sim.runUntil(
      () =>
        sim
          .getPawns()
          .some(
            (pawn) =>
              pawn.activeWorkItemId === workBeforeStart!.id && pawn.workTimerSec > 0
          ),
      { maxTicks: 4_000, deltaMs: 16 }
    );
    expect(active.reachedPredicate).toBe(true);

    const workerBeforeCleanup = sim.getPawns().find(
      (pawn) => pawn.activeWorkItemId === workBeforeStart!.id
    );
    expect(workerBeforeCleanup?.id).toBe(workBeforeStart?.claimedBy);
    expect(workerBeforeCleanup?.workTimerSec).toBeGreaterThan(0);

    expect(invalidateScenarioEntity(sim, workBeforeStart!.targetEntityId!)).toBe(true);
    expect(
      [...sim.getWorldPort().getWorld().entities.values()].some(
        (entity) => entity.id === workBeforeStart!.targetEntityId
      )
    ).toBe(false);

    const cleaned = sim.runUntil(
      () => {
        const world = sim.getWorldPort().getWorld();
        const staleChopLeft = [...world.workItems.values()].some(
          (item) => item.kind === "chop-tree" && (item.status === "open" || item.status === "claimed")
        );
        return (
          !staleChopLeft &&
          sim.getPawns().every(
            (pawn) => pawn.activeWorkItemId === undefined && pawn.workTimerSec === 0
          )
        );
      },
      { maxTicks: 50, deltaMs: 16 }
    );
    expect(cleaned.reachedPredicate).toBe(true);

    expect(captureVisibleState(sim).workItems.some((item) => item.kind === "chop-tree")).toBe(false);
    for (const pawn of sim.getPawns()) {
      expect(pawn.activeWorkItemId).toBeUndefined();
      expect(pawn.workTimerSec).toBe(0);
    }
  });
});
