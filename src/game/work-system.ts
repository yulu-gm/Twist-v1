/** work-system：工作单、步骤、占用记录与工作目录（与 Phaser 无关）。 */

import type { EntityId } from "./entity-system";
import { coordKey, type GridCoord } from "./world-grid";

export type WorkId = string;

export type WorkStatus = "pending" | "in_progress" | "completed" | "failed";

export type WorkOrder = Readonly<{
  id: WorkId;
  workType: string;
  status: WorkStatus;
  targetEntityId?: EntityId;
  targetCell: GridCoord;
  reason: string;
  priority: number;
  steps?: readonly WorkStep[];
}>;

export type WorkStep = Readonly<{
  stepKind: string;
  preconditions: string;
  successOutcome: string;
  failureOutcome: string;
}>;

export type WorkLockTarget =
  | Readonly<{ kind: "entity"; entityId: EntityId }>
  | Readonly<{ kind: "cell"; cell: GridCoord }>;

export type WorkReservation = Readonly<{
  workId: WorkId;
  pawnId: EntityId;
  lockedTarget: WorkLockTarget;
  lockedAtMs: number;
}>;

export function workLockTargetKey(target: WorkLockTarget): string {
  return target.kind === "entity"
    ? `entity:${target.entityId}`
    : `cell:${coordKey(target.cell)}`;
}

export function sameWorkLockTarget(a: WorkLockTarget, b: WorkLockTarget): boolean {
  if (a.kind === "entity" && b.kind === "entity") return a.entityId === b.entityId;
  if (a.kind === "cell" && b.kind === "cell") return coordKey(a.cell) === coordKey(b.cell);
  return false;
}

export class WorkRegistry {
  private orders = new Map<WorkId, WorkOrder>();
  private idsByStatus = new Map<WorkStatus, Set<WorkId>>();
  private reservationsByWorkId = new Map<WorkId, WorkReservation>();
  private workIdsByLockKey = new Map<string, Set<WorkId>>();

  public registerWork(order: WorkOrder): void {
    const prev = this.orders.get(order.id);
    if (prev) {
      this.detachFromStatus(prev.id, prev.status);
    }
    this.orders.set(order.id, order);
    this.attachToStatus(order.id, order.status);
  }

  public removeWork(id: WorkId): void {
    const prev = this.orders.get(id);
    if (!prev) return;
    this.detachFromStatus(prev.id, prev.status);
    this.orders.delete(id);
    this.clearReservation(id);
  }

  public getWork(id: WorkId): WorkOrder | undefined {
    return this.orders.get(id);
  }

  public updateWork(order: WorkOrder): void {
    if (!this.orders.has(order.id)) {
      throw new Error(`work-system: updateWork unknown work ${order.id}`);
    }
    this.registerWork(order);
  }

  public setStatus(id: WorkId, status: WorkStatus): void {
    const prev = this.orders.get(id);
    if (!prev) {
      throw new Error(`work-system: setStatus unknown work ${id}`);
    }
    if (prev.status === status) return;
    this.detachFromStatus(id, prev.status);
    const next: WorkOrder = { ...prev, status };
    this.orders.set(id, next);
    this.attachToStatus(id, status);
  }

  public listAll(): WorkOrder[] {
    return [...this.orders.values()];
  }

  public listByStatus(status: WorkStatus): WorkOrder[] {
    const ids = this.idsByStatus.get(status);
    if (!ids) return [];
    const out: WorkOrder[] = [];
    for (const wid of ids) {
      const o = this.orders.get(wid);
      if (o) out.push(o);
    }
    return out;
  }

  public listPending(): WorkOrder[] {
    return this.listByStatus("pending");
  }

  public listInProgress(): WorkOrder[] {
    return this.listByStatus("in_progress");
  }

  public listByWorkType(workType: string): WorkOrder[] {
    return [...this.orders.values()].filter((o) => o.workType === workType);
  }

  public listByWorkTypeAndStatus(workType: string, status: WorkStatus): WorkOrder[] {
    return this.listByStatus(status).filter((o) => o.workType === workType);
  }

  public listWithMinPriority(minPriority: number): WorkOrder[] {
    return [...this.orders.values()].filter((o) => o.priority >= minPriority);
  }

  public listAtCell(cell: GridCoord): WorkOrder[] {
    const key = coordKey(cell);
    return [...this.orders.values()].filter((o) => coordKey(o.targetCell) === key);
  }

  public listAtCellAndStatus(cell: GridCoord, status: WorkStatus): WorkOrder[] {
    const key = coordKey(cell);
    return this.listByStatus(status).filter((o) => coordKey(o.targetCell) === key);
  }

  /** 按优先级降序（数字大优先），同优先级稳定顺序为插入/迭代顺序。 */
  public listSortedByPriorityDesc(): WorkOrder[] {
    return [...this.orders.values()].sort((a, b) => b.priority - a.priority);
  }

  public setReservation(reservation: WorkReservation): void {
    const order = this.orders.get(reservation.workId);
    if (!order) {
      throw new Error(`work-system: setReservation unknown work ${reservation.workId}`);
    }
    this.clearReservation(reservation.workId);
    this.reservationsByWorkId.set(reservation.workId, reservation);
    const lk = workLockTargetKey(reservation.lockedTarget);
    let set = this.workIdsByLockKey.get(lk);
    if (!set) {
      set = new Set();
      this.workIdsByLockKey.set(lk, set);
    }
    set.add(reservation.workId);
  }

  public clearReservation(workId: WorkId): void {
    const prev = this.reservationsByWorkId.get(workId);
    if (!prev) return;
    this.reservationsByWorkId.delete(workId);
    const lk = workLockTargetKey(prev.lockedTarget);
    const set = this.workIdsByLockKey.get(lk);
    if (set) {
      set.delete(workId);
      if (set.size === 0) this.workIdsByLockKey.delete(lk);
    }
  }

  public getReservation(workId: WorkId): WorkReservation | undefined {
    return this.reservationsByWorkId.get(workId);
  }

  public listWorkIdsLockedOnTarget(target: WorkLockTarget): WorkId[] {
    const set = this.workIdsByLockKey.get(workLockTargetKey(target));
    return set ? [...set] : [];
  }

  public findReservationForWorkAndTarget(
    workId: WorkId,
    target: WorkLockTarget
  ): WorkReservation | undefined {
    const r = this.reservationsByWorkId.get(workId);
    if (!r) return undefined;
    return sameWorkLockTarget(r.lockedTarget, target) ? r : undefined;
  }

  private attachToStatus(id: WorkId, status: WorkStatus): void {
    let set = this.idsByStatus.get(status);
    if (!set) {
      set = new Set();
      this.idsByStatus.set(status, set);
    }
    set.add(id);
  }

  private detachFromStatus(id: WorkId, status: WorkStatus): void {
    const set = this.idsByStatus.get(status);
    if (!set) return;
    set.delete(id);
    if (set.size === 0) this.idsByStatus.delete(status);
  }
}
