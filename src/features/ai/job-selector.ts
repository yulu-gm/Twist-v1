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
  ObjectKind, TickPhase, DesignationType, CellCoord, ToilType, ToilState, JobState,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { estimateDistance } from '../pathfinding/path.service';
import { Job, JobCandidate } from './ai.types';
import { Blueprint } from '../construction/blueprint.types';
import { ConstructionSite } from '../construction/construction-site.types';
import { createMineJob } from './jobs/mine-job';
import { createHarvestJob } from './jobs/harvest-job';
import { createConstructJob } from './jobs/construct-job';
import { createHaulJob } from './jobs/haul-job';
import { createEatJob } from './jobs/eat-job';

/**
 * 工作选择系统使用的 Pawn 鸭子类型接口。
 */
interface SelectablePawn {
  /** Pawn 唯一标识符 */
  id: string;
  /** 对象种类 */
  kind: ObjectKind;
  /** 当前所在格子坐标 */
  cell: { x: number; y: number };

  // ── AI 状态 ──
  ai: {
    /** 当前工作（null 表示空闲） */
    currentJob: Job | null;
    /** 当前 Toil 索引 */
    currentToilIndex: number;
    /** Toil 临时状态 */
    toilState: Record<string, unknown>;
    /** 空闲 Tick 计数 */
    idleTicks: number;
  };

  // ── 移动状态 ──
  movement: {
    path: { x: number; y: number }[];
    pathIndex: number;
    moveProgress: number;
    speed: number;
  };

  // ── 背包 ──
  inventory: {
    carrying: string | null;
    carryCapacity: number;
  };

  // ── 需求 ──
  needs: {
    /** 饱食度（0~100） */
    food: number;
    /** 疲劳度（0~100） */
    rest: number;
  };
}

/**
 * 指派对象的鸭子类型接口（采矿、收割、砍伐等）。
 */
interface DesignationObj {
  /** 指派唯一标识符 */
  id: string;
  /** 对象种类 */
  kind: ObjectKind;
  /** 指派所在格子坐标 */
  cell: { x: number; y: number };
  /** 是否已被销毁 */
  destroyed: boolean;
  /** 指派类型（mine/harvest/cut） */
  designationType: string;
  /** 目标对象 ID（如植物 ID） */
  targetObjectId?: string;
  /** 目标格子坐标 */
  targetCell?: CellCoord;
  /** 优先级 */
  priority?: number;
}

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
  const pawns = map.objects.allOfKind(ObjectKind.Pawn) as unknown as SelectablePawn[];

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
  pawn: SelectablePawn,
  map: GameMap,
  _world: World,
): JobCandidate[] {
  const candidates: JobCandidate[] = [];

  // ── 1. 检查紧急需求 ──
  // 饱食度低于 30 时，寻找食物
  if (pawn.needs.food < 30) {
    const foodCandidate = findFoodJob(pawn, map);
    if (foodCandidate) {
      candidates.push(foodCandidate);
    }
  }

  // ── 2. 检查指派任务（采矿、收割、砍伐） ──
  const designations = map.objects.allOfKind(ObjectKind.Designation) as unknown as DesignationObj[];
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
        job = createHarvestJob(pawn.id, desig.id, targetCell);
        baseScore = 50;
        break;
    }

    if (job) {
      const score = baseScore + priorityBonus - dist * 0.5;
      candidates.push({ job, score });
    }
  }

  // ── 3. 检查需要材料搬运的蓝图 ──
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint) as unknown as Blueprint[];
  for (const bp of blueprints) {
    if (bp.destroyed) continue;

    // 检查哪些材料仍需搬运
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const needed = bp.materialsRequired[i].count - (bp.materialsDelivered[i]?.count ?? 0);
      if (needed <= 0) continue;

      const matDefId = bp.materialsRequired[i].defId;

      // 寻找距离最近的同类型物品
      const items = map.objects.allOfKind(ObjectKind.Item);
      let bestItem: any = null;
      let bestItemDist = Infinity;

      for (const item of items) {
        if (item.destroyed) continue;
        if (item.defId !== matDefId) continue;
        if (map.reservations.isReserved(item.id)) continue;

        const d = estimateDistance(pawn.cell, item.cell);
        if (d < bestItemDist) {
          bestItemDist = d;
          bestItem = item;
        }
      }

      if (bestItem) {
        const job = createHaulJob(pawn.id, bestItem.id, bestItem.cell, bp.cell, bp.id);
        const score = 45 - bestItemDist * 0.5;
        candidates.push({ job, score });
        break; // 每个蓝图每个 Pawn 只分配一个搬运任务
      }
    }
  }

  // ── 4. 检查需要施工的建筑工地 ──
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite) as unknown as ConstructionSite[];
  for (const site of sites) {
    if (site.destroyed) continue;
    if (site.buildProgress >= 1.0) continue;
    if (map.reservations.isReserved(site.id)) continue;

    const dist = estimateDistance(pawn.cell, site.cell);
    const job = createConstructJob(pawn.id, site.id, site.cell);

    // 根据工地剩余工作量更新 Work Toil 的 totalWork
    const workToil = job.toils.find(t => t.type === ToilType.Work);
    if (workToil) {
      workToil.localData.totalWork = site.totalWorkAmount - site.workDone;
    }

    const score = 40 - dist * 0.5;
    candidates.push({ job, score });
  }

  return candidates;
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
function findFoodJob(
  pawn: SelectablePawn,
  map: GameMap,
): JobCandidate | null {
  const items = map.objects.allWithTag('food');
  let bestItem: any = null;
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

  const job = createEatJob(pawn.id, bestItem.id, bestItem.cell);
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
  pawn: SelectablePawn,
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
  pawn: SelectablePawn,
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
