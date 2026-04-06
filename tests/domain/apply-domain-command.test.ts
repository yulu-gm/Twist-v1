import { describe, expect, it } from "vitest";
import {
  clearTaskMarkersAtCells,
  createWorldCore,
  getWorldSnapshot,
  placeTaskMarker,
  spawnWorldEntity
} from "../../src/game/world-core";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { seedBlockedCellsAsObstacles } from "../../src/game/map/world-seed";
import { applyDomainCommandToWorldCore } from "../../src/player/apply-domain-command";
import type { DomainCommand } from "../../src/player/s0-contract";

function demoCmd(verb: string, cellKeys: string[]): DomainCommand {
  return {
    commandId: "test-cmd",
    verb,
    targetCellKeys: cellKeys,
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId: "demolish" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    },
    issuedAtMs: 0
  };
}

describe("applyDomainCommandToWorldCore", () => {
  it("demolish places task markers on seeded stone obstacles", () => {
    const stoneKey = "3,3";
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([stoneKey])
    };
    let world = seedBlockedCellsAsObstacles(createWorldCore({ grid }), grid.blockedCellKeys!);
    const r = applyDomainCommandToWorldCore(world, demoCmd("assign_tool_task:demolish", [stoneKey]));
    expect(r.result.accepted).toBe(true);
    world = r.world;
    expect(getWorldSnapshot(world).markers.length).toBe(1);
    expect(getWorldSnapshot(world).workItems.length).toBe(1);
  });

  it("demolish rejects when no obstacle entity covers the cell", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const r = applyDomainCommandToWorldCore(world, demoCmd("assign_tool_task:demolish", ["1,1"]));
    expect(r.result.accepted).toBe(false);
    expect(r.world).toBe(world);
  });

  it("lumber skips blocked cells and registers chop work on remaining tree cells", () => {
    const stoneKey = "2,2";
    const treeCell = { col: 3, row: 3 };
    const treeKey = coordKey(treeCell);
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([stoneKey])
    };
    let world = createWorldCore({ grid });
    const treeSpawn = spawnWorldEntity(world, {
      kind: "tree",
      cell: treeCell,
      occupiedCells: [treeCell],
      loggingMarked: false
    });
    expect(treeSpawn.outcome.kind).toBe("created");
    world = treeSpawn.world;
    const r = applyDomainCommandToWorldCore(world, demoCmd("assign_tool_task:lumber", [stoneKey, treeKey]));
    expect(r.result.accepted).toBe(true);
    expect(r.result.messages[0]).toContain("跳过 1 个障碍格");
    expect(getWorldSnapshot(r.world).workItems.some((w) => w.kind === "chop-tree")).toBe(true);
  });

  it("mine registers mine-stone on seeded stone obstacles（含障碍格，不与 lumber 同属阻挡拒绝逻辑）", () => {
    const stoneKey = "3,3";
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([stoneKey])
    };
    let world = seedBlockedCellsAsObstacles(createWorldCore({ grid }), grid.blockedCellKeys!);
    const r = applyDomainCommandToWorldCore(world, {
      commandId: "test-cmd-mine-stone",
      verb: "assign_tool_task:mine",
      targetCellKeys: [stoneKey, "4,4"],
      targetEntityIds: [],
      sourceMode: {
        source: { kind: "toolbar", toolId: "mine" },
        selectionModifier: "replace",
        inputShape: "rect-selection"
      },
      issuedAtMs: 0
    });
    expect(r.result.accepted).toBe(true);
    expect(r.result.messages[0]).toContain("mine-stone");
    world = r.world;
    expect(getWorldSnapshot(world).workItems.some((w) => w.kind === "mine-stone" && w.status === "open")).toBe(true);
    const stoneEnt = [...world.entities.values()].find(
      (e) => e.kind === "obstacle" && e.label === "stone"
    );
    expect(stoneEnt?.miningMarked).toBe(true);
  });

  it("demolish rejects stone cell when mine-stone work is pending", () => {
    const stoneKey = "2,2";
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([stoneKey])
    };
    let world = seedBlockedCellsAsObstacles(createWorldCore({ grid }), grid.blockedCellKeys!);
    const mined = applyDomainCommandToWorldCore(world, demoCmd("assign_tool_task:mine", [stoneKey]));
    expect(mined.result.accepted).toBe(true);
    const r = applyDomainCommandToWorldCore(mined.world, demoCmd("assign_tool_task:demolish", [stoneKey]));
    expect(r.result.accepted).toBe(false);
    expect(r.result.conflictCellKeys?.[0]).toBe(stoneKey);
  });

  it("clear_task_markers removes markers and orphan open work items", () => {
    const cell = { col: 2, row: 2 };
    const key = coordKey(cell);
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const obstacle = spawnWorldEntity(world, {
      kind: "obstacle",
      cell,
      label: "rock"
    });
    expect(obstacle.outcome.kind).toBe("created");
    world = obstacle.world;
    const marked = placeTaskMarker(world, {
      kind: "deconstruct-obstacle",
      cell,
      targetEntityId: obstacle.entityId
    });
    world = marked.world;
    expect(getWorldSnapshot(world).markers.length).toBe(1);

    const cleared = applyDomainCommandToWorldCore(world, demoCmd("clear_task_markers", [key]));
    expect(cleared.result.accepted).toBe(true);
    expect(getWorldSnapshot(cleared.world).markers.length).toBe(0);
    expect(getWorldSnapshot(cleared.world).workItems.length).toBe(0);
  });
});

describe("clearTaskMarkersAtCells", () => {
  it("does not remove claimed work items", () => {
    const cell = { col: 1, row: 1 };
    const key = coordKey(cell);
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const obstacle = spawnWorldEntity(world, { kind: "obstacle", cell });
    world = obstacle.world;
    const marked = placeTaskMarker(world, {
      kind: "deconstruct-obstacle",
      cell,
      targetEntityId: obstacle.entityId
    });
    world = marked.world;
    const workId = marked.workItemId;
    const claimedWorld = {
      ...world,
      workItems: new Map(world.workItems)
    };
    const wi = claimedWorld.workItems.get(workId)!;
    claimedWorld.workItems.set(workId, { ...wi, status: "claimed", claimedBy: "pawn-0" });

    const next = clearTaskMarkersAtCells(claimedWorld, new Set([key]));
    expect(getWorldSnapshot(next).markers.length).toBe(0);
    expect(next.workItems.has(workId)).toBe(true);
  });
});
