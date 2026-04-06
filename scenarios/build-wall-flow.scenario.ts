import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/player/s0-contract";

/** 与床场景错开一行：领域命令放置墙蓝图（非初始 `blueprints` 列表）。 */
const WALL_CELL = { col: 11, row: 6 } as const;

const PLACE_WALL_BLUEPRINT: DomainCommand = {
  commandId: "scenario-build-wall-flow",
  verb: "build_wall_blueprint",
  targetCellKeys: [coordKey(WALL_CELL)],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "toolbar", toolId: "build_wall_blueprint" },
    selectionModifier: "replace",
    inputShape: "single-cell"
  }
};

/** 固定 seed：1 小人；装载后 `build_wall_blueprint` 生成 construct-blueprint 工单再认领建造。 */
export const BUILD_WALL_FLOW_SCENARIO: ScenarioDefinition = {
  name: "build-wall-flow",
  description: "build_wall_blueprint → 认领后走向锚格并落成墙实体",
  seed: 0x57_41_4c_4c_46,
  pawns: [{ name: "WallBuilder", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  claimConstructBlueprintAsPawnName: "WallBuilder",
  domainCommandsAfterHydrate: [PLACE_WALL_BLUEPRINT],
  expectations: [
    {
      label: "装载后存在蓝图建造工单",
      type: "work-item-exists",
      params: { workKind: "construct-blueprint" }
    },
    {
      label: "小人抵达后工单完成",
      type: "event-occurred",
      params: { eventKind: "work-completed" },
      maxTicks: 2_000
    },
    {
      label: "目标格已落成墙建筑实体",
      type: "building-present",
      params: { buildingKind: "wall", cell: WALL_CELL }
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景：出生点 WallBuilder；约 (11,6) 为墙蓝图占位。",
      "无头场景在 hydrate 末尾自动认领 construct-blueprint 工单。"
    ],
    outcomes: [
      "认领后小人沿格走向锚格，落成 `buildingKind: wall`（与单测 construct-blueprint 流水线一致）。"
    ]
  }
};
