import { describe, expect, it } from "vitest";
import {
  VILLAGER_TOOLS as MOCK_VILLAGER_TOOLS,
  validateVillagerToolBarConfig as validateMockVillagerToolBarConfig
} from "../../src/data/villager-tools";

/**
 * scene-hud：小人指令工具栏 mock 配置（component 层级，无 Phaser 场景）。
 */
describe("villager tool bar mock (scene-hud)", () => {
  it("passes layout invariants for QWERTYUIOP slots", () => {
    expect(validateMockVillagerToolBarConfig()).toEqual([]);
  });

  it("exposes ordered mock tools with distinct ids and preserves patrol plus zone", () => {
    expect(MOCK_VILLAGER_TOOLS.length).toBe(10);
    expect(MOCK_VILLAGER_TOOLS.map((t) => t.id)).toEqual([
      "mine",
      "demolish",
      "mow",
      "lumber",
      "build",
      "farm",
      "haul",
      "patrol",
      "idle",
      "zone_create"
    ]);
    const letters = MOCK_VILLAGER_TOOLS.map((t) => t.hotkey).join("");
    expect(letters).toBe("QWERTYUIOP");
  });
});
