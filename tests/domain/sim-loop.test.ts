import { describe, expect, it } from "vitest";
import { DEFAULT_SIM_CONFIG, tickSimulation } from "../../src/game/behavior";
import { DEFAULT_WORLD_GRID, createReservationSnapshot, coordKey } from "../../src/game/map/world-grid";
import { createDefaultPawnStates } from "../../src/game/pawn-state";

describe("sim-loop path caching", () => {
  it("continues along cached A* path between ticks for claimed work anchors", () => {
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([
        coordKey({ col: 6, row: 5 }),
        coordKey({ col: 7, row: 5 })
      ])
    };
    const pawn = createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!;
    const workWalkTargets = new Map([[pawn.id, { col: 8, row: 5 }]]);

    const first = tickSimulation({
      pawns: [pawn],
      reservations: createReservationSnapshot(),
      grid,
      simulationDt: 0.016,
      config: { ...DEFAULT_SIM_CONFIG, needGrowthPerSec: { hunger: 0, rest: 0, recreation: 0 } },
      rng: () => 0.5,
      workWalkTargets
    });

    expect(first.pawns[0]?.moveTarget).toEqual({ col: 5, row: 4 });
    expect(first.pawns[0]?.pathTarget).toEqual({ col: 8, row: 5 });
    expect(first.pawns[0]?.pathCells).toEqual([
      { col: 5, row: 4 },
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 8, row: 4 },
      { col: 8, row: 5 }
    ]);

    const second = tickSimulation({
      pawns: first.pawns,
      reservations: first.reservations,
      grid,
      simulationDt: 1,
      config: { ...DEFAULT_SIM_CONFIG, moveDurationSec: 0.1, needGrowthPerSec: { hunger: 0, rest: 0, recreation: 0 } },
      rng: () => 0.5,
      workWalkTargets
    });

    expect(second.pawns[0]?.logicalCell).toEqual({ col: 5, row: 4 });
    expect(second.pawns[0]?.moveTarget).toEqual({ col: 6, row: 4 });
    expect(second.pawns[0]?.pathCells).toEqual([
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 8, row: 4 },
      { col: 8, row: 5 }
    ]);
  });

  it("replans cached path when the next path step becomes blocked", () => {
    const baseGrid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([
        coordKey({ col: 6, row: 5 }),
        coordKey({ col: 7, row: 5 })
      ])
    };
    const pawn = createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!;
    const workWalkTargets = new Map([[pawn.id, { col: 8, row: 5 }]]);

    const first = tickSimulation({
      pawns: [pawn],
      reservations: createReservationSnapshot(),
      grid: baseGrid,
      simulationDt: 0.016,
      config: { ...DEFAULT_SIM_CONFIG, needGrowthPerSec: { hunger: 0, rest: 0, recreation: 0 } },
      rng: () => 0.5,
      workWalkTargets
    });

    const replannedGrid = {
      ...baseGrid,
      blockedCellKeys: new Set<string>([
        ...baseGrid.blockedCellKeys!,
        coordKey({ col: 6, row: 4 })
      ])
    };

    const replanned = tickSimulation({
      pawns: first.pawns,
      reservations: first.reservations,
      grid: replannedGrid,
      simulationDt: 1,
      config: { ...DEFAULT_SIM_CONFIG, moveDurationSec: 0.1, needGrowthPerSec: { hunger: 0, rest: 0, recreation: 0 } },
      rng: () => 0.5,
      workWalkTargets
    });

    expect(replanned.pawns[0]?.logicalCell).toEqual({ col: 5, row: 4 });
    expect(replanned.pawns[0]?.moveTarget).toEqual({ col: 5, row: 3 });
    expect(replanned.pawns[0]?.pathTarget).toEqual({ col: 8, row: 5 });
    expect(replanned.pawns[0]?.pathCells?.[0]).toEqual({ col: 5, row: 3 });
  });

  it("does not mark another pawn on the next step as a movement conflict", () => {
    const [pawn, blocker] = createDefaultPawnStates(
      [
        { col: 5, row: 5 },
        { col: 6, row: 5 }
      ],
      ["Mover", "Neighbor"]
    );
    const workWalkTargets = new Map([[pawn!.id, { col: 8, row: 5 }]]);

    const result = tickSimulation({
      pawns: [pawn!, blocker!],
      reservations: createReservationSnapshot(),
      grid: DEFAULT_WORLD_GRID,
      simulationDt: 0.016,
      config: { ...DEFAULT_SIM_CONFIG, needGrowthPerSec: { hunger: 0, rest: 0, recreation: 0 } },
      rng: () => 0.5,
      workWalkTargets
    });

    expect(result.pawnDecisionTraces[0]?.result.kind).toBe("move");
    expect(result.pawnDecisionTraces[0]?.result).toMatchObject({
      kind: "move",
      step: { col: 6, row: 5 }
    });
    expect(result.pawnDecisionTraces[0]?.result.blockedReason).toBeUndefined();
  });
});
