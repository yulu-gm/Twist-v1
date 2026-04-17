/**
 * @file designation.commands.ts
 * @description 指派命令处理器集合——处理采集、挖矿、砍伐指派的创建与取消
 * @dependencies ObjectKind, DesignationType, WorkPriority, nextObjectId, MapId, ObjectId, CellCoord — 核心类型；
 *              CommandHandler, Command, ValidationResult, ExecutionResult — 命令总线接口；
 *              World — 世界状态；GameMap — 游戏地图；Designation — 指派类型
 * @part-of features/designation — 指派/工作指令功能
 */

import {
  ObjectKind,
  DesignationType,
  WorkPriority,
  nextObjectId,
  MapId,
  ObjectId,
  CellCoord,
} from '../../core/types';
import {
  CommandHandler,
  Command,
  ValidationResult,
  ExecutionResult,
} from '../../core/command-bus';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { Designation } from './designation.types';

// ── 辅助函数 ──

/**
 * 解析命令中的地图引用
 * @param world - 世界状态
 * @param cmd - 命令对象
 * @returns 对应的 GameMap 实例；若未指定 mapId 则返回第一个地图
 */
function resolveMap(world: World, cmd: Command): GameMap | undefined {
  const mapId = cmd.payload.mapId as string | undefined;
  if (mapId) return world.maps.get(mapId);
  // 默认取第一个地图
  return world.maps.values().next().value as GameMap | undefined;
}

/**
 * 解析命令中的地图ID
 * @param world - 世界状态
 * @param cmd - 命令对象
 * @returns 地图ID字符串；若未指定则返回第一个地图的ID
 */
function resolveMapId(world: World, cmd: Command): string {
  const mapId = cmd.payload.mapId as string | undefined;
  if (mapId) return mapId;
  return world.maps.keys().next().value as string;
}

/**
 * 创建一个新的指派对象
 * @param mapId - 所在地图ID
 * @param designationType - 指派类型（采集/挖矿/砍伐）
 * @param priority - 工作优先级
 * @param targetObjectId - 目标对象ID（可选）
 * @param targetCell - 目标格子坐标（可选）
 * @returns 新创建的 Designation 对象
 */
function createDesignation(
  mapId: MapId,
  designationType: DesignationType,
  priority: WorkPriority,
  targetObjectId?: ObjectId,
  targetCell?: CellCoord,
): Designation {
  return {
    id: nextObjectId(),
    kind: ObjectKind.Designation,
    defId: `designation_${designationType}`,
    mapId,
    cell: targetCell ?? { x: 0, y: 0 },
    tags: new Set(['designation']),
    destroyed: false,
    designationType,
    targetObjectId,
    targetCell,
    priority,
  };
}

// ── designate_harvest（采集指派） ──

/**
 * 采集指派命令处理器
 * 验证：检查地图存在性、目标对象存在性、目标必须为植物类型
 * 执行：创建采集类型指派并添加到地图对象池，发出 designation_created 事件
 */
