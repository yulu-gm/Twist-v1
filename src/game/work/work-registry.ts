import type { WorkOrder, WorkOrderKind, WorkOrderStatus } from "./work-types";

export type WorkRegistry = Readonly<{
  orders: Map<string, WorkOrder>;
}>;

export function createWorkRegistry(): WorkRegistry {
  return { orders: new Map() };
}

export function addWork(registry: WorkRegistry, order: WorkOrder): void {
  registry.orders.set(order.workId, order);
}

export function removeWork(registry: WorkRegistry, workId: string): void {
  registry.orders.delete(workId);
}

export function getByStatus(registry: WorkRegistry, status: WorkOrderStatus): WorkOrder[] {
  const out: WorkOrder[] = [];
  for (const o of registry.orders.values()) {
    if (o.status === status) out.push(o);
  }
  return out;
}

export function getByKind(registry: WorkRegistry, kind: WorkOrderKind): WorkOrder[] {
  const out: WorkOrder[] = [];
  for (const o of registry.orders.values()) {
    if (o.kind === kind) out.push(o);
  }
  return out;
}

export function getByTarget(registry: WorkRegistry, entityId: string): WorkOrder[] {
  const out: WorkOrder[] = [];
  for (const o of registry.orders.values()) {
    if (o.targetEntityId === entityId) out.push(o);
  }
  return out;
}
