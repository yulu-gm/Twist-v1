import type { WorkRegistry } from "./work-registry";
import type { WorkOrder } from "./work-types";

export type ClaimResult =
  | Readonly<{ kind: "claimed" }>
  | Readonly<{ kind: "missing-work" }>
  | Readonly<{ kind: "already-claimed"; claimedByPawnId: string }>
  | Readonly<{ kind: "not-open" }>;

/**
 * 可被该小人领取的候选工作：`open` 状态，按 priority 降序、workId 字典序稳定排序。
 * `pawnId` 预留与资格过滤（技能、区域等）对接。
 */
export function getAvailableWork(registry: WorkRegistry, _pawnId: string): WorkOrder[] {
  const candidates: WorkOrder[] = [];
  for (const o of registry.orders.values()) {
    if (o.status === "open") candidates.push(o);
  }
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.workId.localeCompare(b.workId);
  });
  return candidates;
}

export function claimWork(registry: WorkRegistry, workId: string, pawnId: string): ClaimResult {
  const order = registry.orders.get(workId);
  if (!order) return { kind: "missing-work" };

  if (order.status === "claimed") {
    if (order.claimedByPawnId === pawnId) return { kind: "claimed" };
    const holder = order.claimedByPawnId ?? "";
    return holder ? { kind: "already-claimed", claimedByPawnId: holder } : { kind: "not-open" };
  }

  if (order.status !== "open") return { kind: "not-open" };

  registry.orders.set(workId, {
    ...order,
    status: "claimed",
    claimedByPawnId: pawnId
  });
  return { kind: "claimed" };
}

/**
 * 仅认领者可释放：open + 清空认领。非认领者或状态非 `claimed` 时为 no-op。
 */
export function releaseWork(registry: WorkRegistry, workId: string, pawnId: string): void {
  const order = registry.orders.get(workId);
  if (!order || order.status !== "claimed") return;
  if (order.claimedByPawnId !== pawnId) return;

  registry.orders.set(workId, {
    ...order,
    status: "open",
    claimedByPawnId: undefined
  });
}

export function isWorkClaimed(registry: WorkRegistry, workId: string): boolean {
  return registry.orders.get(workId)?.status === "claimed";
}
