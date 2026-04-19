/**
 * @file storage.service.ts
 * @description 仓库存储领域服务——负责仓库可接收判断、容量计算、入库、出库、库存摘要排序。
 *              本模块是“仓库建筑作为正式抽象库存容器”的唯一规则裁决点；
 *              所有材料型工作的入库/取材都应通过本服务，而不是直接读写 building.storage。
 * @dependencies core/types — DefId；features/building/building.types — Building；
 *               world/def-database — DefDatabase
 * @part-of features/storage 仓库存储功能模块
 */

import type { CellCoord, DefId } from '../../core/types';
import { ObjectKind } from '../../core/types';
import type { Building } from '../building/building.types';
import type { Pawn } from '../pawn/pawn.types';
import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';
import type { DefDatabase } from '../../world/def-database';
import { estimateDistance, isReachable } from '../pathfinding/path.service';

/**
 * 判断仓库是否能接收指定物品
 * - 仅当 building 挂载了 'all-haulable' 模式的存储组件且物品带 'haulable' 标签时返回 true
 */
export function canWarehouseAcceptItem(building: Building, defs: DefDatabase, defId: DefId): boolean {
  if (!building.storage || building.storage.mode !== 'all-haulable') return false;
  return defs.items.get(defId)?.tags.includes('haulable') ?? false;
}

/**
 * 计算仓库剩余空闲容量
 * @returns 剩余可用件数；非仓库或已满返回 0
 */
export function getWarehouseFreeCapacity(building: Building): number {
  if (!building.storage) return 0;
  return Math.max(0, building.storage.capacityMax - building.storage.storedCount);
}

/**
 * 入库：将一定数量的某类物品写入仓库库存
 * - 受到剩余容量限制；超出部分通过 remainingCount 回报
 * @returns { storedCount: 实际入库数量, remainingCount: 因容量不足未能入库的剩余数量 }
 */
export function storeInWarehouse(
  building: Building,
  defId: DefId,
  count: number,
): { storedCount: number; remainingCount: number } {
  if (!building.storage || count <= 0) return { storedCount: 0, remainingCount: count };
  const accepted = Math.min(count, getWarehouseFreeCapacity(building));
  if (accepted <= 0) return { storedCount: 0, remainingCount: count };
  building.storage.inventory[defId] = (building.storage.inventory[defId] ?? 0) + accepted;
  building.storage.storedCount += accepted;
  return { storedCount: accepted, remainingCount: count - accepted };
}

/**
 * 出库：从仓库库存中取出一定数量的某类物品
 * - 取空时自动从 inventory 字典移除该 defId 条目
 * @returns { takenCount: 实际取出数量, remainingCount: 仍未满足的剩余请求数量 }
 */
export function withdrawFromWarehouse(
  building: Building,
  defId: DefId,
  count: number,
): { takenCount: number; remainingCount: number } {
  if (!building.storage || count <= 0) return { takenCount: 0, remainingCount: count };
  const available = building.storage.inventory[defId] ?? 0;
  const taken = Math.min(available, count);
  if (taken <= 0) return { takenCount: 0, remainingCount: count };
  const next = available - taken;
  if (next > 0) {
    building.storage.inventory[defId] = next;
  } else {
    delete building.storage.inventory[defId];
  }
  building.storage.storedCount -= taken;
  return { takenCount: taken, remainingCount: count - taken };
}

/** 仓库库存摘要单元——用于 Inspector 库存网格展示 */
export interface WarehouseInventoryEntry {
  defId: DefId;
  label: string;
  count: number;
  color: number;
}

/** 仓库库存摘要 */
export interface WarehouseInventorySummary {
  totalCount: number;
  typeCount: number;
  entries: WarehouseInventoryEntry[];
}

/**
 * 汇总仓库库存——产出按数量降序、label 升序、defId 升序的稳定排序数组
 * 用于 Inspector 库存网格渲染
 */
export function summarizeWarehouseInventory(
  building: Building,
  defs: DefDatabase,
): WarehouseInventorySummary {
  const entries: WarehouseInventoryEntry[] = Object.entries(building.storage?.inventory ?? {})
    .map(([defId, count]) => ({
      defId,
      label: defs.items.get(defId)?.label ?? defId,
      count: count ?? 0,
      color: defs.items.get(defId)?.color ?? 0xffffff,
    }))
    .sort((a, b) =>
      b.count - a.count
      || a.label.localeCompare(b.label)
      || a.defId.localeCompare(b.defId),
    );

  return {
    totalCount: building.storage?.storedCount ?? 0,
    typeCount: entries.length,
    entries,
  };
}

// ── 仓库目标查找（AI 选址用） ──

/** 仓库入库候选 — 表示可被某个 pawn 选作入库目标的具体仓库及其交互点 */
export interface WarehouseDepositCandidate {
  warehouse: Building;
  approachCell: CellCoord;
  freeCapacity: number;
  distance: number;
}

/**
 * 为入库工作选择最近可达且仍有容量的仓库
 * - 仅考虑挂载 'all-haulable' 存储组件且能接收该 defId 的仓库
 * - approachCell 取自 building.interaction.interactionCell；缺失则跳过
 * - freeCapacity 截断为不超过 requestedCount，避免上层多算
 */
export function findReachableWarehouseForDeposit(
  pawn: Pawn,
  map: GameMap,
  world: World,
  defId: DefId,
  requestedCount: number,
): WarehouseDepositCandidate | null {
  let best: WarehouseDepositCandidate | null = null;

  for (const building of map.objects.allOfKind(ObjectKind.Building)) {
    if (!canWarehouseAcceptItem(building, world.defs, defId)) continue;
    const freeCapacity = getWarehouseFreeCapacity(building);
    if (freeCapacity <= 0) continue;
    const approachCell = building.interaction?.interactionCell;
    if (!approachCell) continue;
    if (!isReachable(map, pawn.cell, approachCell)) continue;

    const distance = estimateDistance(pawn.cell, approachCell);
    if (!best || distance < best.distance) {
      best = {
        warehouse: building,
        approachCell,
        freeCapacity: Math.min(freeCapacity, requestedCount),
        distance,
      };
    }
  }

  return best;
}
