/**
 * @file job-selector.ts
 * @description 工作选择系统 —— 每 Tick 为空闲的 Pawn 选择最优工作。
 *              通过 evaluator 管线收集各类别的工作评估结果，
 *              按优先级和分数排序并尝试预留目标，选出最佳工作分配给 Pawn。
 *              将排序后的结果冻结为决策快照供 inspector 展示。
 *              额外收集尚未抽取为 evaluator 的传统候选（指派、蓝图材料、建造工地），
 *              与 evaluator 结果合并排序后统一处理。
 * @dependencies core/types — 基础类型与枚举；core/tick-runner — 系统注册；core/logger — 日志；
 *               world — World/GameMap；pathfinding — 距离估算；
 *               ai.types — Job/JobCandidate；construction — Blueprint/ConstructionSite 类型；
 *               jobs/* — 各类工作工厂函数；
 *               work-evaluators — 统一评估器管线；work-types — 决策快照类型
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectKind, TickPhase, DesignationType, CellCoord, ToilType, ToilState, JobState, ZoneType, cellKey,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { estimateDistance, isReachable } from '../pathfinding/path.service';
import { Job, JobCandidate } from './ai.types';
import type { Pawn } from '../pawn/pawn.types';
import type { Item } from '../item/item.types';
import {
  findNearestAcceptingCell,
  getCellAvailableCapacity,
  isCellCompatibleForItemDef,
} from '../item/item.queries';
import { createMineJob } from './jobs/mine-job';
import { createHarvestJob } from './jobs/harvest-job';
import { createConstructJob } from './jobs/construct-job';
import { createHaulJob } from './jobs/haul-job';
import { createCarryJob } from './jobs/carry-job';
import {
  areBlueprintMaterialsDelivered,
  hasConstructionOccupants,
} from '../construction/construction.helpers';
import type { WorkEvaluation, WorkOption, WorkFailureReasonCode } from './work-types';
import { workEvaluators } from './work-evaluators';

/**
 * 工作选择系统注册。
 * 在 AI_DECISION 阶段运行，每 Tick 为所有空闲 Pawn 选择并分配工作。
 */
export const jobSelectionSystem: SystemRegistration = {
  id: 'jobSelection',
  phase: TickPhase.AI_DECISION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(world, map);
    }
  },
};

/**
 * 处理单个地图上所有 Pawn 的工作选择。
 * 仅为空闲（无当前工作）的 Pawn 分配新工作。
 *
 * @param world - 游戏世界实例
 * @param map   - 当前处理的地图
 */
function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    if (pawn.drafted) continue;

    // 仅为空闲的 Pawn 分配工作
    if (pawn.ai.currentJob !== null) continue;

    pawn.ai.idleTicks++;

    // ── 1. 运行 evaluator 管线收集评估结果 ──
    const evaluations: WorkEvaluation[] = [];
    for (const evaluator of workEvaluators) {
      evaluations.push(evaluator.evaluate(pawn, map, world));
    }

    // ── 2. 收集尚未抽取为 evaluator 的传统候选 ──
    const legacyCandidates = gatherLegacyCandidates(pawn, map, world);

    // 将传统候选包装为 WorkEvaluation 格式
    for (const candidate of legacyCandidates) {
      evaluations.push(wrapCandidateAsEvaluation(candidate, world.tick));
    }

    // ── 3. 按 priority 降序、score 降序排列 ──
    evaluations.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.score - a.score;
    });

    // ── 4. 从高到低尝试分配，记录 blocked/deferred ──
    let assigned = false;
    let selectedKind: string | null = null;

    for (const evaluation of evaluations) {
      // 跳过不可用的评估（无 createJob 表示该类别当前无有效选项）
      if (!evaluation.createJob) continue;

      const job = evaluation.createJob();
      if (!job) continue;

      // 检查携带冲突
      if (isJobBlockedByCarriedItems(pawn, job)) {
        evaluation.failureReasonCode = 'carrying_conflict';
        evaluation.failureReasonText = 'Current carrying stack blocks pickup-based work';
        evaluation.createJob = null;
        continue;
      }

      // 尝试预留目标
      if (job.targetId) {
        const resId = map.reservations.tryReserve({
          claimantId: pawn.id,
          targetId: job.targetId,
          jobId: job.id,
          currentTick: world.tick,
        });

        if (resId === null) {
          evaluation.failureReasonCode = 'target_reserved';
          evaluation.failureReasonText = 'Target already reserved';
          evaluation.createJob = null;
          continue;
        }

        job.reservations.push(resId);
      }

      assignJob(pawn, job, map, world);
      selectedKind = evaluation.kind;
      assigned = true;
      break;
    }

    // ── 5. 冻结决策快照 ──
    freezeWorkDecision(pawn, evaluations, selectedKind, world.tick);

    // 如果没有任何工作能分配（包括 wander evaluator 也失败），不做额外处理
    if (!assigned) {
      // wander evaluator 已在 evaluations 中，如果空闲不足 30 tick 则 wander 不可用
      // 这是预期行为
    }
  }
}

