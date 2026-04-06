import { describe, expect, it } from "vitest";
import { CHOP_TREE_FULL_FLOW_SCENARIO } from "../../scenarios/chop-tree-full-flow.scenario";
import { createHeadlessSim, hydrateScenario } from "../../src/headless";
import type { PawnState } from "../../src/game/pawn-state";
import { workItemAnchorDurationSeconds } from "../../src/game/work/work-item-duration";
import type { WorkItemSnapshot } from "../../src/game/work/work-types";
import { pawnDetailBehaviorLabelZh } from "../../src/ui/status-display-model";

/**
 * 与 `src/scenes/renderers/pawn-renderer.ts` 中进度条显隐规则对齐的纯读模型（无 Phaser）。
 * UI-002：验收「地图上进度条在读条中出现、未满前可见、完成后消失」，禁止用 `HudManager.sync*`。
 * refactor-test：主验收入口；砍树全链邻近断言另见 `chop-tree-full-flow.test.ts`。
 */
function workBarVisibleOnMap(
  pawn: PawnState,
  workItems: ReadonlyMap<string, WorkItemSnapshot>
): boolean {
  const wid = pawn.activeWorkItemId;
  const item = wid ? workItems.get(wid) : undefined;
  const totalSec = item !== undefined ? workItemAnchorDurationSeconds(item.kind) : undefined;
  const showWorkBar =
    pawn.workTimerSec > 0 &&
    wid !== undefined &&
    item !== undefined &&
    totalSec !== undefined &&
    totalSec > 0;
  const progress01 = showWorkBar ? pawn.workTimerSec / totalSec! : 0;
  return showWorkBar && progress01 < 1;
}

describe("UI-002 work bar visibility (headless)", () => {
  it("伐木：读条中途应对玩家可见进度条；树移除后条消失", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_FULL_FLOW_SCENARIO.seed });
    hydrateScenario(sim, CHOP_TREE_FULL_FLOW_SCENARIO);

    const sawBar = sim.runUntil(() => {
      const w = sim.getWorldPort().getWorld();
      const p = sim.getPawns()[0]!;
      return workBarVisibleOnMap(p, w.workItems);
    }, { maxTicks: 3000 });

    expect(sawBar.reachedPredicate).toBe(true);

    const wMid = sim.getWorldPort().getWorld();
    const pMid = sim.getPawns()[0]!;
    const itemMid = wMid.workItems.get(pMid.activeWorkItemId!);
    expect(itemMid).toBeDefined();
    const total = workItemAnchorDurationSeconds(itemMid!.kind)!;
    expect(pMid.workTimerSec).toBeGreaterThan(0);
    expect(pMid.workTimerSec).toBeLessThan(total);
    expect(pawnDetailBehaviorLabelZh(pMid, wMid.workItems)).toBe("伐木中");

    sim.runUntil(() => {
      const w = sim.getWorldPort().getWorld();
      return ![...w.entities.values()].some((e) => e.kind === "tree");
    }, { maxTicks: 8000 });

    const wEnd = sim.getWorldPort().getWorld();
    const pEnd = sim.getPawns()[0]!;
    expect(workBarVisibleOnMap(pEnd, wEnd.workItems)).toBe(false);
  });
});
