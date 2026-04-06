import { describe, expect, it } from "vitest";
import { CHOP_TREE_FULL_FLOW_SCENARIO } from "../../scenarios/chop-tree-full-flow.scenario";
import {
  captureVisibleState,
  runScenarioHeadless
} from "../../src/headless";

/**
 * ENTITY-001：玩家侧 lumber 意图经场景推进后，树在原格消失、木头以地面可拾取形态落地。
 * 验收走 `runScenarioHeadless`（领域命令与实机选区提交同形），不调用 transformTreeToResource。
 * refactor-test：相对 UI-002，本文件仅覆盖砍树进度/资源落地的邻近可见性；菜单/模式切换主证据见
 * `tests/headless/ui-progress-visibility.test.ts`。
 */
describe("ENTITY-001 chop-tree-full-flow", () => {
  it("玩家发起砍树 → 工单完成 → 树消失 → 原树格落地 wood（ground、可拾取）", () => {
    const { results, sim } = runScenarioHeadless(CHOP_TREE_FULL_FLOW_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const treeCell = CHOP_TREE_FULL_FLOW_SCENARIO.trees![0]!.cell;
    const completed = sim.getSimEventCollector().getEventsByKind("work-completed");
    expect(completed.length).toBeGreaterThan(0);

    const entities = [...sim.getWorldPort().getWorld().entities.values()];
    expect(entities.some((e) => e.kind === "tree")).toBe(false);

    const woodAtTree = entities.find(
      (e) =>
        e.kind === "resource" &&
        e.materialKind === "wood" &&
        e.cell.col === treeCell.col &&
        e.cell.row === treeCell.row
    );
    expect(woodAtTree).toBeDefined();
    expect(woodAtTree!.containerKind).toBe("ground");
    expect(woodAtTree!.pickupAllowed).toBe(true);

    const visible = captureVisibleState(sim);
    expect(visible.workItems.some((w) => w.kind === "chop-tree" && w.status === "completed")).toBe(
      true
    );
  });
});
