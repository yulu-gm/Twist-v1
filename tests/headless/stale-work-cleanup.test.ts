import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { cloneWorld, removeEntityMutable } from "../../src/game/world-internal";
import { CHOP_TREE_COMMAND_SCENARIO } from "../../scenarios/chop-tree-command.scenario";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import type { DomainCommand } from "../../src/player/s0-contract";

function makeLumberCommand(targetCellKeys: readonly string[]): DomainCommand {
  return {
    commandId: `cmd-lumber-${targetCellKeys.join("-")}`,
    verb: "assign_tool_task:lumber",
    targetCellKeys: [...targetCellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId: "lumber" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  };
}

describe("stale-work-cleanup（工单目标实体消失）", () => {
  it("已认领 chop-tree + 树从 entities 移除 → tick 后工单被删且小人无 activeWorkItemId", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_COMMAND_SCENARIO.seed });
    hydrateScenario(sim, {
      ...CHOP_TREE_COMMAND_SCENARIO,
      domainCommandsAfterHydrate: undefined
    });

    const treeCell = CHOP_TREE_COMMAND_SCENARIO.trees![0]!.cell;
    sim.getWorldPort().submit(makeLumberCommand([coordKey(treeCell)]), 1);

    const reached = sim.runUntil(
      () =>
        sim.getPawns().some(
          (p) =>
            p.activeWorkItemId !== undefined ||
            [...sim.getWorldPort().getWorld().workItems.values()].some(
              (w) => w.kind === "chop-tree" && w.status === "claimed"
            )
        ),
      { maxTicks: 400, deltaMs: 16 }
    );
    expect(reached.reachedPredicate).toBe(true);

    const w0 = sim.getWorldPort().getWorld();
    const tree = [...w0.entities.values()].find((e) => e.kind === "tree");
    expect(tree).toBeDefined();

    const next = cloneWorld(w0);
    removeEntityMutable(next, tree!.id);
    sim.getWorldPort().setWorld(next);

    for (let i = 0; i < 5; i++) {
      sim.tick(16);
    }

    const chopLeft = [...sim.getWorldPort().getWorld().workItems.values()].filter((x) => x.kind === "chop-tree");
    expect(chopLeft).toHaveLength(0);

    for (const p of sim.getPawns()) {
      expect(p.activeWorkItemId).toBeUndefined();
      expect(p.workTimerSec).toBe(0);
    }
  });
});
