import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/** 放置床蓝图后世界侧应生成待建造的 construct-blueprint 工单。 */
const BED_BLUEPRINT_CELL = { col: 11, row: 5 } as const;

export const BUILD_BED_FLOW_SCENARIO: ScenarioDefinition = {
  name: "build-bed-flow",
  description: "床蓝图认领后小人走向工地并落成实体床",
  seed: 0x42_45_44_46_4c,
  blueprints: [{ kind: "bed", cell: BED_BLUEPRINT_CELL }],
  /** 与 bootstrap 一致：出生点永不被随机石格占用，避免浏览器基线世界上叠载冲突。 */
  pawns: [{ name: "Builder", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  claimConstructBlueprintAsPawnName: "Builder",
  expectations: [
    {
      label: "装载后仍存在蓝图建造工单（已认领）",
      type: "work-item-exists",
      params: { workKind: "construct-blueprint" }
    },
    {
      label: "小人抵达工地后工单落成完成",
      type: "event-occurred",
      params: { eventKind: "work-completed" },
      maxTicks: 2_000
    },
    {
      label: "目标格已落成床建筑实体",
      type: "building-present",
      params: { buildingKind: "bed", cell: BED_BLUEPRINT_CELL }
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景：应在地图约 (11,5) 附近看到床铺蓝图占位，另有小人 Builder 在出生点。",
      "浏览器内若未接工单认领 UI：小人不会自动走向工地；无头场景通过 `claimConstructBlueprintAsPawnName` 认领后与编排器建造逻辑一致。",
      "若需核对工单：可通过「玩家通道」脚注中的世界快照文案，或后续在领域中暴露的工单列表 UI（当前以网格与小人行为为主）。"
    ],
    outcomes: [
      "无头验收：认领后 Builder 沿格走向锚格，工单落成并出现 `buildingKind: bed` 实体（与单测 `work-completed` + `building-present` 一致）。",
      "地图上该蓝图所占格有可见的蓝图/建造相关表现（依当前渲染为准）。",
      "浏览器内需有认领路径后，行为应与编排器中「认领 → 走向锚格 → 同一帧落成」一致。"
    ]
  }
};
