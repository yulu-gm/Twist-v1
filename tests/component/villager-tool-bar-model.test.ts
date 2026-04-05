import { describe, expect, it } from "vitest";
import {
  MOCK_VILLAGER_TOOLS,
  validateMockVillagerToolBarConfig
} from "../../src/scenes/villager-tool-bar-config";

/**
 * scene-hud：小人指令工具栏 mock 配置（component 层级，无 Phaser 场景）。
 */
describe("villager tool bar mock (scene-hud)", () => {
  it("passes layout invariants for QWERTYUIO slots", () => {
    expect(validateMockVillagerToolBarConfig()).toEqual([]);
  });

  it("exposes nine ordered mock tools with distinct ids", () => {
    expect(MOCK_VILLAGER_TOOLS.length).toBe(9);
    const letters = MOCK_VILLAGER_TOOLS.map((t) => t.hotkey).join("");
    expect(letters).toBe("QWERTYUIO");
  });
});
