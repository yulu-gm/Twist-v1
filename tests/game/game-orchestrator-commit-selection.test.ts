import { describe, expect, it, vi } from "vitest";
import { createHeadlessSimAccess } from "../../src/headless/headless-sim-access";
import { DEFAULT_SIM_CONFIG } from "../../src/game/behavior";
import { createGameOrchestrator } from "../../src/game/game-orchestrator";
import { DEFAULT_WORLD_GRID } from "../../src/game/map";
import { createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import { WorldCoreWorldPort } from "../../src/player/world-core-world-port";

describe("GameOrchestrator.commitPlayerSelection", () => {
  it("accepted lumber selection immediately syncs tree and ground presentation", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(world, {
      kind: "tree",
      cell: { col: 4, row: 5 },
      occupiedCells: [{ col: 4, row: 5 }],
      loggingMarked: false
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;

    const worldPort = new WorldCoreWorldPort(world);
    const syncTreesAndGroundItems = vi.fn();

    const orchestrator = createGameOrchestrator({
      worldPort,
      worldGrid: DEFAULT_WORLD_GRID,
      interactionTemplate: DEFAULT_WORLD_GRID,
      sim: createHeadlessSimAccess(),
      simConfig: DEFAULT_SIM_CONFIG,
      rng: () => 0.5,
      hooks: {
        onPaletteChanged: () => {},
        syncTimeHud: () => {},
        syncTreesAndGroundItems,
        redrawStoneCells: () => {},
        redrawInteractionPoints: () => {},
        syncPawnViews: () => {},
        syncMarkerOverlay: () => {},
        syncHoverFromPointer: () => {},
        syncPawnDetailPanel: () => {}
      }
    });

    const outcome = orchestrator.commitPlayerSelection({
      commandId: "lumber",
      selectionModifier: "replace",
      cellKeys: new Set(["4,5"]),
      inputShape: "rect-selection",
      currentMarkers: new Map(),
      nowMs: 123
    });

    expect(outcome.submitResult?.accepted).toBe(true);
    expect(syncTreesAndGroundItems).toHaveBeenCalledTimes(1);
    expect(
      [...worldPort.getWorld().entities.values()].find((entity) => entity.kind === "tree")?.loggingMarked
    ).toBe(true);
  });
});
