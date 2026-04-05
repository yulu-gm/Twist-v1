import { describe, expect, it } from "vitest";
import { issuedTaskLabelForToolId as mockIssuedTaskLabelForVillagerToolId } from "../../src/data/task-markers";

describe("mock task marker commands (scene-hud)", () => {
  it("returns null for idle and unknown tools", () => {
    expect(mockIssuedTaskLabelForVillagerToolId("idle")).toBeNull();
    expect(mockIssuedTaskLabelForVillagerToolId("no-such-tool")).toBeNull();
  });

  it("returns Chinese label when tool issues a mock work order", () => {
    expect(mockIssuedTaskLabelForVillagerToolId("mine")).toBe("开采");
    expect(mockIssuedTaskLabelForVillagerToolId("build")).toBe("建造");
  });
});
