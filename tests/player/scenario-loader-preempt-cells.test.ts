import { describe, expect, it } from "vitest";
import { createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import { DEFAULT_WORLD_GRID } from "../../src/game/map";
import { loadScenarioIntoGame } from "../../src/player/scenario-loader";
import type { ScenarioDefinition } from "../../src/headless/scenario-types";

describe("loadScenarioIntoGame preempts cells", () => {
  it("removes existing occupant before spawning scenario tree", () => {
    let w = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const sp = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: { col: 5, row: 5 },
      occupiedCells: [{ col: 5, row: 5 }],
      label: "blocking-stone"
    });
    expect(sp.outcome.kind).toBe("created");
    w = sp.world;

    const def: ScenarioDefinition = {
      name: "preempt-tree",
      description: "tree replaces prior obstacle at same cell",
      seed: 1,
      pawns: [{ name: "P", cell: { col: 0, row: 0 } }],
      trees: [{ cell: { col: 5, row: 5 } }]
    };

    const { world } = loadScenarioIntoGame(w, def);
    const at55 = [...world.entities.values()].filter((e) =>
      e.occupiedCells.some((c) => c.col === 5 && c.row === 5)
    );
    expect(at55.length).toBe(1);
    expect(at55[0]!.kind).toBe("tree");
  });
});
