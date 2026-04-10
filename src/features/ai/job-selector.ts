/**
 * @file job-selector.ts
 * @description 工作选择系统 —— 每 Tick 为空闲的 Pawn 选择最优工作。
 *              收集所有候选任务（进食、采矿、收割、搬运材料、建造），
 *              按效用分数排序并尝试预留目标，选出最佳工作分配给 Pawn。
 *              若无可用工作则分配随机漫步任务。
 * @dependencies core/types — 基础类型与枚举；core/tick-runner — 系统注册；core/logger — 日志；
 *               world — World/GameMap；pathfinding — 距离估算；
 *               ai.types — Job/JobCandidate；construction — Blueprint/ConstructionSite 类型；
 *               jobs/* — 各类工作工厂函数
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectKind, TickPhase, DesignationType, CellCoord, ToilType, ToilState, JobState, ZoneType, cellKey,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import type { Zone } from '../../world/zone-manager';
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
import { createEatJob } from './jobs/eat-job';
import {
  areBlueprintMaterialsDelivered,
  hasConstructionOccupants,
} from '../construction/construction.helpers';

/** 漫步工作计数器 */
let wanderJobCounter = 0;

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
    // 仅为空闲的 Pawn 分配工作
    if (pawn.ai.currentJob !== null) continue;

    pawn.ai.idleTicks++;

    const candidates = gatherCandidates(pawn, map, world);

    if (candidates.length === 0) {
      // 无候选工作时，空闲超过 30 Tick 后分配漫步任务
      if (pawn.ai.idleTicks > 30) {
        const wanderJob = createWanderJob(pawn, map, world);
        if (wanderJob) {
          assignJob(pawn, wanderJob, map, world);
        }
      }
      continue;
    }

    // 按分数降序排列，选择最优候选
    candidates.sort((a, b) => b.score - a.score);

    // 尝试分配最优工作，逐个尝试预留目标资源
    let assigned = false;
    for (const candidate of candidates) {
      if (candidate.job.targetId) {
        const resId = map.reservations.tryReserve({
          claimantId: pawn.id,
          targetId: candidate.job.targetId,
          jobId: candidate.job.id,
          currentTick: world.tick,
        });

        if (resId === null) continue; // 目标已被预留，尝试下一个候选

        candidate.job.reservations.push(resId);
      }

      assignJob(pawn, candidate.job, map, world);
      assigned = true;
      break;
    }

    if (!assigned) {
      const wanderJob = createWanderJob(pawn, map, world);
      if (wanderJob) {
        assignJob(pawn, wanderJob, map, world);
      }
    }
  }
}

/**
 * 收集当前 Pawn 的所有候选工作，按四大类别扫描：
 *   1. 紧急需求（饱食度低时寻找食物）
 *   2. 指派任务（采矿、收割、砍伐）
 *   3. 蓝图材料搬运（为建筑蓝图运送所需材料）
 *   4. 建筑工地施工（对准备好的工地执行建造）
 * 每个候选项包含工作实例和效用分数。
 *
 * @param pawn   - 需要分配工作的空闲 Pawn
 * @param map    - 当前地图
 * @param _world - 游戏世界实例（未使用）
 * @returns 候选工作列表（含分数），由调用方排序选择
 */
function gatherCandidates(
  pawn: Pawn,
  map: GameMap,
  world: World,
): JobCandidate[] {
  const candidates: JobCandidate[] = [];

  // ── 1. 检查紧急需求 ──
  // 饱食度低于 30 时，寻找食物
  if (pawn.needs.food < 30) {
    const foodCandidate = findFoodJob(pawn, map, world);
    if (foodCandidate) {
      candidates.push(foodCandidate);
    }
  }

  // ── 2. 检查指派任务（采矿、收割、砍伐） ──
  const designations = map.objects.allOfKind(ObjectKind.Designation);
  for (const desig of designations) {
    if (desig.destroyed) continue;
    if (map.reservations.isReserved(desig.id)) continue;

    const targetCell = desig.targetCell ?? desig.cell;
    const dist = estimateDistance(pawn.cell, targetCell);
    const priorityBonus = (desig.priority ?? 2) * 10;

    let job: Job | null = null;
    let baseScore = 50;

    switch (desig.designationType) {
      case DesignationType.Mine:
        job = createMineJob(pawn.id, targetCell, desig.id, map);
        baseScore = 60;
        break;
      case DesignationType.Harvest:
      case DesignationType.Cut:
        job = createHarvestJob(pawn.id, desig.id, targetCell, map);
        baseScore = 50;
        break;
    }

    if (job) {
      const score = baseScore + priorityBonus - dist * 0.5;
      candidates.push({ job, score });
    }
  }

  // ── 3. 检查需要材料搬运的蓝图 ──
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
  for (const bp of blueprints) {
    if (bp.destroyed) continue;

    if (areBlueprintMaterialsDelivered(bp)) {
      if (map.reservations.isReserved(bp.id)) continue;
      if (hasConstructionOccupants(map, bp)) continue;

      const dist = estimateDistance(pawn.cell, bp.cell);
      const job = createConstructJob(pawn.id, bp.id, bp.cell, map, { requiresPrepare: true });
      const score = 40 - dist * 0.5;
      candidates.push({ job, score });
      continue;
    }

    // 检查哪些材料仍需搬运
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const needed = bp.materialsRequired[i].count - (bp.materialsDelivered[i]?.count ?? 0);
      if (needed <= 0) continue;

      const matDefId = bp.materialsRequired[i].defId;

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
        candidates.push({ job, score });
        break; // 每个蓝图每个 Pawn 只分配一个搬运任务
      }
    }
  }

  // ── 4. 检查需要施工的建筑工地 ──
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
    candidates.push({ job, score });
  }

  // ── 5. 检查散落物品的存储区搬运 ──
  const stockpileCandidate = createStockpileHaulCandidate(pawn, map, world);
  if (stockpileCandidate) {
    candidates.push(stockpileCandidate);
  }

  return candidates;
}

