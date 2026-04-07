import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID, type WorldGridConfig } from "../../src/game/map/world-grid";
import { createWorldCore, removeWorldEntity, spawnWorldEntity } from "../../src/game/world-core";
import {
  obstacleBlockedCellKeys,
  simulationImpassableCellKeys,
  simulationInteractionPoints,
  syncWorldGridForSimulation
} from "../../src/game/world-sim-bridge";

/** 含 bed/food 样板供 simulationInteractionPoints 取时长与 needDelta（非 (0,0) 幽灵兜底）。 */
const GRID_WITH_INTERACTION_PROTOTYPES: WorldGridConfig = {
  ...DEFAULT_WORLD_GRID,
  interactionPoints: [
    {
      id: "template-bed-proto",
      kind: "bed",
      cell: { col: 1, row: 1 },
      useDurationSec: 3.6,
      needDelta: { rest: -65 }
    },
    {
      id: "template-food-proto",
      kind: "food",
      cell: { col: 1, row: 2 },
      useDurationSec: 2.4,
      needDelta: { hunger: -55 }
    }
  ]
};

describe("world-sim-bridge", () => {
  it("simulationImpassableCellKeys 含 obstacle、wall、树与蓝图占格", () => {
    let w = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const o = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: { col: 1, row: 1 },
      occupiedCells: [{ col: 1, row: 1 }]
    });
    w = o.world;
    const b = spawnWorldEntity(w, {
      kind: "building",
      cell: { col: 10, row: 5 },
      occupiedCells: [{ col: 10, row: 5 }],
      buildingKind: "wall",
      label: "w"
    });
    w = b.world;
    const t = spawnWorldEntity(w, {
      kind: "tree",
      cell: { col: 3, row: 3 },
      occupiedCells: [{ col: 3, row: 3 }],
      loggingMarked: false
    });
    w = t.world;
    const bp = spawnWorldEntity(w, {
      kind: "blueprint",
      cell: { col: 7, row: 2 },
      occupiedCells: [{ col: 7, row: 2 }, { col: 8, row: 2 }],
      blueprintKind: "wall",
      buildProgress01: 0,
      buildState: "planned"
    });
    w = bp.world;
    expect(simulationImpassableCellKeys(w)).toEqual(new Set(["1,1", "10,5", "3,3", "7,2", "8,2"]));
  });

  it("obstacleBlockedCellKeys 收集 obstacle 占用格", () => {
    let w = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const s = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: { col: 1, row: 2 },
      occupiedCells: [{ col: 1, row: 2 }, { col: 2, row: 2 }]
    });
    expect(s.outcome.kind).toBe("created");
    w = s.world;
    expect(obstacleBlockedCellKeys(w)).toEqual(new Set(["1,2", "2,2"]));
  });

  it("拆除障碍后障碍格集合缩小", () => {
    let w = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const s = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: { col: 3, row: 3 },
      occupiedCells: [{ col: 3, row: 3 }]
    });
    w = s.world;
    const rm = removeWorldEntity(w, s.entityId);
    expect(rm.outcome.kind).toBe("removed");
    expect(obstacleBlockedCellKeys(rm.world).size).toBe(0);
  });

  it("simulationInteractionPoints 为世界 restSpots 追加床位", () => {
    const w = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const withSpots = {
      ...w,
      restSpots: [
        {
          buildingEntityId: "b1",
          cell: { col: 2, row: 2 },
          assignmentReason: "unassigned" as const
        }
      ]
    };
    const pts = simulationInteractionPoints(GRID_WITH_INTERACTION_PROTOTYPES, withSpots);
    const ids = pts.map((p) => p.id);
    expect(ids.some((id) => id === "world-rest-b1")).toBe(true);
    const dynamic = pts.find((p) => p.id === "world-rest-b1");
    expect(dynamic?.cell).toEqual({ col: 2, row: 2 });
  });

  it("syncWorldGridForSimulation 就地更新 blocked 与 interactionPoints", () => {
    const grid: typeof DEFAULT_WORLD_GRID = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set()
    };
    let w = createWorldCore({ grid });
    const s = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: { col: 0, row: 0 },
      occupiedCells: [{ col: 0, row: 0 }]
    });
    w = s.world;

    const r = syncWorldGridForSimulation(grid, w, GRID_WITH_INTERACTION_PROTOTYPES, null);
    expect(r.blockedChanged).toBe(true);
    expect(grid.blockedCellKeys?.has("0,0")).toBe(true);
    expect(r.next.interactionPointIds.length).toBeGreaterThan(0);
  });
});
