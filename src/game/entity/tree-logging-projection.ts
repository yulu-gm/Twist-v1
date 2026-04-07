/**
 * 树实体伐木相关只读投影：由关联 {@link WorkItemSnapshot} `chop-tree` 与 `loggingMarked` 推导，
 * 供 {@link getWorldSnapshot} 与渲染层对齐策划三态（正常 / 已标记 / 伐木中）及工单预占语义。
 */

import type { TreeLoggingVisualPhase, WorldEntitySnapshot } from "./entity-types";
import type { WorkItemSnapshot } from "../work/work-types";

export type TreeLoggingViewProjection = Readonly<{
  /** 存在指向本树的未完成且未认领的 `chop-tree` 工单。 */
  treeChopWorkOpen: boolean;
  /** 存在指向本树的已认领且未完成的 `chop-tree` 工单（伐木执行中）。 */
  treeChopWorkClaimed: boolean;
  /** 与 oh-gen-doc 树木伐木三态对齐的综合视觉相位。 */
  treeLoggingVisualPhase: TreeLoggingVisualPhase;
}>;

/**
 * 根据实体上的 `relatedWorkItemIds` 与当前工单表计算树的伐木投影字段（纯函数、无副作用）。
 */
export function computeTreeLoggingViewProjection(
  tree: Pick<WorldEntitySnapshot, "relatedWorkItemIds" | "loggingMarked">,
  workItems: ReadonlyMap<string, WorkItemSnapshot>
): TreeLoggingViewProjection {
  let treeChopWorkOpen = false;
  let treeChopWorkClaimed = false;
  for (const wid of tree.relatedWorkItemIds) {
    const w = workItems.get(wid);
    if (!w || w.kind !== "chop-tree" || w.status === "completed") continue;
    if (w.status === "claimed") treeChopWorkClaimed = true;
    else if (w.status === "open") treeChopWorkOpen = true;
  }
  const treeLoggingVisualPhase: TreeLoggingVisualPhase = treeChopWorkClaimed
    ? "chopping"
    : tree.loggingMarked === true || treeChopWorkOpen
      ? "marked"
      : "normal";
  return { treeChopWorkOpen, treeChopWorkClaimed, treeLoggingVisualPhase };
}
