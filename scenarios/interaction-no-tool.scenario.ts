import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const INTERACTION_NO_TOOL_CLICK_CELL = { col: 10, row: 5 } as const;
export const INTERACTION_NO_TOOL_DRAG_CELLS = [
  { col: 10, row: 5 },
  { col: 11, row: 5 },
  { col: 12, row: 5 }
] as const;

export const INTERACTION_NO_TOOL_SCENARIO: ScenarioDefinition = {
  name: "interaction-no-tool",
  description:
    "INTERACT-004: click and drag inputs stay inert while the player has no active tool selected",
  seed: 0x49_4e_54_34,
  pawns: [{ name: "Observer", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  resources: [{ cell: INTERACTION_NO_TOOL_CLICK_CELL, materialKind: "food", pickupAllowed: false }],
  trees: [{ cell: { col: 12, row: 5 } }],
  playerSelectionAfterHydrate: [
    {
      label: "no-tool-click",
      commandId: "idle",
      selectionModifier: "replace",
      cellKeys: [coordKey(INTERACTION_NO_TOOL_CLICK_CELL)],
      inputShape: "single-cell",
      semantics: "no-tool"
    },
    {
      label: "no-tool-drag",
      commandId: "idle",
      selectionModifier: "replace",
      cellKeys: INTERACTION_NO_TOOL_DRAG_CELLS.map(coordKey),
      inputShape: "brush-stroke",
      semantics: "no-tool"
    }
  ],
  expectations: [
    {
      label: "scene keeps one actionable-looking resource for the idle-input check",
      type: "entity-kind-exists",
      params: { entityKind: "resource", count: 1 }
    }
  ],
  manualAcceptance: {
    steps: [
      "Return the player to observe mode with no active tool selected.",
      "Click the loose resource and then drag across the nearby cells as if starting a command.",
      "Watch for previews, task markers, blueprints, or submit feedback."
    ],
    outcomes: [
      "No selection command is submitted to the world while the semantic mode is no-tool.",
      "No selection frame, brush trail, blueprint, or work item appears as a side effect.",
      "The scene stays inert except for harmless observe-mode feedback such as a prompt to pick a tool first."
    ]
  }
};