/**
 * 收集尚未抽取为 evaluator 的传统候选工作。
 * 包括：指派任务（采矿、收割、砍伐）、蓝图材料搬运、建造工地施工、
 *       散落物品存储区搬运、携带物处理。
 *
 * 注意：eat/sleep/haul_to_stockpile/wander 已由 evaluator 管线处理，
 *       此处不再重复收集。carry_resolution 也移至此处保留兼容。
 *
 * @param pawn   - 需要分配工作的空闲 Pawn
 * @param map    - 当前地图
 * @param world  - 游戏世界实例
 * @returns 传统候选工作列表（含分数）
 */
function gatherLegacyCandidates(
  pawn: Pawn,
  map: GameMap,
  world: World,
): (JobCandidate & { kind: string; label: string; priority: number })[] {
  const candidates: (JobCandidate & { kind: string; label: string; priority: number })[] = [];
  const carryResolutionCandidate = createCarryResolutionCandidate(pawn, map, world);

  // ── 1. 指派任务（采矿、收割、砍伐） ──
  const designations = map.objects.allOfKind(ObjectKind.Designation);
  for (const desig of designations) {
    if (desig.destroyed) continue;
    if (map.reservations.isReserved(desig.id)) continue;

    const targetCell = desig.targetCell ?? desig.cell;
    const dist = estimateDistance(pawn.cell, targetCell);
    const priorityBonus = (desig.priority ?? 2) * 10;

    let job: Job | null = null;
    let baseScore = 50;
    let kind = 'designation';
    let label = 'Designation';

    switch (desig.designationType) {
      case DesignationType.Mine:
        job = createMineJob(pawn.id, targetCell, desig.id, map);
        baseScore = 60;
        kind = 'designation_mine';
        label = 'Mine';
        break;
      case DesignationType.Harvest:
      case DesignationType.Cut:
        job = createHarvestJob(pawn.id, desig.id, targetCell, map);
        baseScore = 50;
        kind = desig.designationType === DesignationType.Harvest ? 'designation_harvest' : 'designation_cut';
        label = desig.designationType === DesignationType.Harvest ? 'Harvest' : 'Cut';
        break;
    }

    if (job) {
      const score = baseScore + priorityBonus - dist * 0.5;
      candidates.push({ job, score, kind, label, priority: 50 });
    }
  }

  // ── 2. 蓝图材料搬运 ──
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
  for (const bp of blueprints) {
    if (bp.destroyed) continue;

    if (areBlueprintMaterialsDelivered(bp)) {
      // 材料已送达，检查是否可以开工建造
      if (map.reservations.isReserved(bp.id)) continue;
      if (hasConstructionOccupants(map, bp)) continue;

      const dist = estimateDistance(pawn.cell, bp.cell);
      const job = createConstructJob(pawn.id, bp.id, bp.cell, map, { requiresPrepare: true });
      const score = 40 - dist * 0.5;
      candidates.push({ job, score, kind: 'construct', label: 'Construct', priority: 40 });
      continue;
    }

    // 检查哪些材料仍需搬运
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const requiredCount = bp.materialsRequired[i].count;
      const deliveredCount = bp.materialsDelivered[i]?.count ?? 0;
      const matDefId = bp.materialsRequired[i].defId;
      const inFlightCount = getBlueprintMaterialInFlightCount(map, bp.id, matDefId);
      const needed = requiredCount - deliveredCount - inFlightCount;
      if (needed <= 0) continue;

      // 寻找距离最近的同类型物品
      const items = map.objects.allOfKind(ObjectKind.Item);
      let bestItem: Item | null = null;
      let bestItemDist = Infinity;

      for (const item of items) {
        if (item.destroyed) continue;
        if (item.defId !== matDefId) continue;
        if (map.reservations.isReserved(item.id)) continue;
        if (!isReachableHaulRoute(pawn, item, bp.cell, map)) continue;

        const haulCount = Math.min(item.stackCount, needed, pawn.inventory.carryCapacity);
        if (haulCount <= 0) continue;

        const d = estimateDistance(pawn.cell, item.cell);
        if (d < bestItemDist) {
          bestItemDist = d;
          bestItem = item;
        }
      }

      if (bestItem) {
        const haulCount = Math.min(bestItem.stackCount, needed, pawn.inventory.carryCapacity);
        if (haulCount <= 0) continue;

        const job = createHaulJob(pawn.id, bestItem.id, bestItem.cell, bp.cell, haulCount, bp.id);
        const score = 45 - bestItemDist * 0.5;
        candidates.push({ job, score, kind: 'deliver_materials', label: 'Deliver Materials', priority: 45 });
        break; // 每个蓝图每个 Pawn 只分配一个搬运任务
      }
    }
  }

  // ── 3. 建造工地施工 ──
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite);
  for (const site of sites) {
    if (site.destroyed) continue;
    if (site.buildProgress >= 1.0) continue;
    if (map.reservations.isReserved(site.id)) continue;
    if (hasConstructionOccupants(map, site)) continue;

    const dist = estimateDistance(pawn.cell, site.cell);
    const job = createConstructJob(pawn.id, site.id, site.cell, map);

    // 根据工地剩余工作量更新 Work Toil 的 totalWork
    const workToil = job.toils.find(t => t.type === ToilType.Work);
    if (workToil) {
      workToil.localData.totalWork = site.totalWorkAmount - site.workDone;
    }

    const score = 40 - dist * 0.5;
    candidates.push({ job, score, kind: 'construct', label: 'Construct', priority: 40 });
  }

  // ── 4. 携带物处理 ──
  if (carryResolutionCandidate) {
    candidates.push({
      ...carryResolutionCandidate,
      kind: 'resolve_carrying',
      label: 'Resolve Carrying',
      priority: 20,
    });
  }

  return candidates;
}

