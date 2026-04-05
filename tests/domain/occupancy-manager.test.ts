import { describe, expect, it } from "vitest";

import {
  checkPlacement,
  createOccupancyMap,
  findBlockingOccupant,
  getOccupant,
  isOccupied,
  occupy,
  release
} from "../../src/game/map/occupancy-manager";
import { createWorldCore } from "../../src/game/world-core";
import { spawnWorldEntity } from "../../src/game/world-internal";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";

describe("occupancy-manager", () => {
  const cell = (col: number, row: number) => ({ col, row });

  it("occupy 空格成功", () => {
    const map = createOccupancyMap();
    const r = occupy(map, cell(1, 1), "entity-1");
    expect(r).toEqual({ ok: true });
    expect(getOccupant(map, cell(1, 1))).toBe("entity-1");
    expect(isOccupied(map, cell(1, 1))).toBe(true);
  });

  it("occupy 同实体重复占格为成功（幂等写入）", () => {
    const map = createOccupancyMap();
    expect(occupy(map, cell(0, 0), "a")).toEqual({ ok: true });
    expect(occupy(map, cell(0, 0), "a")).toEqual({ ok: true });
    expect(getOccupant(map, cell(0, 0))).toBe("a");
  });

  it("occupy 冲突时返回占用者且不修改", () => {
    const map = createOccupancyMap();
    occupy(map, cell(2, 2), "entity-a");
    const r = occupy(map, cell(2, 2), "entity-b");
    expect(r).toEqual({
      ok: false,
      cell: cell(2, 2),
      occupantId: "entity-a"
    });
    expect(getOccupant(map, cell(2, 2))).toBe("entity-a");
  });

  it("release：仅当占有人匹配时删除；否则幂等不报错", () => {
    const map = createOccupancyMap();
    occupy(map, cell(3, 4), "x");
    release(map, cell(3, 4), "y");
    expect(getOccupant(map, cell(3, 4))).toBe("x");
    release(map, cell(3, 4), "x");
    expect(getOccupant(map, cell(3, 4))).toBeUndefined();
    release(map, cell(3, 4), "x");
    expect(getOccupant(map, cell(3, 4))).toBeUndefined();
  });

  it("checkPlacement 批量：汇总与逐项、firstConflict", () => {
    const map = createOccupancyMap();
    occupy(map, cell(1, 0), "blocker");
    const cells = [cell(0, 0), cell(1, 0), cell(2, 0)];
    const check = checkPlacement(map, cells);
    expect(check.allClear).toBe(false);
    expect(check.firstConflict).toEqual({ cell: cell(1, 0), occupantId: "blocker" });
    expect(check.entries).toEqual([
      { cell: cell(0, 0), ok: true },
      { cell: cell(1, 0), ok: false, reason: "occupied", occupantId: "blocker" },
      { cell: cell(2, 0), ok: true }
    ]);
  });

  it("checkPlacement 可忽略 self，与 findBlockingOccupant 一致", () => {
    const map = createOccupancyMap();
    occupy(map, cell(5, 5), "self");
    occupy(map, cell(6, 5), "other");
    const cells = [cell(5, 5), cell(6, 5)];
    const check = checkPlacement(map, cells, { ignoreOccupantId: "self" });
    expect(check.allClear).toBe(false);
    expect(check.firstConflict).toEqual({ cell: cell(6, 5), occupantId: "other" });
    const block = findBlockingOccupant(map, cells, "self");
    expect(block).toEqual({
      blockingEntityId: "other",
      blockingCell: cell(6, 5)
    });
  });

  it("回归：spawnWorldEntity 冲突与 world-core occupancy 一致", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const first = spawnWorldEntity(world, {
      kind: "obstacle",
      cell: cell(4, 4),
      occupiedCells: [cell(4, 4), cell(5, 4)]
    });
    expect(first.outcome.kind).toBe("created");

    const second = spawnWorldEntity(first.world, {
      kind: "obstacle",
      cell: cell(5, 4),
      occupiedCells: [cell(5, 4)]
    });
    expect(second.outcome.kind).toBe("conflict");
    if (second.outcome.kind === "conflict") {
      expect(second.outcome.blockingEntityId).toBe(first.entityId);
      expect(second.outcome.blockingCell).toEqual(cell(5, 4));
    }
    expect(getOccupant(first.world.occupancy, cell(5, 4))).toBe(first.entityId);
  });
});
