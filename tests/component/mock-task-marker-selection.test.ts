import { describe, expect, it } from "vitest";
import { applyMockTaskMarkersForSelection } from "../../src/scenes/mock-task-marker-selection";

function keys(map: ReadonlyMap<string, string>): string[] {
  return [...map.keys()].sort();
}

describe("mock task marker selection (scene-hud)", () => {
  it("assigns the selected tool label to every cell in a dragged rectangle", () => {
    const updated = applyMockTaskMarkersForSelection(new Map(), {
      toolId: "build",
      modifier: "replace",
      cellKeys: new Set(["1,1", "1,2", "2,1", "2,2"])
    });

    expect(keys(updated)).toEqual(["1,1", "1,2", "2,1", "2,2"]);
    expect(updated.get("1,1")).toBe("建造");
    expect(updated.get("2,2")).toBe("建造");
  });

  it("applies shift expansion only to the cells included in the current drag", () => {
    const existing = new Map<string, string>([
      ["0,0", "开采"]
    ]);

    const updated = applyMockTaskMarkersForSelection(existing, {
      toolId: "farm",
      modifier: "union",
      cellKeys: new Set(["1,0", "1,1"])
    });

    expect(updated.get("0,0")).toBe("开采");
    expect(updated.get("1,0")).toBe("耕种");
    expect(updated.get("1,1")).toBe("耕种");
  });

  it("toggles matching task markers off and missing cells on when ctrl is used", () => {
    const existing = new Map<string, string>([
      ["0,0", "建造"],
      ["0,1", "开采"]
    ]);

    const updated = applyMockTaskMarkersForSelection(existing, {
      toolId: "build",
      modifier: "toggle",
      cellKeys: new Set(["0,0", "0,1", "1,1"])
    });

    expect(updated.has("0,0")).toBe(false);
    expect(updated.get("0,1")).toBe("建造");
    expect(updated.get("1,1")).toBe("建造");
  });

  it("clears existing markers on the dragged cells when the idle tool is selected", () => {
    const existing = new Map<string, string>([
      ["1,1", "建造"],
      ["2,2", "搬运"]
    ]);

    const idle = applyMockTaskMarkersForSelection(existing, {
      toolId: "idle",
      modifier: "replace",
      cellKeys: new Set(["1,1", "2,2"])
    });

    expect(idle.size).toBe(0);
  });

  it("leaves markers unchanged for unknown tools or an empty drag result", () => {
    const existing = new Map<string, string>([
      ["2,2", "搬运"]
    ]);

    const unknown = applyMockTaskMarkersForSelection(existing, {
      toolId: "no-such-tool",
      modifier: "replace",
      cellKeys: new Set(["2,2"])
    });
    const outside = applyMockTaskMarkersForSelection(existing, {
      toolId: "haul",
      modifier: "replace",
      cellKeys: new Set()
    });

    expect(unknown).toEqual(existing);
    expect(outside).toEqual(existing);
  });
});
