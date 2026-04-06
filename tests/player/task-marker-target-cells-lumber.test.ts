import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import { filterCellKeysForToolbarTaskMarkers } from "../../src/player/task-marker-target-cells";

describe("filterCellKeysForToolbarTaskMarkers lumber selection", () => {
  it("keeps a single-cell tree selected even when occupiedCells is empty", () => {
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

    expect([...filtered]).toEqual(["4,5"]);
  });
});
