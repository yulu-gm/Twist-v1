/**
 * @file toil-executor.ts
 * @description Toil 执行器系统 —— 负责在每个 Tick 执行 Pawn 当前工作（Job）中的劳作步骤（Toil）。
 *              支持 GoTo（移动）、PickUp（拾取）、Drop（放置）、Work（工作）、Wait（等待）、
 *              Deliver（交付）、Interact（交互）七种 Toil 类型。
 *              还处理中途中断（饱食度过低、目标被毁）和工作完成后的状态清理。
 * @dependencies core/types — 基础类型与枚举；core/tick-runner — 系统注册；core/logger — 日志；
 *               world — World/GameMap；pathfinding — 寻路服务；cleanup — 清理协议；
 *               ai.types — Job/Toil 接口；construction — 建筑工地类型
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectKind, TickPhase, ToilType, ToilState, JobState, cellEquals, ObjectId, nextObjectId,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { findPath } from '../pathfinding/path.service';
import { cleanupProtocol } from './cleanup';
import { Job, Toil } from './ai.types';
import { ConstructionSite } from '../construction/construction-site.types';

/**
 * Toil 执行器使用的 Pawn 鸭子类型接口。
 * 使用结构化接口而非具体 Pawn 类型，以解耦模块依赖。
 */
interface ExecutablePawn {
  /** Pawn 唯一标识符 */
  id: ObjectId;
  /** 对象种类（Pawn） */
  kind: ObjectKind;
  /** 当前所在格子坐标 */
  cell: { x: number; y: number };

  // ── AI 状态 ──
  ai: {
    /** 当前正在执行的工作（为 null 表示空闲） */
    currentJob: Job | null;
    /** 当前 Toil 步骤索引 */
    currentToilIndex: number;
    /** Toil 执行的临时状态数据 */
    toilState: Record<string, unknown>;
    /** 空闲 Tick 计数 */
    idleTicks: number;
  };

  // ── 移动状态 ──
  movement: {
    /** 当前路径点序列 */
    path: { x: number; y: number }[];
    /** 路径中当前步进索引 */
    pathIndex: number;
    /** 移动进度（0~1 之间，表示格子间的插值） */
    moveProgress: number;
    /** 移动速度 */
    speed: number;
    /** 上一次移动前所在的格子 */
    prevCell: { x: number; y: number } | null;
  };

  // ── 背包 ──
  inventory: {
    /** 当前携带的物品 ID（null 表示未携带） */
    carrying: ObjectId | null;
    /** 最大负重容量 */
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
 * Toil 执行器系统注册。
 * 在 EXECUTION 阶段运行，每 Tick 处理所有地图上的 Pawn 工作步骤。
 */
export const toilExecutorSystem: SystemRegistration = {
  id: 'toilExecutor',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(world, map);
    }
  },
};

/**
 * 处理单个地图上所有 Pawn 的 Toil 执行逻辑。
 * 遍历所有 Pawn，对有工作的 Pawn 执行当前 Toil，并处理中断条件。
 *
 * @param world - 游戏世界实例
 * @param map   - 当前处理的地图
 */
function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn) as unknown as ExecutablePawn[];

  for (const pawn of pawns) {
    const job = pawn.ai.currentJob;
    if (!job) continue;
    if (job.state === JobState.Done || job.state === JobState.Failed) continue;

    // ── 中途中断检测 ──
    // 紧急需求：饱食度低于 10 时中断当前非进食工作
    if (pawn.needs.food < 10 && job.defId !== 'job_eat') {
      log.info('ai', `Pawn ${pawn.id} interrupted (food critical: ${Math.floor(pawn.needs.food)})`, undefined, pawn.id);
      cleanupProtocol(pawn as any, map, world);
      continue;
    }

    // 目标被摧毁检测
    if (job.targetId) {
      const target = map.objects.get(job.targetId);
      if (target && target.destroyed) {
        log.info('ai', `Pawn ${pawn.id} interrupted (target ${job.targetId} destroyed)`, undefined, pawn.id);
        cleanupProtocol(pawn as any, map, world);
        continue;
      }
    }

    // 将工作标记为活跃状态
    if (job.state === JobState.Starting) {
      job.state = JobState.Active;
    }

    const toilIndex = job.currentToilIndex;
    if (toilIndex >= job.toils.length) {
      // 所有 Toil 步骤已完成
      completeJob(pawn, map, world);
      continue;
    }

    const toil = job.toils[toilIndex];

    if (toil.state === ToilState.NotStarted) {
      toil.state = ToilState.InProgress;
    }

    if (toil.state === ToilState.Completed) {
      advanceToil(pawn, job, world);
      continue;
    }

    if (toil.state === ToilState.Failed) {
      log.warn('ai', `Toil failed for pawn ${pawn.id}, triggering cleanup`, undefined, pawn.id);
      cleanupProtocol(pawn as any, map, world);
      continue;
    }

    // 执行当前 Toil
    executeToil(pawn, toil, job, map, world);
  }
}

