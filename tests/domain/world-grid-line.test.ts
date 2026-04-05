import { describe, expect, it } from "vitest";
import { coordKey, gridLineCells, parseCoordKey } from "../../src/game/world-grid";

describe("world-grid grid line + parseCoordKey", () => {
  it("parseCoordKey round-trips coordKey", () => {
    const c = { col: 3, row: 7 };
    expect(parseCoordKey(coordKey(c))).toEqual(c);
  });

  it("parseCoordKey returns undefined for invalid input", () => {
    expect(parseCoordKey("")).toBeUndefined();
    expect(parseCoordKey("3")).toBeUndefined();
    expect(parseCoordKey("a,b")).toBeUndefined();
  });

  it("gridLineCells includes endpoints and steps diagonally when needed", () => {
    const cells = gridLineCells({ col: 0, row: 0 }, { col: 2, row: 2 });
    expect(cells.length).toBeGreaterThanOrEqual(3);
    expect(cells[0]).toEqual({ col: 0, row: 0 });
    expect(cells[cells.length - 1]).toEqual({ col: 2, row: 2 });
  });

  it("gridLineCells is stable for horizontal segments", () => {
    const cells = gridLineCells({ col: 1, row: 4 }, { col: 4, row: 4 });
    expect(cells.map(coordKey).join("|")).toBe("1,4|2,4|3,4|4,4");
  });
});
