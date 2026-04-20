/**
 * @file hauling.evaluator.ts
 * @description 仓库入库工作评估器 — 评估 pawn 是否可以把地面物资搬入仓库的抽象库存
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               pathfinding — 距离估算和可达性检查；
 *               storage/storage.service — 仓库目标查找；
 *               ai/jobs/storage-job — 入库 Job 工厂
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { Item } from '../../item/item.types';
import type { Building } from '../../building/building.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { ObjectKind, CellCoord } from '../../../core/types';
import { estimateDistance, isReachable } from '../../pathfinding/path.service';
import { findReachableWarehouseForDeposit } from '../../storage/storage.service';
import { createStoreInStorageJob } from '../jobs/storage-job';

/**
 * 仓库入库工作评估器 — 为散落物品寻找最近可达的仓库目标
 *
 * 仅处理带 haulable 标签且未被预约的地面物品
 * 评分公式：15 - itemDist * 0.45 - destDist * 0.2
 */
export const haulToStorageWorkEvaluator: WorkEvaluator = {
  kind: 'haul_to_storage',
  label: '搬运入库',
  priority: 15,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked = (
      code: 'no_target' | 'no_storage_destination',
      text: string,
    ): WorkEvaluation => ({
      kind: 'haul_to_storage',
      label: '搬运入库',
      priority: 15,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    });

    const items = map.objects.allOfKind(ObjectKind.Item) as Item[];

    let best: {
      item: Item;
      warehouse: Building;
      approachCell: CellCoord;
      score: number;
      haulCount: number;
    } | null = null;

    let sawHaulable = false;

    for (const item of items) {
      if (item.destroyed) continue;
      if (!item.tags.has('haulable')) continue;
      if (map.reservations.isReserved(item.id)) continue;
      // 物品本身不可达——pawn 取不到，跳过（也不计入 sawHaulable，因为对该 pawn 等价于"没料"）
      if (!isReachable(map, pawn.cell, item.cell)) continue;
      sawHaulable = true;

      const candidate = findReachableWarehouseForDeposit(
        pawn,
        map,
        world,
        item.defId,
        item.stackCount,
      );
      if (!candidate) continue;

      const haulCount = Math.min(
        item.stackCount,
        candidate.freeCapacity,
        pawn.inventory.carryCapacity,
      );
      if (haulCount <= 0) continue;

      const itemDist = estimateDistance(pawn.cell, item.cell);
      const destDist = estimateDistance(item.cell, candidate.approachCell);
      const score = 15 - itemDist * 0.45 - destDist * 0.2;

      if (!best || score > best.score) {
        best = {
          item,
          warehouse: candidate.warehouse,
          approachCell: candidate.approachCell,
          score,
          haulCount,
        };
      }
    }

    if (!best) {
      // 区分两种失败：没有任何地面可搬物 → no_target；
      // 有地面可搬物但所有仓库都没有可用空间（已存在仓库但满了/不可达） → no_storage_destination
      if (!sawHaulable) {
        return blocked('no_target', '没有可入库的地面物资');
      }
      const hasAnyWarehouse = (
        map.objects.allOfKind(ObjectKind.Building) as Building[]
      ).some(b => !!b.storage);
      if (hasAnyWarehouse) {
        return blocked('no_storage_destination', '没有可达且仍有空间的仓库');
      }
      return blocked('no_target', '没有可入库的地面物资');
    }

    const itemId = best.item.id;
    const itemCell = { ...best.item.cell };
    const warehouseId = best.warehouse.id;
    const approachCell = { ...best.approachCell };
    const haulCount = best.haulCount;

    return {
      kind: 'haul_to_storage',
      label: '搬运入库',
      priority: 15,
      score: best.score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: best.item.defId,
      jobDefId: 'job_store_in_storage',
      evaluatedAtTick: world.tick,
      createJob: () =>
        createStoreInStorageJob(pawn.id, itemId, itemCell, warehouseId, approachCell, haulCount),
    };
  },
};
