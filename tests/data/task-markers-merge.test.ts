import { describe, expect, it } from "vitest";
import {
  issuedTaskLabelForToolId,
  mergeTaskMarkerOverlayWithWorldSnapshot
} from "../../src/data/task-markers";
import {
  createWorldCore,
  getWorldSnapshot,
  placeTaskMarker,
  spawnWorldEntity
} from "../../src/game/world-core";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/world-grid";

describe("mergeTaskMarkerOverlayWithWorldSnapshot", () => {
  it("removes stale domain-backed labels when snapshot no longer has marker", () => {
    const demolish = issuedTaskLabelForToolId("demolish")!;
    const overlay = new Map([["1,1", demolish]]);
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const merged = mergeTaskMarkerOverlayWithWorldSnapshot(overlay, getWorldSnapshot(world));
    expect(merged.has("1,1")).toBe(false);
  });

  it("writes demolish label from deconstruct marker and keeps lumber overlay on other cells", () => {
    const cell = { col: 2, row: 2 };
    const key = coordKey(cell);
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const obs = spawnWorldEntity(world, { kind: "obstacle", cell });
    expect(obs.outcome.kind).toBe("created");
    world = obs.world;
    const marked = placeTaskMarker(world, {
      kind: "deconstruct-obstacle",
      cell,
      targetEntityId: obs.entityId
    });
    world = marked.world;

    const lumber = issuedTaskLabelForToolId("lumber")!;
    const overlay = new Map<string, string>([
      [key, "wrong"],
      ["5,5", lumber]
    ]);
    const merged = mergeTaskMarkerOverlayWithWorldSnapshot(overlay, getWorldSnapshot(world));
    expect(merged.get(key)).toBe(issuedTaskLabelForToolId("demolish"));
    expect(merged.get("5,5")).toBe(lumber);
  });
});
