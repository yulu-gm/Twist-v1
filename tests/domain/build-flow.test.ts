import { describe, expect, it, vi } from "vitest";
import { createEntityRegistry } from "../../src/game/entity/entity-registry";
import * as relationshipRules from "../../src/game/entity/relationship-rules";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import {
  runBuildBedScenario,
  runBuildFlowScenario,
  runBuildWallScenario
} from "../../src/game/flows/build-flow";
import { createWorkRegistry } from "../../src/game/work/work-registry";

describe("build-flow", () => {
  it("床：落成 buildingKind=bed，无床小人获得 bedBuildingId 与床 ownership 一致", () => {
    const entities = createEntityRegistry();
    const anchor = { col: 7, row: 8 };
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 80,
      energy: 80
    });

    const work = createWorkRegistry();
    const res = runBuildBedScenario(entities, work, anchor, pawn.id);

    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;

    const building = entities.get(res.buildingId);
    expect(building?.kind).toBe("building");
    if (building?.kind !== "building") return;
    expect(building.buildingKind).toBe("bed");

    const updated = entities.get(pawn.id);
    expect(updated?.kind).toBe("pawn");
    if (updated?.kind !== "pawn") return;
    expect(updated.bedBuildingId).toBe(res.buildingId);
    expect(building.ownership?.ownerPawnId).toBe(pawn.id);

    const v = relationshipRules.validateBedOwnership(entities);
    expect(v.ok).toBe(true);
  });

  it("墙：落成 buildingKind=wall，不触发床铺分配，小人不新增 bedBuildingId", () => {
    const assignSpy = vi.spyOn(relationshipRules, "assignBedToPawn");

    try {
      const entities = createEntityRegistry();
      const anchor = { col: 4, row: 4 };
      const pawn = entities.create({
        kind: "pawn",
        cell: { col: 1, row: 1 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 70,
        energy: 70
      });
      expect(pawn.kind).toBe("pawn");
      if (pawn.kind !== "pawn") return;
      expect(pawn.bedBuildingId).toBeUndefined();

      const work = createWorkRegistry();
      const res = runBuildWallScenario(entities, work, anchor, pawn.id);

      expect(res.kind).toBe("ok");
      if (res.kind !== "ok") return;

      expect(assignSpy).not.toHaveBeenCalled();

      const building = entities.get(res.buildingId);
      expect(building?.kind).toBe("building");
      if (building?.kind !== "building") return;
      expect(building.buildingKind).toBe("wall");

      const updated = entities.get(pawn.id);
      expect(updated?.kind).toBe("pawn");
      if (updated?.kind !== "pawn") return;
      expect(updated.bedBuildingId).toBeUndefined();
    } finally {
      assignSpy.mockRestore();
    }
  });

  it("runBuildFlowScenario('bed') 走完床落成与分配", () => {
    const entities = createEntityRegistry();
    const work = createWorkRegistry();
    const anchor = { col: 5, row: 5 };
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 55,
      energy: 55
    });

    const res = runBuildFlowScenario(entities, work, "bed", anchor, pawn.id);
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;

    const b = entities.get(res.buildingId);
    expect(b?.kind).toBe("building");
    if (b?.kind !== "building") return;
    expect(b.buildingKind).toBe("bed");
    expect(res.assignedPawnId).toBe(pawn.id);
  });

  it("越界：placement-rejected / out-of-bounds，不创建蓝图", () => {
    const entities = createEntityRegistry();
    const work = createWorkRegistry();
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    const res = runBuildBedScenario(entities, work, { col: 25, row: 0 }, pawn.id);
    expect(res.kind).toBe("placement-rejected");
    if (res.kind !== "placement-rejected") return;
    expect(res.reason).toBe("out-of-bounds");
    expect(entities.getByKind("blueprint")).toHaveLength(0);
  });

  it("占格冲突：placement-rejected / cell-occupied", () => {
    const entities = createEntityRegistry();
    const anchor = { col: 3, row: 3 };
    entities.create({
      kind: "building",
      buildingKind: "wall",
      cell: anchor,
      coveredCells: [anchor],
      interactionCapabilities: []
    });
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    const work = createWorkRegistry();
    const res = runBuildWallScenario(entities, work, anchor, pawn.id);
    expect(res.kind).toBe("placement-rejected");
    if (res.kind !== "placement-rejected") return;
    expect(res.reason).toBe("cell-occupied");
    expect(res.blockingEntityId).toBeDefined();
    expect(entities.getByKind("blueprint")).toHaveLength(0);
  });

  it("不可行走格（地图阻挡）：placement-rejected / blocked-terrain", () => {
    const entities = createEntityRegistry();
    const anchor = { col: 2, row: 2 };
    const gridConfig = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set([coordKey(anchor)])
    };
    const pawn = entities.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    const work = createWorkRegistry();
    const res = runBuildBedScenario(entities, work, anchor, pawn.id, { gridConfig });
    expect(res.kind).toBe("placement-rejected");
    if (res.kind !== "placement-rejected") return;
    expect(res.reason).toBe("blocked-terrain");
    expect(entities.getByKind("blueprint")).toHaveLength(0);
  });
});