/**
 * Toil 分发器：根据 Toil 类型调用对应的执行函数。
 *
 * @param pawn  - 执行工作的 Pawn
 * @param toil  - 当前要执行的 Toil 步骤
 * @param job   - 所属的工作
 * @param map   - 当前地图
 * @param world - 游戏世界实例
 */
function executeToil(
  pawn: ExecutablePawn,
  toil: Toil,
  job: Job,
  map: GameMap,
  world: World,
): void {
  switch (toil.type) {
    case ToilType.GoTo:
      executeGoTo(pawn, toil, map, world);
      break;
    case ToilType.PickUp:
      executePickUp(pawn, toil, map, world);
      break;
    case ToilType.Drop:
      executeDrop(pawn, toil, map, world);
      break;
    case ToilType.Work:
      executeWork(pawn, toil, job, map, world);
      break;
    case ToilType.Wait:
      executeWait(pawn, toil);
      break;
    case ToilType.Deliver:
      executeDeliver(pawn, toil, map, world);
      break;
    case ToilType.Interact:
      executeInteract(pawn, toil, map, world);
      break;
    default:
      log.warn('ai', `Unknown toil type: ${toil.type}`, undefined, pawn.id);
      toil.state = ToilState.Failed;
      break;
  }
}

/**
 * 执行移动（GoTo）Toil：寻路并移动 Pawn 到目标格子。
 * 若已到达则标记完成；若无路径则寻路；移动由独立的移动系统处理。
 *
 * @param pawn  - 要移动的 Pawn
 * @param toil  - GoTo 类型的 Toil（包含 targetCell）
 * @param map   - 当前地图
 * @param world - 游戏世界实例
 */
