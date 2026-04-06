import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { registerChopTreeWork, spawnWorldEntity } from "../../src/game/world-core";
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

describe("auto-claim-work（tickSimulation 前自动认领工单）", () => {
  it("1 小人 + lumber → headless tick 后出现 work-claimed", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_COMMAND_SCENARIO.seed });
    hydrateScenario(sim, {
      ...CHOP_TREE_COMMAND_SCENARIO,
      domainCommandsAfterHydrate: undefined
    });

    const treeCell = CHOP_TREE_COMMAND_SCENARIO.trees![0]!.cell;
    sim
      .getWorldPort()
      .submit(makeLumberCommand([coordKey(treeCell)]), 1);

    const collector = sim.getSimEventCollector();
    collector.clear();

    const { reachedPredicate, ticksRun } = sim.runUntil(
      () => collector.getEventsByKind("work-claimed").length > 0,
      { maxTicks: 500, deltaMs: 16 }
    );

    expect(reachedPredicate).toBe(true);
    expect(ticksRun).toBeGreaterThan(0);
    const claimed = collector.getEventsByKind("work-claimed");
    expect(claimed.length).toBeGreaterThanOrEqual(1);
    expect(claimed[0]!.kind).toBe("work-claimed");

    const chop = [...sim.getWorldPort().getWorld().workItems.values()].find((w) => w.kind === "chop-tree");
    expect(chop?.status).toBe("claimed");
    expect(chop?.claimedBy).toBeDefined();
  });

  it("2 小人 + 1 条 open 工单 → 单 tick 仅 1 次 work-claimed（互斥）", () => {
    const sim = createHeadlessSim({ seed: 0xac_71 });
    let w = sim.getWorldPort().getWorld();
    const treeCell = { col: 8, row: 8 };
    const spawned = spawnWorldEntity(w, {
      kind: "tree",
      cell: treeCell,
      occupiedCells: [treeCell],
      loggingMarked: false,
      label: "mutex-tree"
    });
    w = spawned.world;
    const reg = registerChopTreeWork(w, spawned.entityId);
    sim.getWorldPort().setWorld(reg.world);

    sim.spawnPawn("Near", { col: 8, row: 7 });
    sim.spawnPawn("Far", { col: 2, row: 2 });

    const collector = sim.getSimEventCollector();
    collector.clear();

    sim.tick(16);

    const claimedEvents = collector.getEventsByKind("work-claimed");
    expect(claimedEvents).toHaveLength(1);

    const openChop = [...sim.getWorldPort().getWorld().workItems.values()].filter(
      (x) => x.kind === "chop-tree" && x.status === "open"
    );
    expect(openChop).toHaveLength(0);
  });
});
