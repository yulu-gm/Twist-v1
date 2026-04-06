import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const BUILD_INVALID_PLACEMENT_CELL = { col: 11, row: 5 } as const;

const invalidPlacementKey = coordKey(BUILD_INVALID_PLACEMENT_CELL);

export const BUILD_INVALID_PLACEMENT_SCENARIO: ScenarioDefinition = {
  name: "build-invalid-placement",
  description:
    "BUILD-003: a single-cell bed placement on an occupied tile is rejected explicitly and never creates a blueprint",
  seed: 0x42_55_49_33,
  pawns: [{ name: "Builder", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  trees: [{ cell: BUILD_INVALID_PLACEMENT_CELL }],
  worldPortConfig: {
    rejectIfTouchesCellKeys: [invalidPlacementKey]
  },
  playerSelectionAfterHydrate: [
    {
      label: "invalid-bed-placement",
      commandId: "place-bed",
      selectionModifier: "replace",
      cellKeys: [invalidPlacementKey],
      inputShape: "single-cell",
      semantics: "single-cell"
    }
  ],
  expectations: [
    {
      label: "invalid placement target is visibly occupied before the attempt",
      type: "entity-kind-exists",
      params: { entityKind: "tree", count: 1 }
    }
  ],
  manualAcceptance: {
    steps: [
      "Enter bed placement mode and click the occupied target tile.",
      "Use a visibly invalid single-cell placement instead of a brush stroke.",
      "Read the submit feedback after the click and compare it with the unchanged scene."
    ],
    outcomes: [
      "The system rejects the placement explicitly in the player-facing channel.",
      "No bed blueprint appears and no construct-blueprint work item is created for that tile.",
      "The blocking tree remains in place, making the failed placement visually understandable."
    ]
  }
};
