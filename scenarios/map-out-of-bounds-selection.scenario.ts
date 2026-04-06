import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const MAP_OUT_OF_BOUNDS_VALID_RESOURCE_CELLS = [
  { col: 0, row: 8 },
  { col: 1, row: 8 },
  { col: 0, row: 9 }
] as const;

export const MAP_OUT_OF_BOUNDS_SELECTION_KEYS = [
  coordKey({ col: -1, row: 8 }),
  coordKey({ col: 0, row: 8 }),
  coordKey({ col: 1, row: 8 }),
  coordKey({ col: -1, row: 9 }),
  coordKey({ col: 0, row: 9 }),
  coordKey({ col: 1, row: 9 })
] as const;

export const MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO: ScenarioDefinition = {
  name: "map-out-of-bounds-selection",
  description:
    "MAP-004: an edge selection mixes out-of-bounds keys with valid cells, but only in-bounds cells become actionable",
  seed: 0x4d_41_50_34,
  pawns: [{ name: "EdgeHauler", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  resources: MAP_OUT_OF_BOUNDS_VALID_RESOURCE_CELLS.map((cell) => ({
    cell,
    materialKind: "food",
    pickupAllowed: false
  })),
  playerSelectionAfterHydrate: [
    {
      label: "edge-rect-selection",
      commandId: "haul",
      selectionModifier: "replace",
      cellKeys: MAP_OUT_OF_BOUNDS_SELECTION_KEYS,
      inputShape: "rect-selection",
      semantics: "rect-selection"
    }
  ],
  uiObservation: {
    layers: [
      "selection-preview clips at the left map edge instead of extending into negative columns",
      "only in-bounds edge cells become haul targets after the rect-selection is committed",
      "no marker or target feedback should appear outside the playable grid"
    ]
  },
  expectations: [
    {
      label: "edge selection still creates at least one valid pickup work item",
      type: "work-item-exists",
      params: { workKind: "pick-up-resource", status: "open" }
    }
  ],
  manualAcceptance: {
    steps: [
      "Drag a rectangular selection from outside the left edge back into the bottom-left corner of the map.",
      "Keep the drag crossing the map border so part of the rectangle lies beyond the grid.",
      "Submit the selection and observe which cells stay actionable."
    ],
    outcomes: [
      "The visible selection is clipped to the playable map instead of highlighting negative columns.",
      "Only the in-bounds resource cells receive haul feedback or work items.",
      "No out-of-bounds marker, zone, or actionable cell survives the submit."
    ]
  }
};
