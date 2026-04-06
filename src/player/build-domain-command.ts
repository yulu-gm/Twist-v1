/**
 * 由交互会话剪裁结果生成领域命令（纯函数，不含规则裁决）。
 */

import {
  commandMenuDomainSemantics,
  getCommandMenuCommand,
  type CommandMenuCommandId
} from "../data/command-menu";
import { issuedTaskLabelForToolId } from "../data/task-markers";
import type { SelectionModifier } from "../game/interaction/floor-selection";
import type { DomainCommand } from "./s0-contract";

let commandSeq = 0;

function nextCommandId(): string {
  commandSeq += 1;
  return `cmd-${commandSeq}`;
}

export type BuildCommandInput = Readonly<{
  commandId: CommandMenuCommandId;
  selectionModifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
  inputShape: "rect-selection" | "brush-stroke" | "single-cell";
  nowMs?: number;
}>;

/**
 * 从当前菜单命令 + 格集合构建命令；无可派发内容时返回 `null`。
 * UI/交互层不判断可行性，仅打包意图；裁决由世界网关完成。
 */
export function buildDomainCommand(input: BuildCommandInput): DomainCommand | null {
  const def = commandMenuDomainSemantics(input.commandId);
  const { selectionModifier, cellKeys, inputShape, nowMs } = input;

  const menuSource = { kind: "menu" as const, menuId: def.categoryId, itemId: def.commandId };

  if (def.domainVerb === "clear_task_markers") {
    if (cellKeys.size === 0) return null;
    return {
      commandId: nextCommandId(),
      verb: "clear_task_markers",
      targetCellKeys: [...cellKeys],
      targetEntityIds: [],
      sourceMode: {
        source: menuSource,
        selectionModifier,
        inputShape
      },
      issuedAtMs: nowMs
    };
  }

  if (def.domainVerb === "build_wall_blueprint" || def.domainVerb === "place_furniture:bed") {
    if (cellKeys.size === 0) return null;
    return {
      commandId: nextCommandId(),
      verb: def.domainVerb,
      targetCellKeys: [...cellKeys],
      targetEntityIds: [],
      sourceMode: {
        source: menuSource,
        selectionModifier,
        inputShape
      },
      issuedAtMs: nowMs
    };
  }

  if (def.domainVerb === "zone_create") {
    if (cellKeys.size === 0) return null;
    return {
      commandId: nextCommandId(),
      verb: "zone_create",
      targetCellKeys: [...cellKeys],
      targetEntityIds: [],
      sourceMode: {
        source: menuSource,
        selectionModifier,
        inputShape
      },
      issuedAtMs: nowMs
    };
  }

  const assignPrefix = "assign_tool_task:";
  if (!def.domainVerb.startsWith(assignPrefix)) {
    return null;
  }
  const toolIdForAssign = def.domainVerb.slice(assignPrefix.length);
  const label = issuedTaskLabelForToolId(toolIdForAssign);
  if (label === null || cellKeys.size === 0) return null;

  return {
    commandId: nextCommandId(),
    verb: def.domainVerb,
    targetCellKeys: [...cellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: menuSource,
      selectionModifier,
      inputShape
    },
    issuedAtMs: nowMs
  };
}

/**
 * 从已记录命令恢复任务标记叠加层时使用的 marker 工具 id（与 {@link task-markers} / 过滤逻辑一致）。
 */
export function taskMarkerToolIdForDomainCommand(cmd: DomainCommand): string {
  const src = cmd.sourceMode.source;
  if (src.kind === "menu") {
    const fromMenu = getCommandMenuCommand(src.itemId as CommandMenuCommandId);
    if (fromMenu) return fromMenu.markerToolId;
    if (src.menuId === "interaction-mode") {
      if (src.itemId === "zone-create") return "zone_create";
      if (src.itemId === "build-wall" || src.itemId === "build-bed") return "build";
      if (src.itemId === "chop") return "lumber";
    }
  }
  if (cmd.verb === "clear_task_markers") return "idle";
  if (cmd.verb === "zone_create") return "zone_create";
  if (cmd.verb.startsWith("assign_tool_task:")) {
    return cmd.verb.slice("assign_tool_task:".length);
  }
  if (cmd.verb === "build_wall_blueprint" || cmd.verb === "place_furniture:bed") {
    return "build";
  }
  return "idle";
}

/** 测试用：重置命令序号，避免用例互相泄漏。 */
export function resetDomainCommandIdSequence(): void {
  commandSeq = 0;
}
