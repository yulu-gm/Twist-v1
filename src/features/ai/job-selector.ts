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
import { createCarryJob } from './jobs/carry-job';
import { createEatJob } from './jobs/eat-job';
import { createSleepJob } from './jobs/sleep-job';
import {
  areBlueprintMaterialsDelivered,
  hasConstructionOccupants,
} from '../construction/construction.helpers';
import {
  getAllBeds,
  getBedByOwner,
  isBedAvailable,
} from '../building/building.queries';

/** 婕宸ヤ綔璁℃暟鍣?*/
let wanderJobCounter = 0;

/**
 * 宸ヤ綔閫夋嫨绯荤粺娉ㄥ唽銆?
 * 鍦?AI_DECISION 闃舵杩愯锛屾瘡 Tick 涓烘墍鏈夌┖闂?Pawn 閫夋嫨骞跺垎閰嶅伐浣溿€?
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
 * 澶勭悊鍗曚釜鍦板浘涓婃墍鏈?Pawn 鐨勫伐浣滈€夋嫨銆?
 * 浠呬负绌洪棽锛堟棤褰撳墠宸ヤ綔锛夌殑 Pawn 鍒嗛厤鏂板伐浣溿€?
 *
 * @param world - 娓告垙涓栫晫瀹炰緥
 * @param map   - 褰撳墠澶勭悊鐨勫湴鍥?
 */
function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    if (pawn.drafted) continue;

    // 浠呬负绌洪棽鐨?Pawn 鍒嗛厤宸ヤ綔
    if (pawn.ai.currentJob !== null) continue;

    pawn.ai.idleTicks++;

    const candidates = gatherCandidates(pawn, map, world);

    if (candidates.length === 0) {
      // 鏃犲€欓€夊伐浣滄椂锛岀┖闂茶秴杩?30 Tick 鍚庡垎閰嶆极姝ヤ换鍔?
      if (pawn.ai.idleTicks > 30) {
        const wanderJob = createWanderJob(pawn, map, world);
        if (wanderJob) {
          assignJob(pawn, wanderJob, map, world);
        }
      }
      continue;
    }

    // 鎸夊垎鏁伴檷搴忔帓鍒楋紝閫夋嫨鏈€浼樺€欓€?
    candidates.sort((a, b) => b.score - a.score);

    // 灏濊瘯鍒嗛厤鏈€浼樺伐浣滐紝閫愪釜灏濊瘯棰勭暀鐩爣璧勬簮
    let assigned = false;
    for (const candidate of candidates) {
      if (isJobBlockedByCarriedItems(pawn, candidate.job)) continue;

      if (candidate.job.targetId) {
        const resId = map.reservations.tryReserve({
          claimantId: pawn.id,
          targetId: candidate.job.targetId,
          jobId: candidate.job.id,
          currentTick: world.tick,
        });

        if (resId === null) continue; // 鐩爣宸茶棰勭暀锛屽皾璇曚笅涓€涓€欓€?

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
 * 鏀堕泦褰撳墠 Pawn 鐨勬墍鏈夊€欓€夊伐浣滐紝鎸夊洓澶х被鍒壂鎻忥細
 *   1. 绱ф€ラ渶姹傦紙楗遍搴︿綆鏃跺鎵鹃鐗╋級
 *   2. 鎸囨淳浠诲姟锛堥噰鐭裤€佹敹鍓层€佺爫浼愶級
 *   3. 钃濆浘鏉愭枡鎼繍锛堜负寤虹瓚钃濆浘杩愰€佹墍闇€鏉愭枡锛?
 *   4. 寤虹瓚宸ュ湴鏂藉伐锛堝鍑嗗濂界殑宸ュ湴鎵ц寤洪€狅級
 * 姣忎釜鍊欓€夐」鍖呭惈宸ヤ綔瀹炰緥鍜屾晥鐢ㄥ垎鏁般€?
 *
 * @param pawn   - 闇€瑕佸垎閰嶅伐浣滅殑绌洪棽 Pawn
 * @param map    - 褰撳墠鍦板浘
 * @param _world - 娓告垙涓栫晫瀹炰緥锛堟湭浣跨敤锛?
 * @returns 鍊欓€夊伐浣滃垪琛紙鍚垎鏁帮級锛岀敱璋冪敤鏂规帓搴忛€夋嫨
 */
function gatherCandidates(
  pawn: Pawn,
  map: GameMap,
  world: World,
): JobCandidate[] {
  const candidates: JobCandidate[] = [];
  const carryResolutionCandidate = createCarryResolutionCandidate(pawn, map, world);

  // 鈹€鈹€ 1. 妫€鏌ョ揣鎬ラ渶姹?鈹€鈹€
  // 楗遍搴︿綆浜?30 鏃讹紝瀵绘壘椋熺墿
  if (pawn.needs.food < pawn.needsProfile.hungerSeekThreshold) {
    const foodCandidate = findFoodJob(pawn, map, world);
    if (foodCandidate) {
      candidates.push(foodCandidate);
    }
  }

  if (pawn.needs.rest < pawn.needsProfile.sleepSeekThreshold) {
    candidates.push(...findSleepCandidates(pawn, map));
  }

  // 鈹€鈹€ 2. 妫€鏌ユ寚娲句换鍔★紙閲囩熆銆佹敹鍓层€佺爫浼愶級 鈹€鈹€
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

  // 鈹€鈹€ 3. 妫€鏌ラ渶瑕佹潗鏂欐惉杩愮殑钃濆浘 鈹€鈹€
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

    // 妫€鏌ュ摢浜涙潗鏂欎粛闇€鎼繍
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const requiredCount = bp.materialsRequired[i].count;
      const deliveredCount = bp.materialsDelivered[i]?.count ?? 0;
      const matDefId = bp.materialsRequired[i].defId;
      const inFlightCount = getBlueprintMaterialInFlightCount(map, bp.id, matDefId);
      const needed = requiredCount - deliveredCount - inFlightCount;
      if (needed <= 0) continue;

      // 瀵绘壘璺濈鏈€杩戠殑鍚岀被鍨嬬墿鍝?
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
        break; // 姣忎釜钃濆浘姣忎釜 Pawn 鍙垎閰嶄竴涓惉杩愪换鍔?
      }
    }
  }

  // 鈹€鈹€ 4. 妫€鏌ラ渶瑕佹柦宸ョ殑寤虹瓚宸ュ湴 鈹€鈹€
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite);
  for (const site of sites) {
    if (site.destroyed) continue;
    if (site.buildProgress >= 1.0) continue;
    if (map.reservations.isReserved(site.id)) continue;
    if (hasConstructionOccupants(map, site)) continue;

    const dist = estimateDistance(pawn.cell, site.cell);
    const job = createConstructJob(pawn.id, site.id, site.cell, map);

    // 鏍规嵁宸ュ湴鍓╀綑宸ヤ綔閲忔洿鏂?Work Toil 鐨?totalWork
    const workToil = job.toils.find(t => t.type === ToilType.Work);
    if (workToil) {
      workToil.localData.totalWork = site.totalWorkAmount - site.workDone;
    }

    const score = 40 - dist * 0.5;
    candidates.push({ job, score });
  }

  // 鈹€鈹€ 5. 妫€鏌ユ暎钀界墿鍝佺殑瀛樺偍鍖烘惉杩?鈹€鈹€
  const stockpileCandidate = createStockpileHaulCandidate(pawn, map, world);
  if (stockpileCandidate) {
    candidates.push(stockpileCandidate);
  }

  if (carryResolutionCandidate) {
    candidates.push(carryResolutionCandidate);
  }

  return candidates;
}

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

