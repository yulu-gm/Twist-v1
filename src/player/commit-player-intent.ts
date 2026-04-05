/**
 * 玩家选区/笔刷意图 → 领域命令 → 线间网关 →（仅接受后）更新任务标记。
 * 对齐 oh-code-design 交互系统「交互意图层」与 UI「只消费规则结果」：拒绝不改变已确认的地图标记状态。
 */

import { applyTaskMarkersForSelection } from "../data/task-markers";
import type { SelectionModifier } from "../game/floor-selection";
import { buildDomainCommand } from "./build-domain-command";
import type { MockWorldPort } from "./mock-world-port";
import type { DomainCommand, MockWorldSubmitResult } from "./s0-contract";

export type PlayerSelectionCommitInput = Readonly<{
  toolId: string;
  selectionModifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  currentMarkers: ReadonlyMap<string, string>;
  nowMs: number;
}>;

export type PlayerSelectionCommitOutcome = Readonly<{
  /** 是否调用了网关 submit（命令已构造成功） */
  didSubmitToWorld: boolean;
  command: DomainCommand | null;
  submitResult: MockWorldSubmitResult | null;
  /** 网关接受后的标记图；拒绝时与 `currentMarkers` 快照一致 */
  nextMarkers: Map<string, string>;
  /** 非 null 时可刷新玩家通道结果 HUD */
  resultSummaryLine: string | null;
}>;

export function commitPlayerSelectionToWorld(
  port: MockWorldPort,
  input: PlayerSelectionCommitInput
): PlayerSelectionCommitOutcome {
  const { toolId, selectionModifier, cellKeys, inputShape, currentMarkers, nowMs } = input;
  const frozenMarkers = new Map(currentMarkers);

  const cmd = buildDomainCommand({
    toolId,
    selectionModifier,
    cellKeys,
    inputShape,
    nowMs
  });

  if (!cmd) {
    return {
      didSubmitToWorld: false,
      command: null,
      submitResult: null,
      nextMarkers: frozenMarkers,
      resultSummaryLine: null
    };
  }

  const submitResult = port.submit(cmd, nowMs);
  if (!submitResult.accepted) {
    return {
      didSubmitToWorld: true,
      command: cmd,
      submitResult,
      nextMarkers: frozenMarkers,
      resultSummaryLine: `世界网关：拒绝 — ${submitResult.messages[0] ?? "?"}`
    };
  }

  const nextMarkers = applyTaskMarkersForSelection(frozenMarkers, {
    toolId,
    modifier: selectionModifier,
    cellKeys
  });

  return {
    didSubmitToWorld: true,
    command: cmd,
    submitResult,
    nextMarkers,
    resultSummaryLine: `世界网关：接受 — ${submitResult.messages[0] ?? "ok"}`
  };
}
