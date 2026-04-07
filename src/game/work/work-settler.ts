import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId, WorldEntitySnapshot } from "../entity/entity-types";
import { findAvailableStorageCell } from "../map/storage-zones";
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
import { generateHaulWork, generatePickUpWork } from "./work-generator";
import type { WorkOrder, WorkOrderStatus } from "./work-types";

function replaceOrder(registry: WorkRegistry, next: WorkOrder): void {
  registry.orders.set(next.workId, next);
}

/** 工单中的目标 id 仅在注册表存在时视为 {@link EntityId}，避免与策划「目标实体标识」字段不一致时的无校验断言。 */
function resolveWorkTargetEntityId(registry: EntityRegistry, raw: string): EntityId | undefined {
  return registry.get(raw as EntityId) !== undefined ? (raw as EntityId) : undefined;
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
    }>
  | Readonly<{ kind: "registry-entity-missing"; id: string }>;

/**
 * 行为层回报成功时结算：按 {@link WorkOrder.kind} 调用实体生命周期规则，更新工单为 `completed`，必要时派生后续工单（伐木 → 拾取；若存在可用存储格则同时登记搬运工单）。
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

  const failClaimed = (reason: string, result: SettleResult): SettleResult => {
    settleWorkFailure(registry, workId, reason);
    return result;
  };

  switch (order.kind) {
    case "chop": {
      const treeId = resolveWorkTargetEntityId(entityRegistry, order.targetEntityId);
      if (!treeId) {
        return failClaimed("registry-entity-missing", {
          kind: "registry-entity-missing",
          id: order.targetEntityId
        });
      }
      const out = transformTreeToResource(entityRegistry, treeId);
      if (out.kind !== "ok") {
        return failClaimed(`tree-transform:${out.kind}`, { kind: "tree-transform-failed", outcome: out });
      }
      const pickupOrder = generatePickUpWork(out.resourceId, order.targetCell);
      addWork(registry, pickupOrder);
      const storageLookup = {
        entities: new Map<string, WorldEntitySnapshot>(
          entityRegistry.getAll().map((e) => [e.id, e as unknown as WorldEntitySnapshot])
        )
      };
      const slot = findAvailableStorageCell(storageLookup, out.resourceId);
      if (slot) {
        const haulOrder = generateHaulWork(out.resourceId, order.targetCell, slot.zoneId, slot.cell);
        addWork(registry, haulOrder);
      }
      return finishOk(pickupOrder.workId);
    }
    case "construct": {
      const blueprintId = resolveWorkTargetEntityId(entityRegistry, order.targetEntityId);
      if (!blueprintId) {
        return failClaimed("registry-entity-missing", {
          kind: "registry-entity-missing",
          id: order.targetEntityId
        });
      }
      const out = transformBlueprintToBuilding(entityRegistry, blueprintId);
      if (out.kind !== "ok") {
        return failClaimed(`construct-transform:${out.kind}`, {
          kind: "construct-transform-failed",
          outcome: out
        });
      }
      return finishOk();
    }
    case "pick-up": {
      const pawnId = order.claimedByPawnId;
      if (!pawnId) return failClaimed("pick-up-missing-pawn", { kind: "pick-up-missing-pawn" });
      const pawnResolved = resolveWorkTargetEntityId(entityRegistry, pawnId);
      if (!pawnResolved) {
        return failClaimed("registry-entity-missing", { kind: "registry-entity-missing", id: pawnId });
      }
      const resourceId = resolveWorkTargetEntityId(entityRegistry, order.targetEntityId);
      if (!resourceId) {
        return failClaimed("registry-entity-missing", {
          kind: "registry-entity-missing",
          id: order.targetEntityId
        });
      }
      const out = pickUpResource(entityRegistry, pawnResolved, resourceId);
      if (out.kind !== "ok") {
        return failClaimed(`pick-up:${out.kind}`, { kind: "pick-up-failed", outcome: out });
      }
      return finishOk();
    }
    case "haul": {
      const pawnId = order.claimedByPawnId;
      if (!pawnId) return failClaimed("haul-missing-pawn", { kind: "haul-missing-pawn" });
      const dropCell = order.haulDropCell;
      if (!dropCell) return failClaimed("haul-missing-drop-cell", { kind: "haul-missing-drop-cell" });
      const haulTargetId = resolveWorkTargetEntityId(entityRegistry, order.targetEntityId);
      if (!haulTargetId) {
        return failClaimed("registry-entity-missing", {
          kind: "registry-entity-missing",
          id: order.targetEntityId
        });
      }
      const pawnResolved = resolveWorkTargetEntityId(entityRegistry, pawnId);
      if (!pawnResolved) {
        return failClaimed("registry-entity-missing", { kind: "registry-entity-missing", id: pawnId });
      }
      const pawn = entityRegistry.get(pawnResolved);
      if (pawn?.kind !== "pawn" || pawn.carriedResourceId !== haulTargetId) {
        return failClaimed("haul-not-carrying-target", { kind: "haul-not-carrying-target" });
      }
      const out = dropResource(entityRegistry, pawnResolved, dropCell);
      if (out.kind !== "ok") {
        return failClaimed(`haul-drop:${out.kind}`, { kind: "haul-drop-failed", outcome: out });
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
