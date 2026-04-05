/**
 * S0 线间契约中的领域类型（B 线侧）。
 * A 线落地后可替换为共享包中的同构定义；当前仅供 mock 网关与命令通道使用。
 */

import type { SelectionModifier } from "./floor-selection";

/** 玩家进入交互模式的来源（后续可扩展菜单、快捷键等）。 */
export type InteractionSource =
  | Readonly<{ kind: "toolbar"; toolId: string }>
  | Readonly<{ kind: "menu"; menuId: string; itemId: string }>;

/** 统一领域命令，对齐 working-plan 中「交互命令」字段。 */
export type DomainCommand = Readonly<{
  /** 日志与回放用的稳定 id。 */
  commandId: string;
  /** 领域动词，与工具 id 或专用动词对齐。 */
  verb: string;
  targetCellKeys: readonly string[];
  targetEntityIds: readonly string[];
  sourceMode: Readonly<{
    source: InteractionSource;
    selectionModifier: SelectionModifier;
    /** 框选矩形 / 笔刷路径等技术分类，便于验收与回放。 */
    inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  }>;
  /** 可选：由调用方注入时间戳，缺失时由 mock 网关填充。 */
  issuedAtMs?: number;
}>;

/** Mock 世界/工作网关的提交结果；合并前固定行为，联调时再接真实规则。 */
export type MockWorldSubmitResult = Readonly<{
  accepted: boolean;
  messages: readonly string[];
  conflictCellKeys?: readonly string[];
  workOrderId?: string;
}>;

/** A 线侧只读快照的可插拔端口（当前返回固定桩数据）。 */
export type MockLineAPort = Readonly<{
  snapshotLabel: string;
}>;
