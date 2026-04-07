/**
 * S0 线间契约：领域命令与网关相关类型（本目录为单一事实来源）。
 * `game/interaction/domain-command-types` 与 `player/s0-contract` 仅再导出本模块，避免契约分散双轨。
 */

import type { SelectionModifier } from "../interaction/floor-selection";

/** 玩家进入交互模式的来源：`menuId` 为命令分类或注册表命名空间，`itemId` 为命令/模式 id。 */
export type InteractionSource = Readonly<{ kind: "menu"; menuId: string; itemId: string }>;

/**
 * 与 `data/command-menu` 各命令 `domainVerb` 及 `mode-registry` 缺省模式对齐的领域动词联合（见 oh-gen-doc 交互模式）。
 * 扩展菜单或注册新模式时需同步扩充。
 */
export type DomainVerb =
  | "clear_task_markers"
  | "zone_create"
  | "build_wall_blueprint"
  | "place_furniture:bed"
  | "assign_tool_task:mine"
  | "assign_tool_task:demolish"
  | "assign_tool_task:mow"
  | "assign_tool_task:lumber"
  | "assign_tool_task:farm"
  | "assign_tool_task:haul"
  | "assign_tool_task:patrol";

/** 统一领域命令，对齐 working-plan 中「交互命令」字段。 */
export type DomainCommand = Readonly<{
  /** 日志与回放用的稳定 id。 */
  commandId: string;
  /** 领域动词，与工具 id 或专用动词对齐。 */
  verb: DomainVerb;
  targetCellKeys: readonly string[];
  targetEntityIds: readonly string[];
  sourceMode: Readonly<{
    source: InteractionSource;
    selectionModifier: SelectionModifier;
    /** 框选矩形 / 笔刷路径等技术分类，便于验收与回放。 */
    inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  }>;
  /** 可选：由调用方注入时间戳，缺失时由网关填充。 */
  issuedAtMs?: number;
}>;

/** 世界/工作网关对领域命令的提交结果。 */
export type WorldSubmitResult = Readonly<{
  accepted: boolean;
  messages: readonly string[];
  conflictCellKeys?: readonly string[];
  workOrderId?: string;
}>;

/** A 线侧只读快照的可插拔端口。 */
export type LineAReadPort = Readonly<{
  snapshotLabel: string;
}>;