function isJobBlockedByCarriedItems(pawn: Pawn, job: Job): boolean {
  return pawn.inventory.carrying != null
    && job.toils.some(toil => toil.type === ToilType.PickUp);
}

function findSleepCandidates(
  pawn: Pawn,
  map: GameMap,
): JobCandidate[] {
  const candidates: JobCandidate[] = [];
  const ownedBed = getBedByOwner(map, pawn.name);
  const candidateBed = ownedBed && isBedAvailable(ownedBed)
    ? ownedBed
    : findNearestAvailableBed(pawn, map);
  const sleepUrgency = (
    pawn.needsProfile.sleepSeekThreshold - pawn.needs.rest
  ) / Math.max(1, pawn.needsProfile.sleepSeekThreshold);

  if (candidateBed) {
    const interactionCell = candidateBed.interaction?.interactionCell ?? candidateBed.cell;
    const dist = estimateDistance(pawn.cell, interactionCell);
    candidates.push({
      job: createSleepJob(
        pawn.id,
        { bedId: candidateBed.id, interactionCell },
        pawn.cell,
      ),
      score: 90 + sleepUrgency * 140 - dist * 0.5,
    });
  }

  candidates.push({
    job: createSleepJob(pawn.id, null, pawn.cell),
    score: 55 + sleepUrgency * 120,
  });

  return candidates;
}

function findNearestAvailableBed(
  pawn: Pawn,
  map: GameMap,
) {
  const beds = getAllBeds(map).filter((building) => (
    building.bed?.autoAssignable === true
    && building.bed.ownerPawnId === undefined
    && isBedAvailable(building)
    && !map.reservations.isReserved(building.id)
  ));

  let bestBed = beds[0];
  let bestDistance = Infinity;

  for (const bed of beds) {
    const interactionCell = bed.interaction?.interactionCell ?? bed.cell;
    const dist = estimateDistance(pawn.cell, interactionCell);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestBed = bed;
    }
  }

  return bestBed;
}

