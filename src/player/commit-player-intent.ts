/**
 * 玩家选区/笔刷意图 → 领域命令 → 线间网关 →（仅接受后）更新任务标记。
 * 对齐 oh-code-design 交互系统「交互意图层」与 UI「只消费规则结果」：拒绝不改变已确认的地图标记状态。
 */

import { commandMenuDomainSemantics, type CommandMenuCommandId } from "../data/command-menu";
import { applyTaskMarkersForSelection } from "../data/task-markers";
import type { SelectionModifier } from "../game/interaction/floor-selection";
import { buildDomainCommand, taskMarkerToolIdForDomainCommand } from "./build-domain-command";
import type { PlayerTaskMarkerOverlayPort, PlayerWorldCommandPort } from "./world-port-types";
import type { DomainCommand, WorldSubmitResult } from "./s0-contract";

export type PlayerSelectionCommitInput = Readonly<{
  /** 主语义：当前激活的菜单命令。 */
  commandId: CommandMenuCommandId;
  selectionModifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  currentMarkers: ReadonlyMap<string, string>;
  nowMs: number;
}>;

/**
 * 在 {@link PlayerWorldCommandPort.replayAll} 等场景下，仅用「命令 + 逐条提交结果」重建格上任务标记图，
 * 避免 WorldCore 已重放而 Phaser 侧 `taskMarkersByCell` 仍滞留旧态。
 */
export function rebuildTaskMarkersFromCommandResults(
  log: readonly DomainCommand[],
  results: readonly WorldSubmitResult[]
): Map<string, string> {
  let markers = new Map<string, string>();
  const n = Math.min(log.length, results.length);
  for (let i = 0; i < n; i++) {
    if (!results[i]!.accepted) continue;
    const cmd = log[i]!;
    const toolId = taskMarkerToolIdForDomainCommand(cmd);
    markers = applyTaskMarkersForSelection(markers, {
      toolId,
      modifier: cmd.sourceMode.selectionModifier,
      cellKeys: new Set(cmd.targetCellKeys)
    });
  }
  return markers;
}

export type PlayerSelectionCommitOutcome = Readonly<{
  /** 是否调用了网关 submit（命令已构造成功） */
  didSubmitToWorld: boolean;
  command: DomainCommand | null;
  submitResult: WorldSubmitResult | null;
  /** 网关接受后的标记图；拒绝时与 `currentMarkers` 快照一致 */
  nextMarkers: Map<string, string>;
  /** 非 null 时可刷新玩家通道结果 HUD */
  resultSummaryLine: string | null;
}>;

export function commitPlayerSelectionToWorld(
  port: PlayerWorldCommandPort & PlayerTaskMarkerOverlayPort,
  input: PlayerSelectionCommitInput
): PlayerSelectionCommitOutcome {
  const { commandId, selectionModifier, cellKeys, inputShape, currentMarkers, nowMs } = input;
  const frozenMarkers = new Map(currentMarkers);
  const { markerToolId } = commandMenuDomainSemantics(commandId);

  const cmd = buildDomainCommand({
    commandId,
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

  const markerCellKeys = port.filterTaskMarkerTargetCells(markerToolId, inputShape, cellKeys);

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

  const layered = applyTaskMarkersForSelection(frozenMarkers, {
    toolId: markerToolId,
    modifier: selectionModifier,
    cellKeys: markerCellKeys
  });
  const nextMarkers = port.mergeTaskMarkerOverlayWithWorld(layered);

  return {
    didSubmitToWorld: true,
    command: cmd,
    submitResult,
    nextMarkers,
    resultSummaryLine: `世界网关：接受 — ${submitResult.messages[0] ?? "ok"}`
  };
}
