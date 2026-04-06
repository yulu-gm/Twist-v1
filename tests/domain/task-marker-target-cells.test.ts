import { describe, expect, it } from "vitest";
import { createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { filterCellKeysForToolbarTaskMarkers } from "../../src/player/task-marker-target-cells";

describe("filterCellKeysForToolbarTaskMarkers", () => {
  it("keeps lumber selection for a single-cell tree even when occupiedCells is empty", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(world, {
      kind: "tree",
      cell: { col: 4, row: 5 },
      occupiedCells: [],
      loggingMarked: false
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;

    const filtered = filterCellKeysForToolbarTaskMarkers(
      world,
      "lumber",
      "rect-selection",
      new Set(["4,5"])
    );

    expect(filtered).toEqual(new Set(["4,5"]));
  });
});
