/**
 * refactor-test：保留回归（砍树工单认领直连），不作为 WORK-003/004 或 BEHAVIOR-002 的主验收唯一来源。
 * 主证据：对应场景的 `runScenarioHeadless` 专用用例 + `scenario-runner.test.ts`。
 */
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import {
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";
import { CHOP_TREE_COMMAND_SCENARIO } from "../../scenarios/chop-tree-command.scenario";

function findChopTreeWork(sim: ReturnType<typeof createHeadlessSim>) {
  return [...sim.getWorldPort().getWorld().workItems.values()].find(
    (item) => item.kind === "chop-tree"
  );
}

describe("BEHAVIOR-002 auto-claim-work", () => {
  it("redirects a pawn from wandering into a claimed chop job and starts anchored work", () => {
    const sim = createHeadlessSim({
      seed: CHOP_TREE_COMMAND_SCENARIO.seed,
      worldGrid: CHOP_TREE_COMMAND_SCENARIO.gridConfig
    });
    hydrateScenario(sim, {
      ...CHOP_TREE_COMMAND_SCENARIO,
      /** 与 behavior-wander 一致：压低需求分，否则 eat/sleep/rec 长期压过 wander，单测永远等不到闲逛。 */
      pawns: [
        {
          ...CHOP_TREE_COMMAND_SCENARIO.pawns[0]!,
          overrides: {
            satiety: 100,
            energy: 100,
            needs: { hunger: 0, rest: 0, recreation: 0 }
          }
        }
      ],
      timeConfig: { startMinuteOfDay: 10 * 60 },
      domainCommandsAfterHydrate: undefined,
      expectations: []
    });

    const treeCell = CHOP_TREE_COMMAND_SCENARIO.trees![0]!.cell;
    const collector = sim.getSimEventCollector();

    const reachedWander = sim.runUntil(() => sim.getPawns()[0]?.currentGoal?.kind === "wander", {
      maxTicks: 400,
      deltaMs: 16
    });
    expect(reachedWander.reachedPredicate).toBe(true);
    expect(sim.getPawns()[0]!.currentGoal).toMatchObject({ kind: "wander" });

    collector.clear();
    const movedWhileWandering = sim.runUntil(
      () => collector.getEventsByKind("pawn-moved").some((event) => event.pawnId === "pawn-0"),
      { maxTicks: 800, deltaMs: 16 }
    );
    expect(movedWhileWandering.reachedPredicate).toBe(true);
    expect(sim.getPawns()[0]!.currentGoal).toMatchObject({ kind: "wander" });

    collector.clear();

    const submit = sim.commitPlayerSelection({
      commandId: "lumber",
      selectionModifier: "replace",
      cellKeys: new Set([coordKey(treeCell)]),
      inputShape: "rect-selection",
      currentMarkers: new Map(),
      nowMs: 0
    });

    expect(submit.didSubmitToWorld).toBe(true);
    expect(submit.command?.verb).toBe("assign_tool_task:lumber");
    expect(submit.submitResult?.accepted).toBe(true);
    expect(
      captureVisibleState(sim).workItems.some(
        (item) => item.kind === "chop-tree" && item.status === "open"
      )
    ).toBe(true);

    const claimed = sim.runUntil(() => findChopTreeWork(sim)?.status === "claimed", {
      maxTicks: 600,
      deltaMs: 16
    });
    expect(claimed.reachedPredicate).toBe(true);

    const claimedWork = findChopTreeWork(sim);
    expect(claimedWork).toMatchObject({
      kind: "chop-tree",
      status: "claimed",
      claimedBy: "pawn-0"
    });

    const startedWorking = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return pawn?.activeWorkItemId === claimedWork?.id && pawn.workTimerSec > 0;
    }, { maxTicks: 4_000, deltaMs: 16 });
    expect(startedWorking.reachedPredicate).toBe(true);

    const finalPawn = sim.getPawns()[0]!;
    const visibleWork = captureVisibleState(sim).workItems.find((item) => item.id === claimedWork?.id);
    const claimEvents = collector.getEventsByKind("work-claimed");
    const moveEvents = collector.getEventsByKind("pawn-moved");

    expect(claimEvents).toHaveLength(1);
    expect(claimEvents[0]).toMatchObject({
      workItemId: claimedWork?.id,
      claimedBy: "pawn-0"
    });
    expect(moveEvents.some((event) => event.pawnId === "pawn-0")).toBe(true);
    expect(visibleWork).toMatchObject({
      id: claimedWork?.id,
      kind: "chop-tree",
      status: "claimed",
      claimedBy: "pawn-0"
    });
    expect(finalPawn.activeWorkItemId).toBe(claimedWork?.id);
    expect(finalPawn.workTimerSec).toBeGreaterThan(0);
  });
});
