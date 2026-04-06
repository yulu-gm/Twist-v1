/**
 * refactor-test：WorldCore 直调砍树工单完成回归；邻近 ENTITY-001/002，非场景级主证据。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import {
  claimWorkItem,
  completeWorkItem,
  createWorldCore,
  spawnWorldEntity
} from "../../src/game/world-core";

describe("completeChopWork（WorldCore 直接工单完成）", () => {
  it("claim + completeWorkItem：树移除、地面木材与派生 pick-up-resource 开放工单", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const treeCell = { col: 4, row: 4 };
    const treeSpawn = spawnWorldEntity(world, {
      kind: "tree",
      cell: treeCell,
      occupiedCells: [],
      loggingMarked: true
    });
    expect(treeSpawn.outcome.kind).toBe("created");
    world = treeSpawn.world;
    const treeId = treeSpawn.entityId;

    const chopId = "work-chop-test";
    world.workItems.set(chopId, {
      id: chopId,
      kind: "chop-tree",
      anchorCell: { ...treeCell },
      targetEntityId: treeId,
      status: "open",
      failureCount: 0
    });

    const claimed = claimWorkItem(world, chopId, "pawn-worker");
    expect(claimed.outcome.kind).toBe("claimed");
    const completed = completeWorkItem(claimed.world, chopId, "pawn-worker");
    expect(completed?.outcome.kind).toBe("completed");

    const finalWorld = completed!.world;
    expect(finalWorld.entities.has(treeId)).toBe(false);

    const resources = [...finalWorld.entities.values()].filter((e) => e.kind === "resource");
    const woodOnGround = resources.filter(
      (e) =>
        e.materialKind === "wood" &&
        e.containerKind === "ground" &&
        e.pickupAllowed === true &&
        e.cell.col === treeCell.col &&
        e.cell.row === treeCell.row
    );
    expect(woodOnGround).toHaveLength(1);

    const pickups = [...finalWorld.workItems.values()].filter((w) => w.kind === "pick-up-resource");
    const derived = pickups.find((w) => w.status === "open" && w.derivedFromWorkId === chopId);
    expect(derived).toBeDefined();
    expect(derived!.targetEntityId).toBe(woodOnGround[0]!.id);

    const chop = finalWorld.workItems.get(chopId);
    expect(chop?.status).toBe("completed");
  });
});
