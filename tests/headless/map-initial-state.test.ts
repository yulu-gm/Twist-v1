import { describe, expect, it } from "vitest";
import { DEFAULT_SIM_CONFIG } from "../../src/game/behavior";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { createInitialTimeOfDayState, DEFAULT_TIME_OF_DAY_CONFIG } from "../../src/game/time";
import { createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import { simulationInteractionPoints } from "../../src/game/world-sim-bridge";
import { bootstrapWorldForScene } from "../../src/game/world-bootstrap";

describe("map initial state (bootstrap seeding)", () => {
  it("bootstrapWorldForScene 后存在足够树木与地面食物资源", () => {
    const { worldPort } = bootstrapWorldForScene({
      simConfig: DEFAULT_SIM_CONFIG,
      timeOfDayState: createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG),
      terrainDecorationSeed: 0x6d61_7000
    });
    const entities = [...worldPort.getWorld().entities.values()];
    const trees = entities.filter((e) => e.kind === "tree");
    const foods = entities.filter((e) => e.kind === "resource" && e.materialKind === "food");
    expect(trees.length).toBeGreaterThanOrEqual(8);
    expect(foods.length).toBeGreaterThanOrEqual(3);
    for (const t of trees) {
      expect(t.loggingMarked).toBe(false);
      expect(t.occupiedCells.length).toBe(0);
    }
    for (const r of foods) {
      expect(r.containerKind).toBe("ground");
      expect(r.pickupAllowed).toBe(false);
    }
  });

  it("手动生成可拾取地面食物后 simulationInteractionPoints 含 world-food- 交互点", () => {
    let w = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(w, {
      kind: "resource",
      cell: { col: 11, row: 5 },
      materialKind: "food",
      containerKind: "ground",
      pickupAllowed: true
    });
    expect(spawned.outcome.kind).toBe("created");
    w = spawned.world;
    const pts = simulationInteractionPoints(DEFAULT_WORLD_GRID, w);
    const prefix = "world-food-";
    expect(pts.some((p) => p.id.startsWith(prefix))).toBe(true);
  });
});