/**
 * 生成“搬运到存储区”的低优先级候选。
 *
 * 规则：
 * - 只处理带 haulable 标签的物品
 * - 已位于兼容存储区内的物品不再生成候选
 * - 仅把物品送往 stockpile 区域中“当前可接受且有容量”的格子
 */
function createStockpileHaulCandidate(
  pawn: Pawn,
  map: GameMap,
  world: World,
): JobCandidate | null {
  const items = map.objects.allOfKind(ObjectKind.Item) as Item[];
  let bestItem: Item | null = null;
  let bestDest: CellCoord | null = null;
  let bestScore = -Infinity;

  for (const item of items) {
    if (item.destroyed) continue;
    if (!item.tags.has('haulable')) continue;
    if (map.reservations.isReserved(item.id)) continue;
    if (isItemInCompatibleStockpile(map, item)) continue;

    const placement = findReachableStockpilePlacement(pawn, item, map, world);
    if (!placement) continue;

    const haulCount = Math.min(item.stackCount, placement.totalCapacity, pawn.inventory.carryCapacity);
    if (haulCount <= 0) continue;

    const itemDist = estimateDistance(pawn.cell, item.cell);
    const destDist = estimateDistance(item.cell, placement.bestCell);
    const score = 15 - itemDist * 0.45 - destDist * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
      bestDest = placement.bestCell;
    }
  }

  if (!bestItem || !bestDest) return null;

  const bestPlacement = findReachableStockpilePlacement(pawn, bestItem, map, world);
  if (!bestPlacement) return null;

  const haulCount = Math.min(bestItem.stackCount, bestPlacement.totalCapacity, pawn.inventory.carryCapacity);
  if (haulCount <= 0) return null;

  const job = createHaulJob(pawn.id, bestItem.id, bestItem.cell, bestDest, haulCount);
  return { job, score: bestScore };
}

/** 判断物品是否已经位于兼容的 stockpile 存储区内 */
function isItemInCompatibleStockpile(map: GameMap, item: Item): boolean {
  const zone = map.zones.getZoneAt(cellKey(item.cell));
  return !!zone
    && zone.zoneType === ZoneType.Stockpile
    && isItemAcceptedByStockpile(zone, item)
    && isCellCompatibleForItemDef(map, item.cell, item.defId);
}

function isItemAcceptedByStockpile(zone: Zone, item: Item): boolean {
  const stockpile = zone.config.stockpile;
  if (!stockpile) return true;
  if (stockpile.allowAllHaulable) return item.tags.has('haulable');
  return stockpile.allowedDefIds.has(item.defId);
}

/**
 * 寻找最近的食物并创建进食工作候选项。
 * 遍历地图上所有带 "food" 标签的物品，按距离选择最近且未被预留的食物。
 * 分数由紧急程度和距离共同决定。
 *
 * @param pawn - 需要进食的 Pawn
 * @param map  - 当前地图
 * @returns 进食工作候选项（含分数），若无食物则返回 null
 */
function isReachableHaulRoute(
  pawn: Pawn,
  item: Item,
  destCell: CellCoord,
  map: GameMap,
): boolean {
  return isReachable(map, pawn.cell, item.cell) && isReachable(map, item.cell, destCell);
}

