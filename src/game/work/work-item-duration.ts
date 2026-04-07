/**
 * 小人与工单锚格四向邻接时的读条时长（秒），与 GameOrchestrator 工单推进一致。
 * 数值来源：{@link SimConfig.workItemAnchorDurationSec}（默认见 {@link DEFAULT_SIM_CONFIG}）。
 */

import type { SimConfig } from "../behavior/sim-config";
import { DEFAULT_SIM_CONFIG } from "../behavior/sim-config";
import type { WorkItemKind } from "./work-types";

/** 各工单类型锚格读条时长；与 {@link DEFAULT_SIM_CONFIG.workItemAnchorDurationSec} 同步，供外部只读引用。 */
export const WORK_ITEM_ANCHOR_DURATION_SEC = DEFAULT_SIM_CONFIG.workItemAnchorDurationSec;

/** 需走向锚格操作邻格的工单种类；与 {@link WORK_ITEM_ANCHOR_DURATION_SEC} 键集一致，避免双轨漂移。 */
export const WORK_WALK_KINDS: ReadonlySet<WorkItemKind> = new Set(
  Object.keys(WORK_ITEM_ANCHOR_DURATION_SEC) as WorkItemKind[]
);

export function workItemAnchorDurationSeconds(
  byKind: SimConfig["workItemAnchorDurationSec"],
  kind: WorkItemKind
): number {
  switch (kind) {
    case "construct-blueprint":
      return byKind["construct-blueprint"];
    case "deconstruct-obstacle":
      return byKind["deconstruct-obstacle"];
    case "chop-tree":
      return byKind["chop-tree"];
    case "mine-stone":
      return byKind["mine-stone"];
    case "pick-up-resource":
      return byKind["pick-up-resource"];
    case "haul-to-zone":
      return byKind["haul-to-zone"];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