/**
 * 将传统 JobCandidate 包装为 WorkEvaluation 格式，
 * 使其可以与 evaluator 结果统一排序处理
 */
function wrapCandidateAsEvaluation(
  candidate: JobCandidate & { kind: string; label: string; priority: number },
  tick: number,
): WorkEvaluation {
  return {
    kind: candidate.kind,
    label: candidate.label,
    priority: candidate.priority,
    score: candidate.score,
    failureReasonCode: 'none',
    failureReasonText: null,
    detail: candidate.job.defId,
    jobDefId: candidate.job.defId,
    evaluatedAtTick: tick,
    createJob: () => candidate.job,
  };
}

/**
 * 冻结工作决策快照 — 将排序后的评估结果持久化到 pawn.ai.workDecision
 *
 * @param pawn        - 执行选工的 Pawn
 * @param evaluations - 排序后的评估结果列表
 * @param selectedKind - 被选中的工作类别 kind（null 表示无工作可分配）
 * @param worldTick   - 当前世界 tick
 */
function freezeWorkDecision(
  pawn: Pawn,
  evaluations: WorkEvaluation[],
  selectedKind: string | null,
  worldTick: number,
): void {
  const currentToil = pawn.ai.currentJob?.toils[pawn.ai.currentJob.currentToilIndex];

  // 标记状态：被选中的为 active，失败的为 blocked，其余为 deferred
  let foundSelected = false;
  const options: WorkOption[] = evaluations.map((evaluation) => {
    let status: WorkOption['status'];
    if (evaluation.kind === selectedKind) {
      status = 'active';
      foundSelected = true;
    } else if (evaluation.failureReasonCode !== 'none') {
      status = 'blocked';
    } else if (foundSelected || selectedKind !== null) {
      // 在已选工作之后，或有已选工作但不是当前项
      status = 'deferred';
    } else {
      // 没有任何工作被选中时，无 createJob 的标记为 blocked
      status = evaluation.createJob ? 'deferred' : 'blocked';
    }

    return {
      kind: evaluation.kind,
      label: evaluation.label,
      priority: evaluation.priority,
      score: evaluation.score,
      failureReasonCode: evaluation.failureReasonCode,
      failureReasonText: evaluation.failureReasonText,
      detail: evaluation.detail,
      jobDefId: evaluation.jobDefId,
      evaluatedAtTick: worldTick,
      status,
    };
  });

  pawn.ai.workDecision = {
    evaluatedAtTick: worldTick,
    selectedWorkKind: selectedKind,
    selectedWorkLabel: options.find(o => o.kind === selectedKind)?.label ?? null,
    selectedJobId: pawn.ai.currentJob?.id ?? null,
    activeToilLabel: currentToil?.type ?? null,
    activeToilState: currentToil?.state ?? null,
    options,
  };
}

// ── 以下为辅助函数，保持原有行为 ──

