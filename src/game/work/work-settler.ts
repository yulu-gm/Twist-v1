import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId } from "../entity/entity-types";
import {
  dropResource,
  pickUpResource,
  transformBlueprintToBuilding,
  transformTreeToResource,
  type DropResourceOutcome,
  type PickUpResourceOutcome,
  type TransformBlueprintToBuildingOutcome,
  type TransformTreeToResourceOutcome
} from "../entity/lifecycle-rules";
import type { WorkRegistry } from "./work-registry";
import { addWork } from "./work-registry";
import { generatePickUpWork } from "./work-generator";
import type { WorkOrder, WorkOrderStatus } from "./work-types";

function replaceOrder(registry: WorkRegistry, next: WorkOrder): void {
  registry.orders.set(next.workId, next);
}

function asEntityId(id: string): EntityId {
  return id as EntityId;
}

export type SettleResult =
  | Readonly<{ kind: "ok"; derivedPickUpWorkId?: string }>
  | Readonly<{ kind: "missing-work" }>
  | Readonly<{ kind: "work-not-claimed"; status: WorkOrderStatus }>
  | Readonly<{ kind: "already-completed" }>
  | Readonly<{ kind: "pick-up-missing-pawn" }>
  | Readonly<{ kind: "haul-missing-pawn" }>
  | Readonly<{ kind: "haul-missing-drop-cell" }>
  | Readonly<{ kind: "haul-not-carrying-target" }>
  | Readonly<{
      kind: "tree-transform-failed";
      outcome: Exclude<TransformTreeToResourceOutcome, { kind: "ok" }>;
    }>
  | Readonly<{
      kind: "construct-transform-failed";
      outcome: Exclude<TransformBlueprintToBuildingOutcome, { kind: "ok" }>;
    }>
  | Readonly<{
      kind: "pick-up-failed";
      outcome: Exclude<PickUpResourceOutcome, { kind: "ok" }>;
    }>
  | Readonly<{
      kind: "haul-drop-failed";
      outcome: Exclude<DropResourceOutcome, { kind: "ok" }>;
    }>;

/**
 * 行为层回报成功时结算：按 {@link WorkOrder.kind} 调用实体生命周期规则，更新工单为 `completed`，必要时派生后续工单（伐木 → 拾取）。
 */
export function settleWorkSuccess(
  registry: WorkRegistry,
  workId: string,
  entityRegistry: EntityRegistry
): SettleResult {
  const order = registry.orders.get(workId);
  if (!order) return { kind: "missing-work" };
  if (order.status === "completed") return { kind: "already-completed" };
  if (order.status !== "claimed") return { kind: "work-not-claimed", status: order.status };

  const finishOk = (derivedPickUpWorkId?: string): SettleResult => {
    replaceOrder(registry, {
      ...order,
      status: "completed",
      claimedByPawnId: undefined,
      lastFailureReason: undefined
    });
    return derivedPickUpWorkId !== undefined
      ? { kind: "ok", derivedPickUpWorkId }
      : { kind: "ok" };
  };

  switch (order.kind) {
    case "chop": {
      const out = transformTreeToResource(entityRegistry, asEntityId(order.targetEntityId));
      if (out.kind !== "ok") {
        return { kind: "tree-transform-failed", outcome: out };
      }
      const pickupOrder = generatePickUpWork(out.resourceId, order.targetCell);
      addWork(registry, pickupOrder);
      return finishOk(pickupOrder.workId);
    }
    case "construct": {
      const out = transformBlueprintToBuilding(entityRegistry, asEntityId(order.targetEntityId));
      if (out.kind !== "ok") {
        return { kind: "construct-transform-failed", outcome: out };
      }
      return finishOk();
    }
    case "pick-up": {
      const pawnId = order.claimedByPawnId;
      if (!pawnId) return { kind: "pick-up-missing-pawn" };
      const out = pickUpResource(entityRegistry, asEntityId(pawnId), asEntityId(order.targetEntityId));
      if (out.kind !== "ok") {
        return { kind: "pick-up-failed", outcome: out };
      }
      return finishOk();
    }
    case "haul": {
      const pawnId = order.claimedByPawnId;
      if (!pawnId) return { kind: "haul-missing-pawn" };
      const dropCell = order.haulDropCell;
      if (!dropCell) return { kind: "haul-missing-drop-cell" };
      const pawn = entityRegistry.get(asEntityId(pawnId));
      if (pawn?.kind !== "pawn" || pawn.carriedResourceId !== order.targetEntityId) {
        return { kind: "haul-not-carrying-target" };
      }
      const out = dropResource(entityRegistry, asEntityId(pawnId), dropCell);
      if (out.kind !== "ok") {
        return { kind: "haul-drop-failed", outcome: out };
      }
      return finishOk();
    }
  }
}

/**
 * 行为层回报失败：工单回到 `open`、清空认领，并记录原因供调试。
 */
export function settleWorkFailure(registry: WorkRegistry, workId: string, reason: string): void {
  const order = registry.orders.get(workId);
  if (!order || order.status === "completed") return;
  replaceOrder(registry, {
    ...order,
    status: "open",
    claimedByPawnId: undefined,
    lastFailureReason: reason
  });
}
