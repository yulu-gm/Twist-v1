/**
 * 由交互会话剪裁结果生成领域命令（纯函数，不含规则裁决）。
 */

import { issuedTaskLabelForToolId } from "../data/task-markers";
import type { SelectionModifier } from "../game/floor-selection";
import type { DomainCommand } from "./s0-contract";
import { interactionInputShapeForToolId } from "./tool-input-policy";

let commandSeq = 0;

function nextCommandId(): string {
  commandSeq += 1;
  return `cmd-${commandSeq}`;
}

export type BuildCommandInput = Readonly<{
  toolId: string;
  selectionModifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  nowMs?: number;
}>;

/**
 * 从工具 + 格集合构建命令；无可派发内容时返回 `null`。
 * UI/交互层不判断可行性，仅打包意图；裁决由世界网关完成。
 */
export function buildDomainCommand(input: BuildCommandInput): DomainCommand | null {
  const { toolId, selectionModifier, cellKeys, inputShape, nowMs } = input;

  if (toolId === "idle") {
    if (cellKeys.size === 0) return null;
    return {
      commandId: nextCommandId(),
      verb: "clear_task_markers",
      targetCellKeys: [...cellKeys],
      targetEntityIds: [],
      sourceMode: {
        source: { kind: "toolbar", toolId },
        selectionModifier,
        inputShape
      },
      issuedAtMs: nowMs
    };
  }

  const label = issuedTaskLabelForToolId(toolId);
  if (label === null || cellKeys.size === 0) return null;

  return {
    commandId: nextCommandId(),
    verb: `assign_tool_task:${toolId}`,
    targetCellKeys: [...cellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId },
      selectionModifier,
      inputShape
    },
    issuedAtMs: nowMs
  };
}

/** 由工具 id 推断默认输入形态（单测与场景共用）。 */
export function defaultInputShapeForTool(toolId: string): "rect-selection" | "brush-stroke" {
  return interactionInputShapeForToolId(toolId);
}

/** 测试用：重置命令序号，避免用例互相泄漏。 */
export function resetDomainCommandIdSequence(): void {
  commandSeq = 0;
}
