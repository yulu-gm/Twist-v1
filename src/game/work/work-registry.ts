import { coordKey, type GridCoord } from "../map/world-grid";
import type { WorkOrder, WorkOrderKind, WorkOrderStatus } from "./work-types";

/** 与 {@link generateHaulWork} 的 `workId` 拼接一致：`entity:fromKey:zoneId:dropKey`。 */
function haulRouteDedupKey(workId: string): string | undefined {
  if (!workId.startsWith("work:haul:")) return undefined;
  const tail = workId.slice("work:haul:".length);
  const parts = tail.split(":");
  return parts.length === 4 ? tail : undefined;
}

/**
 * 是否与入参工单占用同一「逻辑槽」（策划去重维度：kind + targetEntityId + 关键格；haul 路线另编码在 workId 中）。
 */
function workOrdersShareLogicalSlot(existing: WorkOrder, incoming: WorkOrder): boolean {
  if (existing.kind !== incoming.kind) return false;
  if (existing.targetEntityId !== incoming.targetEntityId) return false;
  if (incoming.kind === "haul") {
    const a = haulRouteDedupKey(existing.workId);
    const b = haulRouteDedupKey(incoming.workId);
    return Boolean(a && b && a === b);
  }
  return coordKey(existing.targetCell) === coordKey(incoming.targetCell);
}

/**
 * `WorkOrder` 侧的工作目录：登记、按维度查询，与 {@link ./work-scheduler} / {@link ./work-settler} 配合。
 *
 * **与 `WorldCore.workItems`（`WorkItemSnapshot`）的主从关系（AP-0180）**
 * - **主存储（模拟与存档事实源）**：`WorldCore.workItems`。行为 tick、行走/读条、认领与清理、UI 从世界读工单等均以此为准。
 * - **本注册表**：编排流（如 `flows/build-flow`、`flows/chop-flow`）、测试与需 `WorkOrder` 完整字段的调度 API 使用；与 `workItems` 双轨并存为**过渡期**。
 * - **淘汰条件**：当所有游玩与编排路径统一经 `workItems` 读写、且不再需要独立的 `WorkOrder` Map 时，应将本模块收敛为 `workItems` 的单一数据源或只读投影，并删除重复写入路径。
 */

/**
 * 工作目录侧统一的优先级序：priority 降序，同优先级按 workId 字典序（与 {@link getAvailableWork} 行为一致）。
 */
export function sortWorkOrdersByPriorityDesc(orders: readonly WorkOrder[]): WorkOrder[] {
  return [...orders].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.workId.localeCompare(b.workId);
  });
}

export type WorkRegistry = {
  orders: Map<string, WorkOrder>;
};

export function createWorkRegistry(): WorkRegistry {
  return { orders: new Map() };
}

/**
 * 登记工单并做槽位去重（oh-code-design 工作系统「工作生成层」：去重并合并重复工作）。
 *
 * **归属**：合并策略在登记入口执行；{@link WorkOrder.workId} 的规范见 `work-generator.ts`，二者需一致。
 * **策略**：`workId` 相同时覆盖；否则若与某已登记单占用同一逻辑槽，则移除旧单再写入（同槽仅保留最新）。
 */
export function addWork(registry: WorkRegistry, order: WorkOrder): void {
  for (const [wid, existing] of registry.orders.entries()) {
    if (wid === order.workId) continue;
    if (workOrdersShareLogicalSlot(existing, order)) {
      registry.orders.delete(wid);
    }
  }
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

/** 按 {@link WorkOrder.targetCell} 精确匹配（col/row）。 */
export function getByTargetCell(registry: WorkRegistry, cell: GridCoord): WorkOrder[] {
  const out: WorkOrder[] = [];
  for (const o of registry.orders.values()) {
    if (o.targetCell.col === cell.col && o.targetCell.row === cell.row) out.push(o);
  }
  return out;
}

/**
 * 将 `source.orders` 同步到 `target.orders`（清空后按条目复制），用于 {@link claimWork} / {@link releaseWork}
 * 返回新注册表快照后，仍保持调用方持有的 `WorkRegistry` 引用与领域状态一致。
 */
export function replaceWorkRegistryOrders(target: WorkRegistry, source: WorkRegistry): void {
  if (target.orders === source.orders) {
    return;
  }
  const entries = [...source.orders];
  target.orders.clear();
  for (const [k, v] of entries) {
    target.orders.set(k, v);
  }
}
