import { describe, expect, it } from "vitest";
import { CHOP_TREE_FULL_FLOW_SCENARIO } from "../../scenarios/chop-tree-full-flow.scenario";
import { createHeadlessSim, hydrateScenario } from "../../src/headless";
import { needSignalsFromNeeds } from "../../src/game/need/need-signals";
import { pawnDetailBehaviorLabelZh } from "../../src/ui/status-display-model";

/**
 * UI-003：状态面板与需求警示的玩家可见读模型（与 `HudManager.syncPawnDetail` 渲染数据源一致，但不调用 sync）。
 * refactor-test：主验收入口；多小人殖民地冒烟另见 `scenario-runner.test.ts` + `multi-pawn-colony.test.ts`（回归）。
 */
describe("UI-003 pawn panel sync (read model)", () => {
  it("认领伐木工单后「当前行为」为 伐木中（与详情面板行为行同源）", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_FULL_FLOW_SCENARIO.seed });
    hydrateScenario(sim, CHOP_TREE_FULL_FLOW_SCENARIO);

    sim.runUntil(() => {
      const w = sim.getWorldPort().getWorld();
      const pawn = sim.getPawns()[0]!;
      return pawnDetailBehaviorLabelZh(pawn, w.workItems) === "伐木中";
    }, { maxTicks: 4000 });

    const w = sim.getWorldPort().getWorld();
    const pawn = sim.getPawns()[0]!;
    expect(pawnDetailBehaviorLabelZh(pawn, w.workItems)).toBe("伐木中");
  });

  it("饥饿需求达 critical 时，警示等级与摘要行可见（与面板内需求信号同源）", () => {
    const sim = createHeadlessSim({ seed: 0x55_49_30_33 });
    sim.spawnPawn("Hungry", { col: 2, row: 2 }, {
      needs: { hunger: 85, rest: 10, recreation: 10 }
    });
    const p = sim.getPawns()[0]!;
    const sig = needSignalsFromNeeds(p.needs);
    expect(sig.hungerUrgency).toBe("critical");
    expect(sig.allowInterruptWorkForHunger).toBe(true);
    expect(sig.summaryLine).toContain("饥饿");
  });
});
