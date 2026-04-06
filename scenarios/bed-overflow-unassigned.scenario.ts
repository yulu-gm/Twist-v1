import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const BED_OVERFLOW_CELLS = [
  { col: 11, row: 5 },
  { col: 12, row: 5 },
  { col: 13, row: 5 }
] as const;

const [spawnA, spawnB] = DEFAULT_WORLD_GRID.defaultSpawnPoints;

export const BED_OVERFLOW_UNASSIGNED_SCENARIO: ScenarioDefinition = {
  name: "bed-overflow-unassigned",
  description:
    "BUILD-004: three beds are built for two pawns so the extra bed remains visibly unassigned",
  seed: 0x42_55_49_34,
  blueprints: BED_OVERFLOW_CELLS.map((cell) => ({ kind: "bed" as const, cell })),
  pawns: [
    { name: "BuilderA", cell: spawnA! },
    { name: "BuilderB", cell: spawnB! }
  ],
  claimConstructBlueprintAsPawnName: "BuilderA",
  tickScheduleAfterHydrate: [16, 16],
  expectations: BED_OVERFLOW_CELLS.map((cell, index) => ({
    label: `bed ${index + 1} is eventually built`,
    type: "building-present" as const,
    params: { buildingKind: "bed", cell },
    maxTicks: 16_000
  })),
  manualAcceptance: {
    steps: [
      "Load the scene with three bed blueprints and only two pawns available to own them.",
      "Let construction finish for all three beds before checking ownership.",
      "Inspect each finished bed in the UI or visible ownership readout."
    ],
    outcomes: [
      "All three beds are built successfully; this is not a build failure case.",
      "Two beds gain owners because only two pawns are available.",
      "The extra bed stays explicitly unassigned instead of inventing a third owner or reusing an already-owned pawn."
    ]
  }
};