function findReachableStockpilePlacement(
  pawn: Pawn,
  item: Item,
  map: GameMap,
  world: World,
): { bestCell: CellCoord; totalCapacity: number } | null {
  if (!isReachable(map, pawn.cell, item.cell)) return null;

  let totalReachableCapacity = 0;
  for (const zone of map.zones.getAll()) {
    if (zone.zoneType !== ZoneType.Stockpile) continue;
    for (const key of zone.cells) {
      const [x, y] = key.split(',').map(Number);
      const cell = { x, y };
      if (!isReachable(map, item.cell, cell)) continue;
      totalReachableCapacity += getCellAvailableCapacity(map, world.defs, cell, item.defId, 'stockpile-only');
    }
  }

  if (totalReachableCapacity <= 0) return null;

  const excludedCells = new Set<string>();
  while (true) {
    const candidate = findNearestAcceptingCell(
      map,
      world.defs,
      item.cell,
      item.defId,
      'stockpile-only',
      {
        excludedCells,
        selectionPreference: 'prefer-existing-stacks',
      },
    );
    if (!candidate) return null;
    if (isReachable(map, item.cell, candidate)) {
      return {
        bestCell: candidate,
        totalCapacity: totalReachableCapacity,
      };
    }
    excludedCells.add(cellKey(candidate));
  }
}

function findFoodJob(
  pawn: Pawn,
  map: GameMap,
  world: World,
): JobCandidate | null {
  const items = map.objects.allWithTag('food') as Item[];
  let bestItem: Item | null = null;
  let bestDist = Infinity;

  for (const item of items) {
    if (item.destroyed) continue;
    if (map.reservations.isReserved(item.id)) continue;

    const dist = estimateDistance(pawn.cell, item.cell);
    if (dist < bestDist) {
      bestDist = dist;
      bestItem = item;
    }
  }

  if (!bestItem) return null;

  const nutritionPerItem = Math.max(1, world.defs.items.get(bestItem.defId)?.nutritionValue ?? 30);
  const missingFood = Math.max(1, 100 - pawn.needs.food);
  const requestedCount = Math.min(
    bestItem.stackCount,
    pawn.inventory.carryCapacity,
    Math.max(1, Math.ceil(missingFood / nutritionPerItem)),
  );
  if (requestedCount <= 0) return null;

  const job = createEatJob(
    pawn.id,
    bestItem.id,
    bestItem.cell,
    requestedCount,
    requestedCount * nutritionPerItem,
  );
  // 紧急程度越高分数越高（饱食度越低越紧急）
  const urgency = (30 - pawn.needs.food) / 30; // 0~1，越高越紧急
  const score = 100 + urgency * 200 - bestDist * 0.5;

  return { job, score };
}

/**
 * 创建一个随机漫步工作。
 * 在 Pawn 周围小范围内随机选择一个可通行格子作为目标，包含单个 GoTo Toil。
 * 最多尝试 10 次寻找有效目标。
 *
 * @param pawn  - 需要漫步的 Pawn
 * @param map   - 当前地图
 * @param world - 游戏世界实例（用于随机数生成器）
 * @returns 漫步 Job，若找不到有效目标则返回 null
 */
function createWanderJob(
  pawn: Pawn,
  map: GameMap,
  world: World,
): Job | null {
  // 在半径 5 格内随机选择一个可通行目标，最多尝试 10 次
  const radius = 5;
  const attempts = 10;

  for (let i = 0; i < attempts; i++) {
    const dx = world.rng.nextInt(-radius, radius);
    const dy = world.rng.nextInt(-radius, radius);
    const target: CellCoord = {
      x: Math.max(0, Math.min(map.width - 1, pawn.cell.x + dx)),
      y: Math.max(0, Math.min(map.height - 1, pawn.cell.y + dy)),
    };

    if (!map.pathGrid.isPassable(target.x, target.y)) continue;
    if (!map.spatial.isPassable(target)) continue;

    wanderJobCounter++;
    const job: Job = {
      id: `job_wander_${wanderJobCounter}`,
      defId: 'job_wander',
      pawnId: pawn.id,
      targetCell: target,
      toils: [
        {
          type: ToilType.GoTo,
          targetCell: target,
          state: ToilState.NotStarted,
          localData: {},
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Starting,
    };

    return job;
  }

  return null;
}

/**
 * 将工作分配给 Pawn：设置 AI 状态、重置空闲计数、推送 job_assigned 事件。
 *
 * @param pawn   - 接受工作的 Pawn
 * @param job    - 要分配的工作
 * @param _map   - 当前地图（未使用）
 * @param world  - 游戏世界实例
 */
function assignJob(
  pawn: Pawn,
  job: Job,
  _map: GameMap,
  world: World,
): void {
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
