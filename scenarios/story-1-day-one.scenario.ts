import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition, ScenarioExpectation } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/game/interaction/domain-command-types";

/**
 * Story-1 第一天集成场景：固定布局、3 小人、1 树、2 份地面食物（不可拾取直至 haul）。
 * 存储区、墙/床蓝图由测试侧按序 domain submit（不使用 bootstrapWorldForScene）。
 *
 * 期望分段见 {@link STORY_1_DAY_ONE_EXPECTATION_GROUPS}，供 tests/headless/story-1-day-one.test.ts 在逐步 submit 后运行。
 * 场景 ID：MAP-001、MAP-002、WORK-002、WORK-001、BUILD-001、BUILD-002、NEED-002、BEHAVIOR-003。
 */

export const STORY_1_TREE_CELL = { col: 17, row: 5 } as const;
export const STORY_1_FOOD_CELLS = [
  { col: 11, row: 5 },
  { col: 12, row: 5 }
] as const;
/** zone_create 目标格（ hydrate 时为空地，由测试提交命令创建）。需保留至少一空位供木材入区：两格已被两份食物占满。 */
export const STORY_1_ZONE_CELLS = [
  { col: 13, row: 5 },
  { col: 14, row: 5 },
  { col: 15, row: 5 }
] as const;
export const STORY_1_WALL_CELL = { col: 5, row: 4 } as const;
export const STORY_1_BED_CELL = { col: 7, row: 4 } as const;

const treeKey = coordKey(STORY_1_TREE_CELL);
const foodKeys = STORY_1_FOOD_CELLS.map((c) => coordKey(c));
const zoneKeys = STORY_1_ZONE_CELLS.map((c) => coordKey(c));
const wallKey = coordKey(STORY_1_WALL_CELL);
const bedKey = coordKey(STORY_1_BED_CELL);

/** 供集成测试逐步提交；hydrateScenario 不会自动执行这些命令。 */
export const STORY_1_DOMAIN_COMMANDS = {
  zoneCreate: {
    commandId: "story1-zone-create",
    verb: "zone_create",
    targetCellKeys: [...zoneKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "interaction-mode", itemId: "zone-create" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  } satisfies DomainCommand,
  haulFood: {
    commandId: "story1-haul-food",
    verb: "assign_tool_task:haul",
    targetCellKeys: [...foodKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "tools", itemId: "haul" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  } satisfies DomainCommand,
  lumberTree: {
    commandId: "story1-lumber",
    verb: "assign_tool_task:lumber",
    targetCellKeys: [treeKey],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "tools", itemId: "lumber" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  } satisfies DomainCommand,
  wallBlueprint: {
    commandId: "story1-wall",
    verb: "build_wall_blueprint",
    targetCellKeys: [wallKey],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "building", itemId: "build-wall" },
      selectionModifier: "replace",
      inputShape: "single-cell"
    }
  } satisfies DomainCommand,
  placeBed: {
    commandId: "story1-bed",
    verb: "place_furniture:bed",
    targetCellKeys: [bedKey],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "furniture", itemId: "place-bed" },
      selectionModifier: "replace",
      inputShape: "single-cell"
    }
  } satisfies DomainCommand
};

/** hydrate 后立即可满足：MAP-001（树 + 散落食物资源）。 */
export const STORY_1_DAY_ONE_BOOTSTRAP_EXPECTATIONS: readonly ScenarioExpectation[] = [
  {
    label: "MAP-001：存在树木",
    type: "entity-kind-exists",
    params: { entityKind: "tree", count: 1 },
    maxTicks: 50
  },
  {
    label: "MAP-001：存在地面食物资源实体",
    type: "entity-kind-exists",
    params: { entityKind: "resource", count: 2 },
    maxTicks: 50
  }
];