/** 获取蓝图材料搬运中的在途数量 */
function getBlueprintMaterialInFlightCount(
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

/** 获取 pawn 当前搬运工作的计划数量 */
function getDeliverJobPlannedCount(
  pawn: Pawn,
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

  if (pawn.inventory.carrying?.defId === materialDefId) {
    return pawn.inventory.carrying.count;
  }

  const deliverDefId = typeof deliverToil.localData.defId === 'string'
    ? deliverToil.localData.defId
    : null;
  if (deliverDefId && deliverDefId !== 'unknown' && deliverDefId !== materialDefId) {
    return 0;
  }

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

/** 创建携带物处理候选 */
function createCarryResolutionCandidate(
  pawn: Pawn,
  map: GameMap,
  world: World,
): JobCandidate | null {
  const carrying = pawn.inventory.carrying;
  if (!carrying) return null;

  const blueprintCandidate = findCarryResolutionBlueprintCandidate(pawn, map, carrying.defId);
  if (blueprintCandidate) {
    return {
      job: createCarryJob(
        pawn.id,
        blueprintCandidate.blueprint.cell,
        Math.min(carrying.count, blueprintCandidate.needed),
        blueprintCandidate.blueprint.id,
      ),
      score: 8 - blueprintCandidate.distance * 0.1,
    };
  }

  const targetCell = findReachableAcceptingCell(pawn, map, world, carrying.defId, 'stockpile-only')
    ?? findReachableAcceptingCell(pawn, map, world, carrying.defId, 'nearest-compatible');
  if (!targetCell) return null;

  return {
    job: createCarryJob(pawn.id, targetCell, carrying.count),
    score: 4 - estimateDistance(pawn.cell, targetCell) * 0.1,
  };
}

/** 在蓝图中寻找可以消耗当前携带物的目标 */
function findCarryResolutionBlueprintCandidate(
  pawn: Pawn,
  map: GameMap,
  materialDefId: string,
): { blueprint: { id: string; cell: CellCoord }; needed: number; distance: number } | null {
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
  let bestCandidate: { blueprint: { id: string; cell: CellCoord }; needed: number; distance: number } | null = null;

  for (const blueprint of blueprints) {
    if (blueprint.destroyed || areBlueprintMaterialsDelivered(blueprint)) continue;
    if (!isReachable(map, pawn.cell, blueprint.cell)) continue;

    for (let i = 0; i < blueprint.materialsRequired.length; i++) {
      const required = blueprint.materialsRequired[i];
      const delivered = blueprint.materialsDelivered[i];
      if (!required || required.defId !== materialDefId || delivered?.defId !== materialDefId) continue;

      const inFlight = getBlueprintMaterialInFlightCount(map, blueprint.id, materialDefId);
      const needed = required.count - (delivered?.count ?? 0) - inFlight;
      if (needed <= 0) continue;

      const distance = estimateDistance(pawn.cell, blueprint.cell);
      if (!bestCandidate || distance < bestCandidate.distance) {
        bestCandidate = {
          blueprint: { id: blueprint.id, cell: blueprint.cell },
          needed,
          distance,
        };
      }

      break;
    }
  }

  return bestCandidate;
}

/** 在存储区中查找可达的接受格子 */
function findReachableAcceptingCell(
  pawn: Pawn,
  map: GameMap,
  world: World,
  defId: string,
  searchScope: 'stockpile-only' | 'nearest-compatible',
): CellCoord | null {
  const excludedCells = new Set<string>();

  while (true) {
    const candidate = findNearestAcceptingCell(
      map,
      world.defs,
      pawn.cell,
      defId,
      searchScope,
      {
        excludedCells,
        selectionPreference: 'prefer-existing-stacks',
      },
    );
    if (!candidate) return null;
    if (isReachable(map, pawn.cell, candidate)) {
      return candidate;
    }
    excludedCells.add(cellKey(candidate));
  }
}

/** 判断搬运路线（pawn → item → dest）是否全程可达 */
function isReachableHaulRoute(
  pawn: Pawn,
  item: Item,
  destCell: CellCoord,
  map: GameMap,
): boolean {
  return isReachable(map, pawn.cell, item.cell) && isReachable(map, item.cell, destCell);
}

/** 检查工作是否因携带物而被阻塞（携带物品时不能执行含 PickUp 的工作） */
function isJobBlockedByCarriedItems(pawn: Pawn, job: Job): boolean {
  return pawn.inventory.carrying != null
    && job.toils.some(toil => toil.type === ToilType.PickUp);
}

/**
 * 将工作分配给 Pawn：设置 AI 状态、重置空闲计数、推送 job_assigned 事件。
 *
 * @param pawn   - 接受工作的 Pawn
 * @param job    - 要分配的工作
 * @param map    - 当前地图
 * @param world  - 游戏世界实例
 */
function assignJob(
  pawn: Pawn,
  job: Job,
  map: GameMap,
  world: World,
): void {
  if (job.defId === 'job_sleep' && job.targetId) {
    const bed = map.objects.getAs(job.targetId, ObjectKind.Building);
    if (
      bed?.bed
      && bed.bed.autoAssignable
      && bed.bed.ownerPawnId === undefined
    ) {
      bed.bed.ownerPawnId = pawn.name;
    }
  }

  pawn.ai.currentJob = job;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.ai.idleTicks = 0;

  log.info('ai', `Pawn ${pawn.id} assigned job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_assigned',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });
}
