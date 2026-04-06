import { describe, expect, it } from "vitest";
import { BUILD_WALL_FLOW_SCENARIO } from "../../scenarios/build-wall-flow.scenario";
import { captureVisibleState, runScenarioHeadless } from "../../src/headless";
import { presentationForCommandMenuCommand } from "../../src/player/interaction-mode-presenter";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";

/**
 * UI-001：层级菜单与模式提示的玩家可见语义（读模型 + 场景内玩家提交通道），
 * 不调用 `HudManager.sync*`；实机 DOM 高亮由 `scene-hud-markup` 作局部回归。
 * refactor-test：主验收入口；全场景基线另见 `scenario-runner.test.ts`。
 */
describe("UI-001 menu / mode switch (headless)", () => {
  it("木墙笔刷与木床单格的 modeLine / usesBrushStroke 与命令菜单一致", () => {
    const wall = presentationForCommandMenuCommand("build-wall");
    const bed = presentationForCommandMenuCommand("place-bed");

    expect(wall.modeLine).toMatch(/木墙/);
    expect(bed.modeLine).toMatch(/木床/);
    expect(wall.usesBrushStroke).toBe(true);
    expect(bed.usesBrushStroke).toBe(false);
  });

  it("建造→墙笔刷：玩家提交被接纳且可见反馈落在 player-channel 层", () => {
    resetDomainCommandIdSequence();
    const { hydration, results, sim } = runScenarioHeadless(BUILD_WALL_FLOW_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const sel = hydration.playerSelections[0]!;
    expect(sel.markerToolId).toBe("build");
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
