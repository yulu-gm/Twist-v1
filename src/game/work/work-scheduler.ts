import { getByStatus, sortWorkOrdersByPriorityDesc } from "./work-registry";
import type { WorkRegistry } from "./work-registry";
import type { WorkOrder } from "./work-types";

/**
 * `WorkRegistry` / `WorkOrder` 路径与 `oh-code-design/工作系统.yaml`「工作调度层」职责对照：
 *
 * - **候选、领取、锁定、认领者释放**：本文件的 `getAvailableWork`、`claimWork`、`releaseWork`、`isWorkClaimed`。
 *   其中 `releaseWork` 将工单从 `claimed` 置回 `open`，对应调度层「取消」在**订单认领**维度的一种形态（如需求打断）。
 * - **失败重试**：不在此文件。世界内 `WorkItemSnapshot` 的失败与重开由 `work-operations.ts` 的 `failWorkItem`（及 `claimWorkItem`）承担，与 `WorkOrder` 寄存器路径分离；调用方按所用模型选用对应 API。
 *
 * **`claimWork` / `releaseWork` 与 `claimWorkItem` 对齐**：成功变更时返回带**新 `orders` Map** 的 `WorkRegistry` 快照（结构共享、未变更条目引用复用），与 `work-operations.ts` 经 `cloneWorld` 替换 `workItems` 的不可变风格一致。编排层若需保留传入的注册表对象引用，应在收到返回值后调用 `replaceWorkRegistryOrders` 写回（见 `build-flow` / `chop-flow` / `need-interrupt-flow`）。
 */

export type ClaimResult =
  | Readonly<{ kind: "claimed" }>
  | Readonly<{ kind: "missing-work" }>
  | Readonly<{ kind: "already-claimed"; claimedByPawnId: string }>
  | Readonly<{ kind: "not-open" }>;

export type ClaimWorkResult = Readonly<{
  registry: WorkRegistry;
  outcome: ClaimResult;
}>;

export type ReleaseWorkResult = Readonly<{
  registry: WorkRegistry;
}>;

/**
 * 返回所有 `open` 状态的工作，按 priority 降序、workId 字典序稳定排序。
 *
 * **当前未按小人过滤**：可选的 `pawnId` 仅预留与未来资格过滤（技能、区域、材料等，见 oh-code-design 工作系统「扩展点」）对接；
 * 现阶段结果与是否传入 `pawnId` 无关，调用方勿误认为已做资格或区域筛选。
 */
export function getAvailableWork(registry: WorkRegistry, pawnId?: string): WorkOrder[] {
  void pawnId;
  return sortWorkOrdersByPriorityDesc(getByStatus(registry, "open"));
}

export function claimWork(registry: WorkRegistry, workId: string, pawnId: string): ClaimWorkResult {
  const order = registry.orders.get(workId);
  if (!order) {
    return { registry, outcome: { kind: "missing-work" } };
  }

  if (order.status === "claimed") {
    if (order.claimedByPawnId === pawnId) {
      return { registry, outcome: { kind: "claimed" } };
    }
    const holder = order.claimedByPawnId ?? "";
    return {
      registry,
      outcome: holder ? { kind: "already-claimed", claimedByPawnId: holder } : { kind: "not-open" }
    };
  }

  if (order.status !== "open") {
    return { registry, outcome: { kind: "not-open" } };
  }

  const nextOrders = new Map(registry.orders);
  nextOrders.set(workId, {
    ...order,
    status: "claimed",
    claimedByPawnId: pawnId
  });
  return {
    registry: { orders: nextOrders },
    outcome: { kind: "claimed" }
  };
}

/**
 * 仅认领者可释放：open + 清空认领。非认领者或状态非 `claimed` 时为 no-op。
 */
export function releaseWork(registry: WorkRegistry, workId: string, pawnId: string): ReleaseWorkResult {
  const order = registry.orders.get(workId);
  if (!order || order.status !== "claimed") {
    return { registry };
  }
  if (order.claimedByPawnId !== pawnId) {
    return { registry };
  }

  const nextOrders = new Map(registry.orders);
  nextOrders.set(workId, {
    ...order,
    status: "open",
    claimedByPawnId: undefined
  });
  return { registry: { orders: nextOrders } };
}

export function isWorkClaimed(registry: WorkRegistry, workId: string): boolean {
  return registry.orders.get(workId)?.status === "claimed";
}
