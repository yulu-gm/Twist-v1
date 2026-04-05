import { describe, expect, it, beforeEach } from "vitest";
import { commitPlayerSelectionToWorld } from "../../src/player/commit-player-intent";
import { MockWorldPort } from "../../src/player/mock-world-port";
import {
  buildDomainCommand,
  resetDomainCommandIdSequence
} from "../../src/player/build-domain-command";

describe("commitPlayerSelectionToWorld", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("does not change markers or call submit when command is null", () => {
    const port = new MockWorldPort();
    const before = new Map<string, string>([["1,1", "伐木"]]);
    const out = commitPlayerSelectionToWorld(port, {
      toolId: "lumber",
      selectionModifier: "replace",
      cellKeys: new Set(),
      inputShape: "rect-selection",
      currentMarkers: before,
      nowMs: 0
    });
    expect(out.didSubmitToWorld).toBe(false);
    expect(out.nextMarkers).toEqual(before);
    expect(port.getCommandLog()).toHaveLength(0);
  });

  it("on reject keeps markers unchanged", () => {
    const port = new MockWorldPort({ rejectIfTouchesCellKeys: new Set(["0,0"]) });
    const before = new Map<string, string>([["5,5", "开采"]]);
    const out = commitPlayerSelectionToWorld(port, {
      toolId: "mine",
      selectionModifier: "replace",
      cellKeys: new Set(["0,0", "1,0"]),
      inputShape: "rect-selection",
      currentMarkers: before,
      nowMs: 0
    });
    expect(out.didSubmitToWorld).toBe(true);
    expect(out.submitResult?.accepted).toBe(false);
    expect(out.nextMarkers).toEqual(before);
    expect(out.resultSummaryLine?.startsWith("世界网关：拒绝")).toBe(true);
  });

  it("on accept applies task markers", () => {
    const port = new MockWorldPort();
    const before = new Map<string, string>();
    const out = commitPlayerSelectionToWorld(port, {
      toolId: "lumber",
      selectionModifier: "replace",
      cellKeys: new Set(["2,2"]),
      inputShape: "single-cell",
      currentMarkers: before,
      nowMs: 0
    });
    expect(out.submitResult?.accepted).toBe(true);
    expect(out.nextMarkers.get("2,2")).toBe("伐木");
    expect(out.resultSummaryLine?.startsWith("世界网关：接受")).toBe(true);
  });

  it("idle clear runs only after accept", () => {
    const port = new MockWorldPort({ rejectIfTouchesCellKeys: new Set(["3,3"]) });
    const before = new Map<string, string>([
      ["3,3", "伐木"],
      ["4,4", "伐木"]
    ]);
    const out = commitPlayerSelectionToWorld(port, {
      toolId: "idle",
      selectionModifier: "replace",
      cellKeys: new Set(["3,3"]),
      inputShape: "single-cell",
      currentMarkers: before,
      nowMs: 0
    });
    expect(out.submitResult?.accepted).toBe(false);
    expect(out.nextMarkers.get("3,3")).toBe("伐木");

    const port2 = new MockWorldPort();
    const out2 = commitPlayerSelectionToWorld(port2, {
      toolId: "idle",
      selectionModifier: "replace",
      cellKeys: new Set(["3,3"]),
      inputShape: "single-cell",
      currentMarkers: before,
      nowMs: 0
    });
    expect(out2.submitResult?.accepted).toBe(true);
    expect(out2.nextMarkers.has("3,3")).toBe(false);
    expect(out2.nextMarkers.get("4,4")).toBe("伐木");
  });

  it("matches prior command shape from buildDomainCommand", () => {
    const port = new MockWorldPort();
    const cells = new Set(["0,0"]);
    const built = buildDomainCommand({
      toolId: "farm",
      selectionModifier: "replace",
      cellKeys: cells,
      inputShape: "single-cell"
    });
    const out = commitPlayerSelectionToWorld(port, {
      toolId: "farm",
      selectionModifier: "replace",
      cellKeys: cells,
      inputShape: "single-cell",
      currentMarkers: new Map(),
      nowMs: 1
    });
    expect(out.command?.verb).toBe(built?.verb);
    expect(out.command?.targetCellKeys).toEqual(built?.targetCellKeys);
  });
});
