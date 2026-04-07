import { describe, expect, it } from "vitest";
import { createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { applyDomainCommandToWorldCore } from "../../src/player/apply-domain-command";
import type { DomainCommand } from "../../src/game/interaction/domain-command-types";

function lumberCommand(cellKeys: string[]): DomainCommand {
  return {
    commandId: "cmd-lumber-fallback",
    verb: "assign_tool_task:lumber",
    targetCellKeys: cellKeys,
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "tools", itemId: "lumber" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    },
    issuedAtMs: 0
  };
}

describe("applyDomainCommandToWorldCore lumber selection semantics", () => {
  it("registers chop work for a single-cell tree using its anchor cell when occupiedCells is empty", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(world, {
      kind: "tree",
      cell: { col: 4, row: 5 },
      occupiedCells: [],
      loggingMarked: false
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;

    const applied = applyDomainCommandToWorldCore(world, lumberCommand(["4,5"]));

    expect(applied.result.accepted).toBe(true);
    expect(applied.result.messages[0]).toContain("chop-tree");
    const tree = [...applied.world.entities.values()].find((entity) => entity.kind === "tree");
    expect(tree?.loggingMarked).toBe(true);
    expect([...applied.world.workItems.values()].some((item) => item.kind === "chop-tree")).toBe(true);
  });

  it("still marks trees when the selection also contains blocked cells", () => {
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>(["1,1"])
    };
    let world = createWorldCore({ grid });
    const spawned = spawnWorldEntity(world, {
      kind: "tree",
      cell: { col: 4, row: 5 },
      occupiedCells: [{ col: 4, row: 5 }],
      loggingMarked: false
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;

    const applied = applyDomainCommandToWorldCore(world, lumberCommand(["1,1", "4,5"]));

    expect(applied.result.accepted).toBe(true);
    const tree = [...applied.world.entities.values()].find((entity) => entity.kind === "tree");
    expect(tree?.loggingMarked).toBe(true);
    expect([...applied.world.workItems.values()].some((item) => item.kind === "chop-tree")).toBe(true);
  });
});
