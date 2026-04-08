/**
 * @file inspector.ts
 * @description 调试检查器 - 提供运行时查询游戏世界状态的调试接口。
 *              支持按 ID 查看对象、按坐标查看格子内容、查看预约状态、
 *              查看 Pawn 当前任务、查看 AI 日志等功能。
 * @dependencies types.ts (ObjectId, CellCoord, ObjectKind), logger.ts (log)
 * @part-of 核心引擎层 (core)
 */

import { ObjectId, CellCoord, ObjectKind } from './types';
import { log } from './logger';

/**
 * Inspector — debug query interface for examining world state.
 */
/** 调试检查器 - 用于在运行时查询和审视游戏世界的各种状态 */
export class Inspector {
  /** 当前关联的游戏世界实例 */
  private world: any;

  /**
   * 设置要检查的世界实例
   * @param world - 游戏世界对象
   */
  setWorld(world: any): void {
    this.world = world;
  }

  /**
   * 按 ID 查找对象，遍历所有地图搜索
   * @param id - 对象 ID
   * @returns 找到的对象，未找到返回 undefined
   */
  inspectObject(id: ObjectId): any | undefined {
    if (!this.world) return undefined;
    for (const [, map] of this.world.maps) {
      const obj = map.objects.get(id);
      if (obj) return obj;
    }
    return undefined;
  }

  /**
   * 查看指定地图上某个格子坐标中的所有对象
   * @param mapId - 地图 ID
   * @param cell - 格子坐标
   * @returns 该格子中的所有对象数组
   */
  inspectCell(mapId: string, cell: CellCoord): any[] {
    if (!this.world) return [];
    const map = this.world.maps.get(mapId);
    if (!map) return [];
    const ids = map.spatial.getAt(cell);
    return ids.map((id: ObjectId) => map.objects.get(id)).filter(Boolean);
  }

  /**
   * 查看指定地图上的所有预约信息
   * @param mapId - 地图 ID
   * @returns 所有预约的数组
   */
  inspectReservations(mapId: string): any[] {
    if (!this.world) return [];
    const map = this.world.maps.get(mapId);
    if (!map) return [];
    return map.reservations.getAll();
  }

  /**
   * 查看 Pawn 当前正在执行的任务
   * @param pawnId - Pawn 的对象 ID
   * @returns 当前任务信息，非 Pawn 或无任务时返回 null
   */
  inspectPawnJob(pawnId: ObjectId): any | null {
    const obj = this.inspectObject(pawnId);
    if (!obj || obj.kind !== ObjectKind.Pawn) return null;
    return (obj as any).ai?.currentJob ?? null;
  }

  /**
   * 查看指定 Pawn 的 AI 决策日志
   * @param pawnId - Pawn 的对象 ID
   * @param count - 返回最近的条目数量
   * @returns AI 频道的日志条目数组
   */
  inspectAILog(pawnId: ObjectId, count: number): any[] {
    return log.getEntries({ channel: 'ai', objectId: pawnId, count });
  }
}

/** 全局单例检查器 */
export const inspector = new Inspector();
