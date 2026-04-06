import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/player/s0-contract";

const RESOURCE_A = { col: 10, row: 5 } as const;
const RESOURCE_B = { col: 11, row: 5 } as const;

const HAUL_MARK_PICKUP_CELLS: DomainCommand = {
  commandId: "scenario-haul-mark-pickup",
  verb: "assign_tool_task:haul",
  targetCellKeys: [coordKey(RESOURCE_A), coordKey(RESOURCE_B)],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "menu", menuId: "orders", itemId: "haul" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/** 固定 seed：2 份地面 food（默认不可拾取）→ hydrate 后提交 haul，生成 pick-up-resource 工单。 */
export const HAUL_MARK_PICKUP_SCENARIO: ScenarioDefinition = {
  name: "haul-mark-pickup",
  description: "haul 命令 → 地面物资 pickupAllowed + pick-up-resource 开放工单",
  seed: 0x68_61_75_6c_70,
  pawns: [{ name: "Hauler", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  resources: [
    { cell: RESOURCE_A, materialKind: "food", pickupAllowed: false },
    { cell: RESOURCE_B, materialKind: "food", pickupAllowed: false }
  ],
  domainCommandsAfterHydrate: [HAUL_MARK_PICKUP_CELLS],
  expectations: [
    {
      label: "已生成 pick-up-resource 开放工单",
      type: "work-item-exists",
      params: { workKind: "pick-up-resource", status: "open" }
    }
  ]
};
