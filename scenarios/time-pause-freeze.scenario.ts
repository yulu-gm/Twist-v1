import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map/world-grid";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/player/s0-contract";

const PAWN_CELL = DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!;
const TREE_CELL = { col: 10, row: 5 } as const;

const LUMBER_ON_TREE: DomainCommand = {
  commandId: "scenario-time-pause-freeze-lumber",
  verb: "assign_tool_task:lumber",
  targetCellKeys: [coordKey(TREE_CELL)],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "menu", menuId: "orders", itemId: "lumber" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/** 先让小人进入可见移动/工作链路，再由验收过程触发暂停并观察冻结。 */
export const TIME_PAUSE_FREEZE_SCENARIO: ScenarioDefinition = {
  name: "time-pause-freeze",
  description: "伐木前往中的小人用于验证暂停后时间、位移与动作读条同时冻结",
  seed: 0x54_49_4d_45_33,
  pawns: [
    {
      name: "FreezeWalker",
      cell: PAWN_CELL,
      overrides: {
        satiety: 95,
        energy: 92,
        needs: { hunger: 2, rest: 4, recreation: 3 }
      }
    }
  ],
  trees: [{ cell: TREE_CELL }],
  timeConfig: { startMinuteOfDay: 9 * 60 },
  domainCommandsAfterHydrate: [LUMBER_ON_TREE],
  expectations: [
    {
      label: "暂停前已经出现工单认领",
      type: "event-occurred",
      params: { eventKind: "work-claimed" },
      maxTicks: 400
    },
    {
      label: "暂停前已经出现可见位移",
      type: "event-occurred",
      params: { eventKind: "pawn-moved" },
      maxTicks: 500
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认树位于 (10,5)，小人 FreezeWalker 会在装载后自动得到一张 chop-tree 工单并开始前往树边。",
      "等 FreezeWalker 已经开始移动或已经认领工单后，点击 HUD 的「暂停」。",
      "保持暂停数秒，观察 HUD 时间、小人位置、当前 goal / action 和工单状态是否都停在当前帧。"
    ],
    outcomes: [
      "暂停后 HUD 时间不再前进，FreezeWalker 也不会继续跨格移动或推进动作。",
      "暂停不会偷偷完成 chop-tree，也不会在后台继续触发新的目标切换或需求推进。",
      "恢复前，场景应保持“冻结”而不是“只是时间停住但角色还在走”。"
    ]
  }
};
