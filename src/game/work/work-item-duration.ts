/**
 * 小人与工单锚格四向邻接时的读条时长（秒），与 GameOrchestrator 工单推进一致。
 */

import type { WorkItemKind } from "./work-types";

/** 各工单类型锚格读条时长；未列出的 kind 不由此路径自动落成。 */
export const WORK_ITEM_ANCHOR_DURATION_SEC = {
  "construct-blueprint": 2,
  "chop-tree": 3,
  "mine-stone": 3,
  "pick-up-resource": 0.5,
  "haul-to-zone": 0.5
} as const;

export function workItemAnchorDurationSeconds(kind: WorkItemKind): number | undefined {
  return (WORK_ITEM_ANCHOR_DURATION_SEC as Record<string, number | undefined>)[kind];
}