export const designateHarvestHandler: CommandHandler = {
  type: 'designate_harvest',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    // 同时接受 targetObjectId 和 targetId 两种字段名
    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    if (!targetObjectId) return { valid: false, reason: 'No target specified' };

    const target = map.objects.get(targetObjectId);
    if (!target) return { valid: false, reason: `Target object ${targetObjectId} not found` };
    if (target.kind !== ObjectKind.Plant) {
      return { valid: false, reason: `Target ${targetObjectId} is not a plant` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const mapId = resolveMapId(w, cmd);
    const map = resolveMap(w, cmd)!;

    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    const priority = (cmd.payload.priority as WorkPriority) ?? WorkPriority.Normal;
    const target = map.objects.get(targetObjectId)!;

    const designation = createDesignation(
      mapId,
      DesignationType.Harvest,
      priority,
      targetObjectId,
      target.cell,
    );
    map.objects.add(designation);

    return {
      events: [{
        type: 'designation_created',
        tick: w.tick,
        data: { designationId: designation.id, designationType: DesignationType.Harvest, targetObjectId },
      }],
    };
  },
};

// ── designate_mine（挖矿指派） ──

/**
 * 挖矿指派命令处理器
 * 验证：检查地图存在性、目标格子边界、目标地形是否可挖掘
 * 执行：创建挖矿类型指派并添加到地图对象池，发出 designation_created 事件
 */
export const designateMineHandler: CommandHandler = {
  type: 'designate_mine',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    // 同时接受 targetCell 和 cell 两种字段名
    const targetCell = (cmd.payload.targetCell ?? cmd.payload.cell) as CellCoord;
    if (!targetCell) return { valid: false, reason: 'No target cell specified' };

    if (
      targetCell.x < 0 || targetCell.x >= map.width ||
      targetCell.y < 0 || targetCell.y >= map.height
    ) {
      return { valid: false, reason: `Cell (${targetCell.x},${targetCell.y}) out of bounds` };
    }

    // 检查地形是否可挖掘
    const terrainDefId = map.terrain.get(targetCell.x, targetCell.y);
    const terrainDef = w.defs.terrains.get(terrainDefId);
    if (!terrainDef?.mineable) {
      return { valid: false, reason: `Terrain ${terrainDefId} at (${targetCell.x},${targetCell.y}) is not mineable` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const mapId = resolveMapId(w, cmd);
    const map = resolveMap(w, cmd)!;

    const targetCell = (cmd.payload.targetCell ?? cmd.payload.cell) as CellCoord;
    const priority = (cmd.payload.priority as WorkPriority) ?? WorkPriority.Normal;

    const designation = createDesignation(
      mapId,
      DesignationType.Mine,
      priority,
      undefined,
      targetCell,
    );
    designation.cell = { x: targetCell.x, y: targetCell.y };
    map.objects.add(designation);

    return {
      events: [{
        type: 'designation_created',
        tick: w.tick,
        data: { designationId: designation.id, designationType: DesignationType.Mine, targetCell },
      }],
    };
  },
};

// ── designate_cut（砍伐指派） ──

/**
 * 砍伐指派命令处理器
 * 验证：检查地图存在性、目标对象存在性、目标必须为植物类型
 * 执行：创建砍伐类型指派并添加到地图对象池，发出 designation_created 事件
 */
export const designateCutHandler: CommandHandler = {
  type: 'designate_cut',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    if (!targetObjectId) return { valid: false, reason: 'No target specified' };

    const target = map.objects.get(targetObjectId);
    if (!target) return { valid: false, reason: `Target object ${targetObjectId} not found` };
    if (target.kind !== ObjectKind.Plant) {
      return { valid: false, reason: `Target ${targetObjectId} is not a plant (cuttable)` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const mapId = resolveMapId(w, cmd);
    const map = resolveMap(w, cmd)!;

    const targetObjectId = (cmd.payload.targetObjectId ?? cmd.payload.targetId) as ObjectId;
    const priority = (cmd.payload.priority as WorkPriority) ?? WorkPriority.Normal;
    const target = map.objects.get(targetObjectId)!;

    const designation = createDesignation(
      mapId,
      DesignationType.Cut,
      priority,
      targetObjectId,
      target.cell,
    );
    map.objects.add(designation);

    return {
      events: [{
        type: 'designation_created',
        tick: w.tick,
        data: { designationId: designation.id, designationType: DesignationType.Cut, targetObjectId },
      }],
    };
  },
};

// ── cancel_designation（取消指派） ──

/**
 * 取消指派命令处理器
 * 验证：检查地图存在性、指派对象存在性、对象类型必须为 Designation
 * 执行：标记指派为已销毁并从对象池移除，发出 designation_cancelled 事件
 */
export const cancelDesignationHandler: CommandHandler = {
  type: 'cancel_designation',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = resolveMap(w, cmd);
    if (!map) return { valid: false, reason: 'Map not found' };

    const designationId = (cmd.payload.designationId ?? cmd.payload.targetId) as ObjectId;
    if (!designationId) return { valid: false, reason: 'No designation specified' };

    const obj = map.objects.get(designationId);
    if (!obj) return { valid: false, reason: `Designation ${designationId} not found` };
    if (obj.kind !== ObjectKind.Designation) {
      return { valid: false, reason: `Object ${designationId} is not a designation` };
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = resolveMap(w, cmd)!;

    const designationId = (cmd.payload.designationId ?? cmd.payload.targetId) as ObjectId;
    const designation = map.objects.get(designationId)!;
    designation.destroyed = true;
    map.objects.remove(designationId);

    return {
      events: [{
        type: 'designation_cancelled',
        tick: w.tick,
        data: { designationId },
      }],
    };
  },
};

/** 所有指派命令处理器数组，用于批量注册到命令总线 */
export const designationCommandHandlers: CommandHandler[] = [
  designateHarvestHandler,
  designateMineHandler,
  designateCutHandler,
  cancelDesignationHandler,
];

// ── 工作订单 → 指派 适配器 ──

/**
 * 由工作订单 item 派生指派对象的辅助函数（Task 4 将使用）
 *
 * 当前仅作为导出工具函数存在 — 输入层只下发 create_map_work_order，
 * AI evaluator/订单维护系统在 Task 4 接管后才会调用本函数把 item 物化为 Designation。
 *
 * @param mapId - 所在地图 ID
 * @param designationType - 指派类型
 * @param priority - 工作优先级
 * @param workOrderId - 派生该指派的工作订单 ID
 * @param workOrderItemId - 派生该指派的订单 item ID
 * @param targetObjectId - 目标对象 ID（可选）
 * @param targetCell - 目标格子（可选）
 * @returns 携带 workOrderId/workOrderItemId 溯源字段的 Designation
 */
export function createDesignationFromOrderItem(
  mapId: MapId,
  designationType: DesignationType,
  priority: WorkPriority,
  workOrderId: string,
  workOrderItemId: string,
  targetObjectId?: ObjectId,
  targetCell?: CellCoord,
): Designation {
  const designation = createDesignation(mapId, designationType, priority, targetObjectId, targetCell);
  designation.workOrderId = workOrderId;
  designation.workOrderItemId = workOrderItemId;
  return designation;
}