/**
 * 鐢熸垚鈥滄惉杩愬埌瀛樺偍鍖衡€濈殑浣庝紭鍏堢骇鍊欓€夈€?
 *
 * 瑙勫垯锛?
 * - 鍙鐞嗗甫 haulable 鏍囩鐨勭墿鍝?
 * - 宸蹭綅浜庡吋瀹瑰瓨鍌ㄥ尯鍐呯殑鐗╁搧涓嶅啀鐢熸垚鍊欓€?
 * - 浠呮妸鐗╁搧閫佸線 stockpile 鍖哄煙涓€滃綋鍓嶅彲鎺ュ彈涓旀湁瀹归噺鈥濈殑鏍煎瓙
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

/** 鍒ゆ柇鐗╁搧鏄惁宸茬粡浣嶄簬鍏煎鐨?stockpile 瀛樺偍鍖哄唴 */
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
 * 瀵绘壘鏈€杩戠殑椋熺墿骞跺垱寤鸿繘椋熷伐浣滃€欓€夐」銆?
 * 閬嶅巻鍦板浘涓婃墍鏈夊甫 "food" 鏍囩鐨勭墿鍝侊紝鎸夎窛绂婚€夋嫨鏈€杩戜笖鏈棰勭暀鐨勯鐗┿€?
 * 鍒嗘暟鐢辩揣鎬ョ▼搴﹀拰璺濈鍏卞悓鍐冲畾銆?
 *
 * @param pawn - 闇€瑕佽繘椋熺殑 Pawn
 * @param map  - 褰撳墠鍦板浘
 * @returns 杩涢宸ヤ綔鍊欓€夐」锛堝惈鍒嗘暟锛夛紝鑻ユ棤椋熺墿鍒欒繑鍥?null
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
  const missingFood = Math.max(1, pawn.needsProfile.mealTargetFood - pawn.needs.food);
  const requestedCount = Math.min(
    bestItem.stackCount,
    pawn.inventory.carryCapacity,
    Math.max(1, Math.ceil(missingFood / nutritionPerItem)),
  );
  const hungerSeekThreshold = Math.max(1, pawn.needsProfile.hungerSeekThreshold);
  const hungerUrgency = (hungerSeekThreshold - pawn.needs.food) / hungerSeekThreshold;
  if (requestedCount <= 0) return null;

  const job = createEatJob(
    pawn.id,
    bestItem.id,
    bestItem.cell,
    requestedCount,
    requestedCount * nutritionPerItem,
  );
  // 绱ф€ョ▼搴﹁秺楂樺垎鏁拌秺楂橈紙楗遍搴﹁秺浣庤秺绱ф€ワ級
  const urgency = (30 - pawn.needs.food) / 30; // 0~1锛岃秺楂樿秺绱ф€?
  const score = 100 + hungerUrgency * 200 - bestDist * 0.5;

  return { job, score };
}

/**
 * 鍒涘缓涓€涓殢鏈烘极姝ュ伐浣溿€?
 * 鍦?Pawn 鍛ㄥ洿灏忚寖鍥村唴闅忔満閫夋嫨涓€涓彲閫氳鏍煎瓙浣滀负鐩爣锛屽寘鍚崟涓?GoTo Toil銆?
 * 鏈€澶氬皾璇?10 娆″鎵炬湁鏁堢洰鏍囥€?
 *
 * @param pawn  - 闇€瑕佹极姝ョ殑 Pawn
 * @param map   - 褰撳墠鍦板浘
 * @param world - 娓告垙涓栫晫瀹炰緥锛堢敤浜庨殢鏈烘暟鐢熸垚鍣級
 * @returns 婕 Job锛岃嫢鎵句笉鍒版湁鏁堢洰鏍囧垯杩斿洖 null
 */
function createWanderJob(
  pawn: Pawn,
  map: GameMap,
  world: World,
): Job | null {
  // 鍦ㄥ崐寰?5 鏍煎唴闅忔満閫夋嫨涓€涓彲閫氳鐩爣锛屾渶澶氬皾璇?10 娆?
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
 * 灏嗗伐浣滃垎閰嶇粰 Pawn锛氳缃?AI 鐘舵€併€侀噸缃┖闂茶鏁般€佹帹閫?job_assigned 浜嬩欢銆?
 *
 * @param pawn   - 鎺ュ彈宸ヤ綔鐨?Pawn
 * @param job    - 瑕佸垎閰嶇殑宸ヤ綔
 * @param _map   - 褰撳墠鍦板浘锛堟湭浣跨敤锛?
 * @param world  - 娓告垙涓栫晫瀹炰緥
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

