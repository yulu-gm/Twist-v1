/**
 * @file blueprint-inflight.ts
 * @description 蓝图在途材料计算工具 — 计算正在被搬运到指定蓝图的材料数量
 * @dependencies core/types — ObjectKind, ToilType, ToilState, JobState；
 *               world/game-map — GameMap
 * @part-of AI 子系统（features/ai/work-evaluators）
 */

import type { GameMap } from '../../../world/game-map';
import { ObjectKind, ToilType, ToilState, JobState } from '../../../core/types';

/**
 * 获取蓝图材料搬运中的在途数量
 *
 * 遍历地图上所有 Pawn，统计正在搬运指定材料到目标蓝图的总量。
 * 包括已拾起正在携带中的，以及已分配 PickUp 但尚未拿起的。
 *
 * @param map           - 当前地图
 * @param blueprintId   - 目标蓝图的对象 ID
 * @param materialDefId - 需要统计的材料定义 ID
 * @returns 在途的材料总数
 */
export function getBlueprintMaterialInFlightCount(
  map: GameMap,
  blueprintId: string,
  materialDefId: string,
): number {
  let total = 0;
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    total += getDeliverJobPlannedCount(pawn, map, blueprintId, materialDefId);
  }

  return total;
}

/**
 * 获取单个 pawn 当前搬运工作的计划数量
 *
 * 检查 pawn 是否正在执行 job_deliver_materials，且目标为指定蓝图。
 * 如果 pawn 已携带匹配材料则返回携带量；否则从 PickUp toil 推断计划拾取量。
 *
 * @param pawn          - 要检查的 Pawn 对象
 * @param map           - 当前地图
 * @param blueprintId   - 目标蓝图的对象 ID
 * @param materialDefId - 需要匹配的材料定义 ID
 * @returns 该 pawn 计划搬运的材料数量
 */
function getDeliverJobPlannedCount(
  pawn: { ai: { currentJob: { defId: string; state: string; toils: Array<{ type: string; targetId?: string; state: string; localData: Record<string, unknown> }> } | null }; inventory: { carrying: { defId: string; count: number } | null } },
  map: GameMap,
  blueprintId: string,
  materialDefId: string,
): number {
  const job = pawn.ai.currentJob;
  if (!job || job.defId !== 'job_deliver_materials') return 0;
  if (job.state === JobState.Done || job.state === JobState.Failed) return 0;

  const deliverToil = job.toils.find(toil => toil.type === ToilType.Deliver);
  if (!deliverToil || deliverToil.targetId !== blueprintId) return 0;
  if (deliverToil.state === ToilState.Completed || deliverToil.state === ToilState.Failed) return 0;

  // 已经拾起并携带中
  if (pawn.inventory.carrying?.defId === materialDefId) {
    return pawn.inventory.carrying.count;
  }

  // 检查 deliver toil 中记录的材料 defId 是否匹配
  const deliverDefId = typeof deliverToil.localData.defId === 'string'
    ? deliverToil.localData.defId
    : null;
  if (deliverDefId && deliverDefId !== 'unknown' && deliverDefId !== materialDefId) {
    return 0;
  }

  // 从 PickUp toil 推断计划拾取量
  const pickupToil = job.toils.find(toil => toil.type === ToilType.PickUp);
  if (!pickupToil || !pickupToil.targetId) return 0;

  const pickupItem = map.objects.getAs(pickupToil.targetId, ObjectKind.Item);
  if (!pickupItem || pickupItem.destroyed || pickupItem.defId !== materialDefId) return 0;

  const requestedCount = Math.max(
    0,
    Math.floor((pickupToil.localData.requestedCount as number) ?? (deliverToil.localData.count as number) ?? 0),
  );

  return requestedCount;
}
