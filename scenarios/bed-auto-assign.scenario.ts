import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const BED_BLUEPRINT_CELL = { col: 11, row: 5 } as const;
const [spawnA, spawnB] = DEFAULT_WORLD_GRID.defaultSpawnPoints;

/** 两名小人、一张床蓝图；认领建造后落成，帧末自动将床分配给无床者。 */
export const BED_AUTO_ASSIGN_SCENARIO: ScenarioDefinition = {
  name: "bed-auto-assign",
  description: "双小人场景：床落成后 restSpot 分配给仍无归属的小人",
  seed: 0x42_45_44_41_41,
  blueprints: [{ kind: "bed", cell: BED_BLUEPRINT_CELL }],
  pawns: [
    { name: "Worker", cell: spawnA! },
    { name: "Idle", cell: spawnB! }
  ],
  claimConstructBlueprintAsPawnName: "Worker",
  expectations: [
    {
      label: "目标格已落成床建筑实体",
      type: "building-present",
      params: { buildingKind: "bed", cell: BED_BLUEPRINT_CELL },
      maxTicks: 2000
    }
  ],
  manualAcceptance: {
    steps: [
      "载入场景：Worker、Idle 各占默认出生前两格，(11,5) 附近有床蓝图。",
      "Worker 认领建造工单并走向工地；落成后观察床位是否分配给其中一名小人（另一人无床或视分配顺序）。"
    ],
    outcomes: [
      "无头验收：`building-present` 通过，且 `restSpots` 中该床 `ownerPawnId` 非空。"
    ]
  }
};

export { BED_BLUEPRINT_CELL };
