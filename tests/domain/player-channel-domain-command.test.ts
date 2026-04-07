import { describe, expect, it, beforeEach } from "vitest";
import type { CommandMenuCommandId } from "../../src/data/command-menu";
import {
  buildDomainCommand,
  resetDomainCommandIdSequence
} from "../../src/player/build-domain-command";

describe("player channel domain commands", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("maps mine command + cells to assign_tool_task verb", () => {
    const cmd = buildDomainCommand({
      commandId: "mine",
      selectionModifier: "replace",
      cellKeys: new Set(["0,0", "1,0"]),
      inputShape: "rect-selection"
    });
    expect(cmd).not.toBeNull();
    expect(cmd!.verb).toBe("assign_tool_task:mine");
    expect(cmd!.targetCellKeys).toEqual(["0,0", "1,0"]);
    expect(cmd!.sourceMode.inputShape).toBe("rect-selection");
    expect(cmd!.sourceMode.source).toEqual({ kind: "menu", menuId: "tools", itemId: "mine" });
    expect(cmd!.commandId).toBe("cmd-1");
  });

  it("idle + cells clears markers", () => {
    const cmd = buildDomainCommand({
      commandId: "idle",
      selectionModifier: "replace",
      cellKeys: new Set(["2,2"]),
      inputShape: "single-cell"
    });
    expect(cmd!.verb).toBe("clear_task_markers");
    expect(cmd!.sourceMode.source).toEqual({ kind: "menu", menuId: "tools", itemId: "idle" });
  });

  it("returns null when no cells for non-idle tool", () => {
    expect(
      buildDomainCommand({
        commandId: "lumber",
        selectionModifier: "replace",
        cellKeys: new Set(),
        inputShape: "rect-selection"
      })
    ).toBeNull();
  });

  it("returns null when commandId is not registered in command menu (no silent default)", () => {
    expect(
      buildDomainCommand({
        commandId: "not-a-registered-menu-command" as CommandMenuCommandId,
        selectionModifier: "replace",
        cellKeys: new Set(["0,0"]),
        inputShape: "rect-selection"
      })
    ).toBeNull();
  });
});
