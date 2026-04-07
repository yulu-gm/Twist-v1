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

  it("keeps mine selection for stone obstacle anchored on cell when occupiedCells is empty", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(world, {
      kind: "obstacle",
      cell: { col: 2, row: 3 },
      occupiedCells: [],
      label: "stone",
      miningMarked: false
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;

    const filtered = filterCellKeysForToolbarTaskMarkers(
      world,
      "mine",
      "rect-selection",
      new Set(["2,3"])
    );

    expect(filtered).toEqual(new Set(["2,3"]));
  });

  it("keeps mine selection for stone when occupiedCells is a single anchor cell", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const cell = { col: 1, row: 1 };
    const spawned = spawnWorldEntity(world, {
      kind: "obstacle",
      cell,
      occupiedCells: [cell],
      label: "stone",
      miningMarked: false
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;

    const filtered = filterCellKeysForToolbarTaskMarkers(
      world,
      "mine",
      "rect-selection",
      new Set(["1,1"])
    );

    expect(filtered).toEqual(new Set(["1,1"]));
  });
});
