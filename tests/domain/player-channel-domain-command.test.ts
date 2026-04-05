import { describe, expect, it, beforeEach } from "vitest";
import {
  buildDomainCommand,
  resetDomainCommandIdSequence
} from "../../src/player/build-domain-command";

describe("player channel domain commands", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("maps mine tool + cells to assign_tool_task verb", () => {
    const cmd = buildDomainCommand({
      toolId: "mine",
      selectionModifier: "replace",
      cellKeys: new Set(["0,0", "1,0"]),
      inputShape: "rect-selection"
    });
    expect(cmd).not.toBeNull();
    expect(cmd!.verb).toBe("assign_tool_task:mine");
    expect(cmd!.targetCellKeys).toEqual(["0,0", "1,0"]);
    expect(cmd!.sourceMode.inputShape).toBe("rect-selection");
    expect(cmd!.commandId).toBe("cmd-1");
  });

  it("idle + cells clears markers", () => {
    const cmd = buildDomainCommand({
      toolId: "idle",
      selectionModifier: "replace",
      cellKeys: new Set(["2,2"]),
      inputShape: "single-cell"
    });
    expect(cmd!.verb).toBe("clear_task_markers");
  });

  it("returns null when no cells for non-idle tool", () => {
    expect(
      buildDomainCommand({
        toolId: "lumber",
        selectionModifier: "replace",
        cellKeys: new Set(),
        inputShape: "rect-selection"
      })
    ).toBeNull();
  });
});
