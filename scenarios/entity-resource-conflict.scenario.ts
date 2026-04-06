import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const ENTITY_RESOURCE_CONFLICT_CELL = { col: 10, row: 5 } as const;
export const ENTITY_RESOURCE_CONFLICT_ZONE_CELLS = [
  { col: 13, row: 5 },
  { col: 14, row: 5 }
] as const;

const [spawnA, spawnB] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
const conflictKey = coordKey(ENTITY_RESOURCE_CONFLICT_CELL);

export const ENTITY_RESOURCE_CONFLICT_SCENARIO: ScenarioDefinition = {
  name: "entity-resource-conflict",
  description:
    "ENTITY-004: a second claim against a contended resource cell is rejected explicitly and the resource stays singular",
  seed: 0x45_4e_54_34,
  pawns: [
    { name: "CarrierA", cell: spawnA! },
    { name: "CarrierB", cell: spawnB! }
  ],
  resources: [{ cell: ENTITY_RESOURCE_CONFLICT_CELL, materialKind: "wood", pickupAllowed: false }],
  zones: [{ cells: ENTITY_RESOURCE_CONFLICT_ZONE_CELLS, zoneKind: "storage" }],
  worldPortConfig: {
    rejectIfTouchesCellKeys: [conflictKey]
  },
  playerSelectionAfterHydrate: [
    {
      label: "second-claim-on-contended-resource",
      commandId: "haul",
      selectionModifier: "replace",
      cellKeys: [conflictKey],
      inputShape: "rect-selection",
      semantics: "rect-selection"
    }
  ],
  expectations: [
    {
      label: "conflict scene still starts with exactly one loose resource",
      type: "entity-kind-exists",
      params: { entityKind: "resource", count: 1 }
    }
  ],
  manualAcceptance: {
    steps: [
      "Load the scene with two pawns near one loose wood resource and a nearby storage target.",
      "Treat the resource cell as already contended, then issue a second haul or pickup attempt against that same cell.",
      "Observe the player-facing result instead of relying only on the final world state."
    ],
    outcomes: [
      "The second attempt is rejected explicitly in the player channel with a world-gateway rejection line.",
      "The loose wood stays singular: it does not duplicate, teleport, or appear on both pawns at once.",
      "No duplicate storage copy appears and the losing pawn does not gain ownership of the resource."
    ]
  }
};
