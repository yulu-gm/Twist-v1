/**
 * 任务标记逻辑：根据工具 id 和框选结果生成/更新格上任务文案。
 * 纯视觉标记，不接入 AI 决策层。
 */

import { type SelectionModifier } from "../game/floor-selection";
import { VILLAGER_TOOLS } from "./villager-tools";

export type TaskMarkerSelectionInput = Readonly<{
  toolId: string;
  modifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
}>;

/** 「待机」不视为下达可标记的任务；未知 id 同空。 */
export function issuedTaskLabelForToolId(toolId: string): string | null {
  const tool = VILLAGER_TOOLS.find((t) => t.id === toolId);
  if (!tool || tool.id === "idle") return null;
  return tool.label;
}

export function applyTaskMarkersForSelection(
  currentMarkers: ReadonlyMap<string, string>,
  input: TaskMarkerSelectionInput
): Map<string, string> {
  const next = new Map(currentMarkers);
  if (input.toolId === "idle") {
    for (const key of input.cellKeys) {
      next.delete(key);
    }
    return next;
  }

  const issuedLabel = issuedTaskLabelForToolId(input.toolId);

  if (issuedLabel === null || input.cellKeys.size === 0) {
    return next;
  }

  if (input.modifier === "toggle") {
    for (const key of input.cellKeys) {
      if (next.get(key) === issuedLabel) {
        next.delete(key);
        continue;
      }
      next.set(key, issuedLabel);
    }
    return next;
  }

  for (const key of input.cellKeys) {
    next.set(key, issuedLabel);
  }
  return next;
}