/** 在对应命令已 submit 且模拟推进后使用。 */
export const STORY_1_DAY_ONE_EXPECTATION_GROUPS = {
  /** MAP-002 */
  afterZoneCreate: [
    {
      label: "MAP-002：存储区 zone 实体已创建",
      type: "entity-kind-exists",
      params: { entityKind: "zone", count: 1 },
      maxTicks: 100
    }
  ] as const satisfies readonly ScenarioExpectation[],
  /** WORK-002 */
  afterHaulToZone: [
    {
      label: "WORK-002：食物已搬运进存储区",
      type: "resource-in-container",
      params: { containerKind: "zone", materialKind: "food" },
      maxTicks: 6_000
    }
  ] as const satisfies readonly ScenarioExpectation[],
  /** WORK-001（伐木全链） */
  afterLumberChain: [
    {
      label: "WORK-001：树已砍伐移除",
      type: "entity-kind-absent",
      params: { entityKind: "tree" },
      maxTicks: 12_000
    },
    {
      label: "WORK-001：chop-tree 工单已完成",
      type: "work-item-completed-kind",
      params: { workKind: "chop-tree" },
      maxTicks: 12_000
    },
    {
      label: "WORK-001：木材已进入存储区",
      type: "resource-in-container",
      params: { containerKind: "zone", materialKind: "wood" },
      maxTicks: 25_000
    }
  ] as const satisfies readonly ScenarioExpectation[],
  /** BUILD-001 */
  afterWallBuilt: [
    {
      label: "BUILD-001：目标格已落成墙",
      type: "building-present",
      params: { buildingKind: "wall", cell: STORY_1_WALL_CELL },
      maxTicks: 6_000
    }
  ] as const satisfies readonly ScenarioExpectation[],
  /** BUILD-002（床实体；owner 由测试单独断言 restSpots） */
  afterBedBuilt: [
    {
      label: "BUILD-002：目标格已落成床",
      type: "building-present",
      params: { buildingKind: "bed", cell: STORY_1_BED_CELL },
      maxTicks: 8_000
    }
  ] as const satisfies readonly ScenarioExpectation[],
  /** NEED-002 */
  nightSleep: [
    {
      label: "NEED-002：夜间低精力小人目标为睡眠",
      type: "pawn-reaches-goal",
      params: { goalKind: "sleep", pawnId: "pawn-0" },
      maxTicks: 6_000
    }
  ] as const satisfies readonly ScenarioExpectation[],
  /** BEHAVIOR-003（单小人伐木打断支路） */
  hungerInterrupt: [
    {
      label: "BEHAVIOR-003：饥饿打断工作后目标为进食",
      type: "pawn-reaches-goal",
      params: { goalKind: "eat", pawnId: "pawn-0" },
      maxTicks: 6_000
    }
  ] as const satisfies readonly ScenarioExpectation[]
};

/**
 * 注册用场景：`runScenarioHeadless` 仅验收初始世界（MAP-001），避免在枚举全场景时跑完整集成链路。
 */
export const STORY_1_DAY_ONE_SCENARIO: ScenarioDefinition = {
  name: "story-1-day-one",
  description:
    "Story-1 第一天：3 小人、树与散落食物的确定性布局；完整流程见 tests/headless/story-1-day-one.test.ts",
  seed: 0x5374_315f_6431,
  gridConfig: DEFAULT_WORLD_GRID,
  pawns: [
    { name: "Hauler", cell: { col: 9, row: 5 } },
    { name: "Chopper", cell: { col: 16, row: 5 } },
    { name: "Builder", cell: { col: 4, row: 3 } }
  ],
  trees: [{ cell: STORY_1_TREE_CELL }],
  resources: [
    { cell: STORY_1_FOOD_CELLS[0]!, materialKind: "food", pickupAllowed: false },
    { cell: STORY_1_FOOD_CELLS[1]!, materialKind: "food", pickupAllowed: false }
  ],
  expectations: [...STORY_1_DAY_ONE_BOOTSTRAP_EXPECTATIONS]
};
