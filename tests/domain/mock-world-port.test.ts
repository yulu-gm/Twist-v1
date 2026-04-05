import { describe, expect, it } from "vitest";
import type { DomainCommand } from "../../src/player/s0-contract";
import { MockWorldPort } from "../../src/player/mock-world-port";

describe("MockWorldPort", () => {
  it("accepts commands by default and logs them", () => {
    const port = new MockWorldPort();
    const cmd: DomainCommand = {
      commandId: "x",
      verb: "assign_tool_task:lumber",
      targetCellKeys: ["0,1"],
      targetEntityIds: [],
      sourceMode: {
        source: { kind: "toolbar", toolId: "lumber" },
        selectionModifier: "replace",
        inputShape: "single-cell"
      }
    };
    const r = port.submit(cmd, 1000);
    expect(r.accepted).toBe(true);
    expect(port.getCommandLog()).toHaveLength(1);
    expect(port.getCommandLog()[0]!.issuedAtMs).toBe(1000);
  });

  it("rejects when touching configured conflict cells", () => {
    const port = new MockWorldPort({ rejectIfTouchesCellKeys: new Set(["5,5"]) });
    const cmd: DomainCommand = {
      commandId: "y",
      verb: "test",
      targetCellKeys: ["5,5", "6,6"],
      targetEntityIds: [],
      sourceMode: {
        source: { kind: "toolbar", toolId: "build" },
        selectionModifier: "replace",
        inputShape: "brush-stroke"
      }
    };
    const r = port.submit(cmd, 1);
    expect(r.accepted).toBe(false);
    expect(r.conflictCellKeys?.[0]).toBe("5,5");
  });

  it("resetSession clears log; applyMockConfig merges fields", () => {
    const port = new MockWorldPort({
      rejectIfTouchesCellKeys: new Set(["1,1"])
    });
    port.submit(
      {
        commandId: "z",
        verb: "x",
        targetCellKeys: ["0,0"],
        targetEntityIds: [],
        sourceMode: {
          source: { kind: "toolbar", toolId: "mine" },
          selectionModifier: "replace",
          inputShape: "single-cell"
        }
      },
      0
    );
    expect(port.getCommandLog()).toHaveLength(1);
    port.resetSession();
    expect(port.getCommandLog()).toHaveLength(0);
    port.applyMockConfig({ alwaysAccept: false });
    const r = port.submit(
      {
        commandId: "z2",
        verb: "x",
        targetCellKeys: ["0,0"],
        targetEntityIds: [],
        sourceMode: {
          source: { kind: "toolbar", toolId: "mine" },
          selectionModifier: "replace",
          inputShape: "single-cell"
        }
      },
      0
    );
    expect(r.accepted).toBe(false);
    port.applyMockConfig({ rejectIfTouchesCellKeys: new Set() });
    port.applyMockConfig({ alwaysAccept: true });
    const r2 = port.submit(
      {
        commandId: "z3",
        verb: "x",
        targetCellKeys: ["1,1"],
        targetEntityIds: [],
        sourceMode: {
          source: { kind: "toolbar", toolId: "mine" },
          selectionModifier: "replace",
          inputShape: "single-cell"
        }
      },
      0
    );
    expect(r2.accepted).toBe(true);
  });

  it("replayAll resubmits in order", () => {
    const port = new MockWorldPort();
    port.submit(
      {
        commandId: "a",
        verb: "v1",
        targetCellKeys: ["0,0"],
        targetEntityIds: [],
        sourceMode: {
          source: { kind: "toolbar", toolId: "mine" },
          selectionModifier: "replace",
          inputShape: "rect-selection"
        }
      },
      0
    );
    port.submit(
      {
        commandId: "b",
        verb: "v2",
        targetCellKeys: ["1,1"],
        targetEntityIds: [],
        sourceMode: {
          source: { kind: "toolbar", toolId: "mine" },
          selectionModifier: "replace",
          inputShape: "rect-selection"
        }
      },
      0
    );
    const results = port.replayAll(500);
    expect(results).toHaveLength(2);
    expect(results.every((x) => x.accepted)).toBe(true);
    expect(port.getCommandLog()).toHaveLength(2);
    expect(port.getCommandLog()[0]!.verb).toBe("v1");
  });
});
