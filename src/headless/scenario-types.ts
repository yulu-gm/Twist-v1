/**
 * Headless 场景定义类型（无 Phaser），与 `working-plan/headless-sim.yml` T-06 对齐。
 *
 * 写入 `ScenarioExpectation.params` 时若涉及小人目标种类，应与
 * `goal-driven-planning.ts` 中的 GoalKind（"eat" | "sleep" | "recreate" | "wander"）一致。
 */

import type { BuildingKind } from "../game/entity/entity-types";
import type { SelectionModifier } from "../game/interaction/floor-selection";
import type { GridCoord, WorldGridConfig } from "../game/map";
import type { PawnState } from "../game/pawn-state";
import type { DomainCommand } from "../player/s0-contract";

export type ScenarioTreeSpawn = Readonly<{ cell: GridCoord }>;

export type ScenarioResourceSpawn = Readonly<{
  cell: GridCoord;
  materialKind: string;
  pickupAllowed?: boolean;
}>;

export type ScenarioZoneSpawn = Readonly<{
  cells: readonly GridCoord[];
  zoneKind?: string;
}>;

/**
 * 与 `commitPlayerSelectionToWorld` / 场景内 `HeadlessSim.commitPlayerSelection` 同形；
 * `cellKeys` 为 `coordKey` 字符串，对应玩家一次抬高鼠标时的格集合。
 */
export type ScenarioPlayerSelectionAfterHydrate = Readonly<{
  toolId: string;
  selectionModifier: SelectionModifier;
  cellKeys: readonly string[];
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
}>;

/** 期望条：`resource-in-container` 的 params 可含 `materialKind`（如 wood / food）。 */
export type ScenarioExpectation = Readonly<{
  label: string;
  type:
    | "pawn-reaches-goal"
    | "event-occurred"
    | "no-pawn-starved"
    | "work-item-exists"
    | "building-present"
    | "entity-kind-exists"
    | "entity-kind-absent"
    | "resource-in-container"
    | "work-item-completed-kind"
    | "custom";
  params: Record<string, unknown>;
  /** 自动 runner 超时 tick；runner 侧默认 500，此处仅可选类型字段。 */
  maxTicks?: number;
}>;

export type ScenarioDefinition = Readonly<{
  name: string;
  description: string;
  seed: number;
  gridConfig?: WorldGridConfig;
  pawns: Array<{
    name: string;
    cell: GridCoord;
    /** 规划器按 `needs.*` 选目标；可与 `satiety`/`energy` 一并设定以保持一致。 */
    overrides?: Partial<Pick<PawnState, "satiety" | "energy" | "needs">>;
  }>;
  blueprints?: Array<{ kind: BuildingKind; cell: GridCoord }>;
  obstacles?: Array<{ cell: GridCoord; label?: string }>;
  trees?: readonly ScenarioTreeSpawn[];
  resources?: readonly ScenarioResourceSpawn[];
  zones?: readonly ScenarioZoneSpawn[];
  timeConfig?: { startMinuteOfDay?: number };
  /**
   * 装载后由该名人小人认领首个 `open` 的 construct-blueprint 工单（驱动走向锚格并落成）。
   */
  claimConstructBlueprintAsPawnName?: string;
  /**
   * 装载后、跑 `expectations` 前依次提交到世界端口（如需领域命令才出现的工单等）。
   */
  domainCommandsAfterHydrate?: readonly DomainCommand[];
  /**
   * 与正式游戏一致：经 `buildDomainCommand` + 网关写入世界（例：`toolId:"build"` + `brush-stroke` 放墙）。
   * 优先于手写 `domainCommandsAfterHydrate`，以免 `sourceMode` / `inputShape` 与工具栏语义漂移。
   */
  playerSelectionAfterHydrate?: readonly ScenarioPlayerSelectionAfterHydrate[];
  expectations?: ScenarioExpectation[];
  /**
   * 浏览器内人工验收提示（`HudManager`）；不参与 `runScenarioHeadless`。
   */
  manualAcceptance?: Readonly<{
    /** 建议操作顺序，一句一步。 */
    steps: readonly string[];
    /** 应对照的现象；可与 `expectations` 语义一致。 */
    outcomes: readonly string[];
  }>;
}>;
