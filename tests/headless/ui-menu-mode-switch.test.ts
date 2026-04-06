import { describe, expect, it } from "vitest";
import { BUILD_WALL_FLOW_SCENARIO } from "../../scenarios/build-wall-flow.scenario";
import { VILLAGER_TOOLS } from "../../src/data/villager-tools";
import { captureVisibleState, runScenarioHeadless } from "../../src/headless";
import { presentationForVillagerTool } from "../../src/player/interaction-mode-presenter";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { activeBuildToolState } from "../../src/ui/menu-model";

/**
 * UI-001：层级菜单与模式提示的玩家可见语义（读模型 + 场景内玩家提交通道），
 * 不调用 `HudManager.sync*`；实机 DOM 高亮由 `scene-hud-markup` 作局部回归。
 * refactor-test：主验收入口；全场景基线另见 `scenario-runner.test.ts`。
 */
describe("UI-001 menu / mode switch (headless)", () => {
  it("建造：未选子项 → 木墙笔刷 → 木床单格，modeLine / usesBrushStroke / verb 与交互呈现一致", () => {
    const buildTool = VILLAGER_TOOLS.find((t) => t.id === "build")!;
    const idle = presentationForVillagerTool(buildTool, null);
    const wall = presentationForVillagerTool(buildTool, "wall");
    const bed = presentationForVillagerTool(buildTool, "bed");

    expect(idle.modeLine).toMatch(/请选子项/);
    expect(wall.modeLine).toMatch(/木墙/);
    expect(bed.modeLine).toMatch(/木床/);
    expect(wall.usesBrushStroke).toBe(true);
    expect(bed.usesBrushStroke).toBe(false);

    expect(activeBuildToolState("wall")).toMatchObject({
      inputShape: "brush-stroke",
      verb: "build_wall_blueprint"
    });
    expect(activeBuildToolState("bed")).toMatchObject({
      inputShape: "single-cell",
      verb: "place_furniture:bed"
    });
  });

  it("建造→墙笔刷：玩家提交被接纳且可见反馈落在 player-channel 层", () => {
    resetDomainCommandIdSequence();
    const { hydration, results, sim } = runScenarioHeadless(BUILD_WALL_FLOW_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const sel = hydration.playerSelections[0]!;
    expect(sel.toolId).toBe("build");
    expect(sel.semantic).toBe("brush-stroke");
    expect(sel.didSubmitToWorld).toBe(true);
    expect(sel.accepted).toBe(true);

    const visible = captureVisibleState(sim, { playerSelections: hydration.playerSelections });
    expect(
      visible.failures.some(
        (f) => f.layer === "player-channel" && f.source === "submit-result" && f.accepted === true
      )
    ).toBe(true);
  });
});
