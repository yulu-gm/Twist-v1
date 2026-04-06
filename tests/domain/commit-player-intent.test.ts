import { describe, expect, it } from "vitest";
import {
  rebuildTaskMarkersFromCommandResults
} from "../../src/player/commit-player-intent";
import type { DomainCommand, MockWorldSubmitResult } from "../../src/player/s0-contract";
import { issuedTaskLabelForToolId } from "../../src/data/task-markers";

function cmd(
  verb: string,
  keys: string[],
  itemId: string,
  menuId = "orders",
  modifier: "replace" | "toggle" = "replace"
): DomainCommand {
  return {
    commandId: "x",
    verb,
    targetCellKeys: keys,
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId, itemId },
      selectionModifier: modifier,
      inputShape: "rect-selection"
    }
  };
}

function ok(): MockWorldSubmitResult {
  return { accepted: true, messages: ["ok"] };
}

function rejected(): MockWorldSubmitResult {
  return { accepted: false, messages: ["no"] };
}

describe("rebuildTaskMarkersFromCommandResults", () => {
  it("replays accepted marker updates in order and skips rejected", () => {
    const lumber = issuedTaskLabelForToolId("lumber");
    const mine = issuedTaskLabelForToolId("mine");
    expect(lumber).not.toBeNull();
    expect(mine).not.toBeNull();

    const log: DomainCommand[] = [
      cmd("assign_tool_task:lumber", ["0,0"], "lumber"),
      cmd("assign_tool_task:mine", ["1,1"], "mine"),
      cmd("assign_tool_task:lumber", ["0,0"], "lumber"),
      cmd("clear_task_markers", ["0,0"], "idle", "orders")
    ];
    const results: MockWorldSubmitResult[] = [ok(), rejected(), ok(), ok()];

    const m = rebuildTaskMarkersFromCommandResults(log, results);
    expect(m.get("0,0")).toBeUndefined();
    expect(m.get("1,1")).toBeUndefined();
  });

  it("matches incremental applyTaskMarkers after mixed accepts", () => {
    const log: DomainCommand[] = [
      cmd("assign_tool_task:demolish", ["2,2"], "demolish"),
      cmd("assign_tool_task:build", ["3,3"], "noop", "orders")
    ];
    const results: MockWorldSubmitResult[] = [ok(), ok()];
    const m = rebuildTaskMarkersFromCommandResults(log, results);
    expect(m.get("2,2")).toBe(issuedTaskLabelForToolId("demolish"));
    expect(m.get("3,3")).toBe(issuedTaskLabelForToolId("build"));
  });
});
