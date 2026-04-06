import { describe, expect, it } from "vitest";
import { UI_LAYER_CLARITY_SCENARIO } from "../../scenarios/ui-layer-clarity.scenario";
import { captureVisibleState, runScenarioHeadless } from "../../src/headless";

/**
 * UI-004：叠层场景下世界侧「可同时辨认」的语义锚点（选区/蓝图虚影/标记工单/区域边界），
 * 与 `ScenarioDefinition.uiObservation` 及人工验收步骤对齐；不调用 `HudManager.sync*`。
 * refactor-test：本文件为 UI-004 主验收入口；`scenario-runner.test.ts` 对 `ui-layer-clarity` 场景冒烟。
 */
describe("UI-004 layer clarity (scenario-visible)", () => {
  it("ui-layer-clarity：zone、blueprint、pick-up-resource 工单在同一快照中共存，且观察锚点完整", () => {
    const { results, sim } = runScenarioHeadless(UI_LAYER_CLARITY_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const layers = UI_LAYER_CLARITY_SCENARIO.uiObservation?.layers ?? [];
    expect(layers.length).toBeGreaterThanOrEqual(4);
    expect(layers.some((l) => /blueprint|bed/i.test(l))).toBe(true);
    expect(layers.some((l) => /marker|haul/i.test(l))).toBe(true);
    expect(layers.some((l) => /zone|boundary|storage/i.test(l))).toBe(true);
    expect(layers.some((l) => /selection|frame|cluster/i.test(l))).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const entities = [...world.entities.values()];
    expect(entities.some((e) => e.kind === "zone")).toBe(true);
    expect(entities.some((e) => e.kind === "blueprint")).toBe(true);

    const vis = captureVisibleState(sim);
    expect(vis.workItems.some((w) => w.kind === "pick-up-resource")).toBe(true);
  });
});
