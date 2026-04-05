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

  it("generic intent tool rejects when target includes blocked grid cell", () => {
    const stoneKey = "2,2";
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([stoneKey])
    };
    const world = createWorldCore({ grid });
    const r = applyDomainCommandToWorldCore(
      world,
      demoCmd("assign_tool_task:lumber", [stoneKey, "3,3"])
    );
    expect(r.result.accepted).toBe(false);
    expect(r.result.conflictCellKeys?.[0]).toBe(stoneKey);
    expect(r.world).toBe(world);
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
