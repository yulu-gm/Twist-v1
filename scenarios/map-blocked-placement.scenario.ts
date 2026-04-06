import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const MAP_BLOCKED_PLACEMENT_BLOCKED_CELL = { col: 12, row: 5 } as const;
export const MAP_BLOCKED_PLACEMENT_FREE_CELL = { col: 13, row: 5 } as const;

const blockedPlacementKey = coordKey(MAP_BLOCKED_PLACEMENT_BLOCKED_CELL);

export const MAP_BLOCKED_PLACEMENT_SCENARIO: ScenarioDefinition = {
  name: "map-blocked-placement",
  description:
    "MAP-003: a blocked map cell rejects wall placement and surfaces an explicit refusal instead of silently doing nothing",
  seed: 0x4d_41_50_33,
  pawns: [{ name: "Builder", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  obstacles: [{ cell: MAP_BLOCKED_PLACEMENT_BLOCKED_CELL, label: "scenario-stone-blocker" }],
  worldPortConfig: {
    rejectIfTouchesCellKeys: [blockedPlacementKey]
  },
  playerSelectionAfterHydrate: [
    {
      label: "blocked-wall-brush",
      toolId: "build",
      selectionModifier: "replace",
      cellKeys: [blockedPlacementKey, coordKey(MAP_BLOCKED_PLACEMENT_FREE_CELL)],
      inputShape: "brush-stroke",
      semantics: "brush-stroke"
    }
  ],
  expectations: [
    {
      label: "blocked placement scene keeps its obstacle visible",
      type: "entity-kind-exists",
      params: { entityKind: "obstacle", count: 1 }
    }
  ],
  manualAcceptance: {
    steps: [
      "Enter wall build mode and drag a short wall stroke that crosses the blocked map cell.",
      "Release the stroke on the blocked tile instead of rerouting around it.",
      "Check both the visible blocker and the player-facing submit feedback."
    ],
    outcomes: [
      "The system rejects the placement explicitly instead of accepting and skipping it silently.",
      "The blocked cell remains occupied by the obstacle and no wall blueprint or construct work appears on top of it.",
      "The feedback makes the refusal visible as a blocked placement, not just as an unchanged world."
    ]
  }
};
