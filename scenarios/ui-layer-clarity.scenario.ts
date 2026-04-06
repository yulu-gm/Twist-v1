import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

export const UI_LAYER_CLARITY_ZONE_CELLS = [
  { col: 10, row: 5 },
  { col: 11, row: 5 },
  { col: 10, row: 6 },
  { col: 11, row: 6 }
] as const;

export const UI_LAYER_CLARITY_BLUEPRINT_CELL = { col: 10, row: 5 } as const;
export const UI_LAYER_CLARITY_MARKER_RESOURCE_CELLS = [
  { col: 11, row: 5 },
  { col: 11, row: 6 }
] as const;

export const UI_LAYER_CLARITY_SCENARIO: ScenarioDefinition = {
  name: "ui-layer-clarity",
  description:
    "UI-004: a single 2x2 focus area preloads zone border, blueprint ghost, and haul markers so a live selection frame can be checked on top",
  seed: 0x55_49_30_34,
  pawns: [{ name: "Viewer", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  zones: [{ cells: UI_LAYER_CLARITY_ZONE_CELLS, zoneKind: "storage" }],
  blueprints: [{ kind: "bed", cell: UI_LAYER_CLARITY_BLUEPRINT_CELL }],
  resources: UI_LAYER_CLARITY_MARKER_RESOURCE_CELLS.map((cell) => ({
    cell,
    materialKind: "food",
    pickupAllowed: false
  })),
  playerSelectionAfterHydrate: [
    {
      label: "haul-mark-layer-cluster",
      commandId: "haul",
      selectionModifier: "replace",
      cellKeys: UI_LAYER_CLARITY_ZONE_CELLS.map(coordKey),
      inputShape: "rect-selection",
      semantics: "rect-selection"
    }
  ],
  uiObservation: {
    layers: [
      "selection-frame observation target: drag over the 2x2 cluster covering 10,5 to 11,6",
      "blueprint-ghost anchor: bed blueprint at 10,5 inside the same 2x2 cluster",
      "marker overlay anchors: haul-backed markers on 11,5 and 11,6",
      "zone boundary anchor: storage border enclosing all four cells of the 2x2 cluster"
    ]
  },
  expectations: [
    {
      label: "zone boundary layer exists",
      type: "entity-kind-exists",
      params: { entityKind: "zone", count: 1 }
    },
    {
      label: "blueprint ghost layer exists",
      type: "entity-kind-exists",
      params: { entityKind: "blueprint", count: 1 }
    },
    {
      label: "marker-backed haul work exists",
      type: "work-item-exists",
      params: { workKind: "pick-up-resource", status: "open" }
    }
  ],
  manualAcceptance: {
    steps: [
      "（UI-004）载入后将镜头对准 10,5–11,6 的 2×2 焦点区。",
      "（UI-004）确认区内已同时存在 storage 区划边界、床蓝图虚影、搬运标记，再叠加一次新的矩形选区框。",
      "（UI-004）多次拖入/拖出选区，观察各层仍可分辨、无明显闪烁或 Z-fighting。",
      "Load the scene and center the camera on the 2x2 focus area from 10,5 to 11,6.",
      "Confirm that the area already contains a storage zone border, a bed blueprint ghost, and haul markers before adding any extra live selection.",
      "Drag a fresh rect-selection over the same 2x2 area so the active selection frame stacks on top of those preloaded layers.",
      "Toggle the drag on and off a few times to check that the stack remains readable and stable."
    ],
    outcomes: [
      "选区框、蓝图虚影、搬运标记与区划边界在同一簇格子上仍可区分（UI-004）。",
      "叠层顺序稳定，框显隐时无严重遮挡或闪烁。",
      "The selection frame, blueprint ghost, haul marker, and zone boundary can all be distinguished within the same 2x2 cluster.",
      "The stack order stays stable without severe occlusion, flicker, or z-fighting while the frame appears and disappears.",
      "The blueprint remains readable as a ghost, the haul markers remain readable as task feedback, and the zone border still defines the area boundary."
    ]
  }
};