function executeGoTo(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  world: World,
): void {
  const target = toil.targetCell;
  if (!target) {
    log.warn('ai', `GoTo toil has no targetCell for pawn ${pawn.id}`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 检查是否已到达目标
  if (cellEquals(pawn.cell, target)) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} arrived at (${target.x},${target.y})`, undefined, pawn.id);
    return;
  }

  // 若尚未设置路径，进行寻路
  if (!pawn.movement.path || pawn.movement.path.length === 0) {
    const result = findPath(map, pawn.cell, target);
    if (!result.found) {
      log.warn('ai', `Pawn ${pawn.id} cannot find path to (${target.x},${target.y})`, undefined, pawn.id);
      toil.state = ToilState.Failed;
      return;
    }
    pawn.movement.path = result.path;
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
    log.debug('ai', `Pawn ${pawn.id} pathing to (${target.x},${target.y}), ${result.path.length} steps`, undefined, pawn.id);
  }

  // 移动系统负责实际的格子移动，这里只检查是否已到达
  if (cellEquals(pawn.cell, target)) {
    toil.state = ToilState.Completed;
    pawn.movement.path = [];
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
  }
}

/**
 * 执行拾取（PickUp）Toil：Pawn 拾取目标物品并从地图移除该物品。
 * 同时将物品信息传播到后续的 Drop/Deliver 步骤。
 *
 * @param pawn   - 执行拾取的 Pawn
 * @param toil   - PickUp 类型的 Toil（包含 targetId）
 * @param map    - 当前地图
 * @param _world - 游戏世界实例（未使用）
 */
function executePickUp(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  _world: World,
): void {
  const targetId = toil.targetId;
  if (!targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const item = map.objects.get(targetId) as any;
  if (!item || item.destroyed) {
    log.warn('ai', `Pawn ${pawn.id} PickUp target ${targetId} not found`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 检查 Pawn 是否在物品所在位置
  if (!cellEquals(pawn.cell, item.cell)) {
    log.warn('ai', `Pawn ${pawn.id} not at item ${targetId} location for pickup`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 暂存物品信息，供后续 Drop/Deliver 步骤使用
  toil.localData.pickedDefId = item.defId;
  toil.localData.pickedCount = item.stackCount ?? 1;

  // 拾取：将物品 ID 存入背包，从地图对象池移除该物品
  pawn.inventory.carrying = targetId;
  map.objects.remove(targetId);

  // 将物品信息传播到后续的 Drop/Deliver 类型 Toil
  const job = pawn.ai.currentJob;
  if (job) {
    for (let i = job.currentToilIndex + 1; i < job.toils.length; i++) {
      const nextToil = job.toils[i];
      if (nextToil.type === ToilType.Drop || nextToil.type === ToilType.Deliver) {
        nextToil.localData.defId = item.defId;
        nextToil.localData.count = item.stackCount ?? 1;
      }
    }
  }

  log.debug('ai', `Pawn ${pawn.id} picked up ${item.defId} (${targetId})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
}

/**
 * 执行放置（Drop）Toil：Pawn 将携带的物品放置在当前格子上。
 * 从 localData 中读取物品定义和数量，在地图上重新创建物品对象。
 *
 * @param pawn   - 执行放置的 Pawn
 * @param toil   - Drop 类型的 Toil（包含物品信息的 localData）
 * @param map    - 当前地图
 * @param _world - 游戏世界实例（未使用）
 */
function executeDrop(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  _world: World,
): void {
  if (!pawn.inventory.carrying) {
    log.warn('ai', `Pawn ${pawn.id} has nothing to drop`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const carriedId = pawn.inventory.carrying;

  // 在 Pawn 当前位置重新创建物品（物品在拾取时已从对象池移除）
  // 从 localData 中获取物品定义 ID 和数量（由 PickUp 步骤填充）
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  const item = {
    id: nextObjectId(),
    kind: ObjectKind.Item,
    defId,
    mapId: map.id,
    cell: { x: pawn.cell.x, y: pawn.cell.y },
    tags: new Set(['haulable', 'resource']),
    destroyed: false,
    stackCount: count,
    maxStack: 100,
  };

  map.objects.add(item as any);
  pawn.inventory.carrying = null;

  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${count} at (${pawn.cell.x},${pawn.cell.y})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
}

/**
 * 执行工作（Work）Toil：每 Tick 增加工作进度，完成后处理工作结果。
 * 支持建筑工地进度更新、采矿（改变地形并产出石材）、收割（销毁植物并产出资源）。
 *
 * @param pawn  - 执行工作的 Pawn
 * @param toil  - Work 类型的 Toil（localData 中含 workDone/totalWork）
 * @param job   - 所属的工作
 * @param map   - 当前地图
 * @param world - 游戏世界实例
 */
function executeWork(
  pawn: ExecutablePawn,
  toil: Toil,
  job: Job,
  map: GameMap,
  world: World,
): void {
  const ld = toil.localData;
  const workDone = (ld.workDone as number) ?? 0;
  const totalWork = (ld.totalWork as number) ?? 100;

  ld.workDone = workDone + 1;

  // 如果正在建造建筑工地，更新工地的施工进度
  if (toil.targetId) {
    const target = map.objects.get(toil.targetId) as any;
    if (target && target.kind === ObjectKind.ConstructionSite) {
      const site = target as ConstructionSite;
      site.workDone += 1;
      site.buildProgress = site.workDone / site.totalWorkAmount;
    }
  }

  if ((ld.workDone as number) >= totalWork) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished work toil (${totalWork} work)`, undefined, pawn.id);

    if (toil.targetId) {
      const target = map.objects.get(toil.targetId);
      if (target) {
        // 指派相关工作完成：销毁指派对象
        if (target.kind === ObjectKind.Designation) {
          const desig = target as any;

          // 采矿指派：将地形改为泥土地板，并产出石材
          if (desig.designationType === 'mine' && desig.targetCell) {
            const tc = desig.targetCell;
            const terrainDefId = map.terrain.get(tc.x, tc.y);
            const terrainDef = world.defs.terrains.get(terrainDefId);
            if (terrainDef?.mineable) {
              // 将地形变为泥土地板，并标记为可通行
              map.terrain.set(tc.x, tc.y, 'dirt');
              map.pathGrid.setPassable(tc.x, tc.y, true);

              // 产出采矿掉落物
              if (terrainDef.mineYield) {
                const yieldItem = {
                  id: nextObjectId(),
                  kind: ObjectKind.Item,
                  defId: terrainDef.mineYield.defId,
                  mapId: map.id,
                  cell: { x: tc.x, y: tc.y },
                  tags: new Set(['haulable', 'resource']),
                  destroyed: false,
                  stackCount: terrainDef.mineYield.count,
                  maxStack: 100,
                };
                map.objects.add(yieldItem as any);
              }
            }
          }

          // 收割/砍伐指派：销毁植物并产出收获物
          if ((desig.designationType === 'harvest' || desig.designationType === 'cut') && desig.targetObjectId) {
            const plant = map.objects.get(desig.targetObjectId);
            if (plant && plant.kind === ObjectKind.Plant) {
              const plantDef = world.defs.plants.get(plant.defId);
              if (plantDef?.harvestYield) {
                const yieldItem = {
                  id: nextObjectId(),
                  kind: ObjectKind.Item,
                  defId: plantDef.harvestYield.defId,
                  mapId: map.id,
                  cell: { x: plant.cell.x, y: plant.cell.y },
                  tags: new Set(['haulable', 'resource']),
                  destroyed: false,
                  stackCount: plantDef.harvestYield.count,
                  maxStack: 100,
                };
                map.objects.add(yieldItem as any);
              }
              plant.destroyed = true;
            }
          }

          target.destroyed = true;
          map.objects.remove(toil.targetId);
          world.eventBuffer.push({
            type: 'designation_completed',
            tick: world.tick,
            data: { designationId: toil.targetId, pawnId: pawn.id },
          });
        }
      }
    }
  }
}

/**
 * 执行等待（Wait）Toil：每 Tick 递增等待计数器，到达指定 Tick 数后完成。
 * 若 localData 中标记了 eating=true，完成时恢复 Pawn 的饱食度。
 *
 * @param pawn - 等待中的 Pawn
 * @param toil - Wait 类型的 Toil（localData 中含 waited/waitTicks/eating/nutritionValue）
 */
function executeWait(
  pawn: ExecutablePawn,
  toil: Toil,
): void {
  const ld = toil.localData;
  const waited = (ld.waited as number) ?? 0;
  const waitTicks = (ld.waitTicks as number) ?? 60;

  ld.waited = waited + 1;

  if ((ld.waited as number) >= waitTicks) {
    // 若此等待是进食的一部分，恢复饱食度
    if (ld.eating) {
      pawn.needs.food = Math.min(100, pawn.needs.food + (ld.nutritionValue as number ?? 30));
      log.debug('ai', `Pawn ${pawn.id} finished eating, food: ${Math.floor(pawn.needs.food)}`, undefined, pawn.id);
    }
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished waiting (${waitTicks} ticks)`, undefined, pawn.id);
  }
}

/**
 * 执行交付（Deliver）Toil：移动到目标位置后投放携带物品。
 * 分两阶段：1) 移动到目标格子；2) 将物品交付给蓝图或放置在地面。
 * 若交付给蓝图，会更新蓝图的已交付材料计数。
 *
 * @param pawn  - 执行交付的 Pawn
 * @param toil  - Deliver 类型的 Toil（包含 targetCell 和可选 targetId）
 * @param map   - 当前地图
 * @param world - 游戏世界实例
 */
function executeDeliver(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  world: World,
): void {
  const target = toil.targetCell;
  if (!target) {
    toil.state = ToilState.Failed;
    return;
  }

  // 阶段1：移动到目标位置
  if (!cellEquals(pawn.cell, target)) {
    if (!pawn.movement.path || pawn.movement.path.length === 0) {
      const result = findPath(map, pawn.cell, target);
      if (!result.found) {
        toil.state = ToilState.Failed;
        return;
      }
      pawn.movement.path = result.path;
      pawn.movement.pathIndex = 0;
      pawn.movement.moveProgress = 0;
    }
    return; // 等待移动系统将 Pawn 移动到目标位置
  }

  // 阶段2：在目标位置投放物品
  if (!pawn.inventory.carrying) {
    toil.state = ToilState.Completed;
    return;
  }

  const carriedId = pawn.inventory.carrying;
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  // 若交付给蓝图，更新蓝图的已交付材料
  if (toil.targetId) {
    const blueprint = map.objects.get(toil.targetId) as any;
    if (blueprint && blueprint.kind === ObjectKind.Blueprint && blueprint.materialsDelivered) {
      for (const mat of blueprint.materialsDelivered) {
        if (mat.defId === defId) {
          mat.count += count;
          break;
        }
      }
    }
  } else {
    // 没有蓝图目标，直接放置到地面
    const item = {
      id: nextObjectId(),
      kind: ObjectKind.Item,
      defId,
      mapId: map.id,
      cell: { x: pawn.cell.x, y: pawn.cell.y },
      tags: new Set(['haulable', 'resource']),
      destroyed: false,
      stackCount: count,
      maxStack: 100,
    };
    map.objects.add(item as any);
  }

  pawn.inventory.carrying = null;
  toil.state = ToilState.Completed;
  log.debug('ai', `Pawn ${pawn.id} delivered ${defId} x${count}`, undefined, pawn.id);
}

/**
 * 执行交互（Interact）Toil：与建筑（工作台、床铺等）进行交互。
 * Pawn 必须在交互格子上，每 Tick 递增交互计数器，到达指定次数后完成。
 *
 * @param pawn   - 执行交互的 Pawn
 * @param toil   - Interact 类型的 Toil（包含 targetId 和交互次数）
 * @param map    - 当前地图
 * @param _world - 游戏世界实例（未使用）
 */
function executeInteract(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  _world: World,
): void {
  if (!toil.targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const building = map.objects.get(toil.targetId) as any;
  if (!building || building.destroyed) {
    toil.state = ToilState.Failed;
    return;
  }

  // 检查 Pawn 是否在建筑的交互格子上
  const interactionCell = building.interaction?.interactionCell ?? building.cell;
  if (!cellEquals(pawn.cell, interactionCell)) {
    toil.state = ToilState.Failed;
    return;
  }

  const ld = toil.localData;
  const interacted = (ld.interacted as number) ?? 0;
  const interactTicks = (ld.interactTicks as number) ?? 30;

  ld.interacted = interacted + 1;

  if ((ld.interacted as number) >= interactTicks) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished interacting with ${building.defId}`, undefined, pawn.id);
  }
}

/**
 * 推进到下一个 Toil 步骤。若所有步骤已完成则完成整个工作。
 *
 * @param pawn  - 当前 Pawn
 * @param job   - 当前工作
 * @param world - 游戏世界实例
 */
function advanceToil(pawn: ExecutablePawn, job: Job, world: World): void {
  job.currentToilIndex++;
  pawn.ai.currentToilIndex = job.currentToilIndex;

  if (job.currentToilIndex >= job.toils.length) {
    completeJob(pawn, null, world);
  }
}

/**
 * 完成工作：标记工作为完成状态，释放所有预留，重置 Pawn 的 AI 和移动状态。
 * 同时推送 job_completed 事件。
 *
 * @param pawn  - 完成工作的 Pawn
 * @param map   - 当前地图（可为 null）
 * @param world - 游戏世界实例
 */
function completeJob(pawn: ExecutablePawn, map: GameMap | null, world: World): void {
  const job = pawn.ai.currentJob;
  if (!job) return;

  job.state = JobState.Done;

  // 释放此工作持有的所有资源预留
  if (map) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
  }

  log.info('ai', `Pawn ${pawn.id} completed job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_completed',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });

  // 重置 Pawn 的 AI 状态和移动状态
  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;
}
