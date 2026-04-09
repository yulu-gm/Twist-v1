/**
 * @file reservation-table.ts
 * @description 预订记录（Reservation）接口与预订表（ReservationTable），
 *              管理角色对地图对象的独占性预订，防止多个角色同时操作同一目标
 * @dependencies core/types — ObjectId, CellCoord
 * @part-of world 模块——游戏世界数据层
 */

import { ObjectId, CellCoord } from '../core/types';

/** 预订记录：角色对地图对象的独占性预订 */
export interface Reservation {
  /** 预订唯一标识符 */
  id: string;
  /** 预订者（角色）的对象ID */
  claimantId: ObjectId;
  /** 被预订目标的对象ID */
  targetId: ObjectId;
  /** 关联的工作ID */
  jobId: string;
  /** 预订的目标格子坐标（可选） */
  targetCell?: CellCoord;
  /** 预订过期的 tick 时刻 */
  expiresAtTick: number;
}

/**
 * ReservationTable 管理角色对地图对象的预订。
 * 防止多个角色同时操作同一目标（如同时搬运同一物品）。
 */
export class ReservationTable {
  /** 所有预订记录（按预订ID索引） */
  private reservations: Map<string, Reservation> = new Map();
  /** 按目标对象ID快速查找预订ID */
  private byTarget: Map<ObjectId, string> = new Map();
  /** 自增的预订ID计数器 */
  private nextId = 1;

  /**
   * 尝试为目标创建预订
   * @param req.claimantId - 预订者ID
   * @param req.targetId - 目标对象ID
   * @param req.jobId - 关联工作ID
   * @param req.currentTick - 当前 tick
   * @param req.maxTick - 预订持续的最大 tick 数（默认5000）
   * @returns 成功返回预订ID，目标已被预订则返回 null
   */
  tryReserve(req: {
    claimantId: ObjectId;
    targetId: ObjectId;
    jobId: string;
    currentTick: number;
    maxTick?: number;
  }): string | null {
    if (this.byTarget.has(req.targetId)) return null;

    const id = `res_${this.nextId++}`;
    const reservation: Reservation = {
      id,
      claimantId: req.claimantId,
      targetId: req.targetId,
      jobId: req.jobId,
      expiresAtTick: req.currentTick + (req.maxTick ?? 5000),
    };
    this.reservations.set(id, reservation);
    this.byTarget.set(req.targetId, id);
    return id;
  }

  /**
   * 释放指定预订
   * @param id - 预订ID
   */
  release(id: string): void {
    const res = this.reservations.get(id);
    if (res) {
      this.byTarget.delete(res.targetId);
      this.reservations.delete(id);
    }
  }

  /**
   * 检查目标对象是否已被预订
   * @param targetId - 目标对象ID
   * @returns 是否已被预订
   */
  isReserved(targetId: ObjectId): boolean {
    return this.byTarget.has(targetId);
  }

  /**
   * 获取目标对象的预订记录
   * @param targetId - 目标对象ID
   * @returns 预订记录，不存在则返回 null
   */
  getReservation(targetId: ObjectId): Reservation | null {
    const id = this.byTarget.get(targetId);
    if (!id) return null;
    return this.reservations.get(id) ?? null;
  }

  /**
   * 获取指定角色的所有预订
   * @param pawnId - 角色对象ID
   * @returns 该角色持有的所有预订记录
   */
  getAllByPawn(pawnId: ObjectId): Reservation[] {
    return Array.from(this.reservations.values()).filter(r => r.claimantId === pawnId);
  }

  /**
   * 获取所有预订记录
   * @returns 所有预订记录数组
   */
  getAll(): Reservation[] {
    return Array.from(this.reservations.values());
  }

  /**
   * 清理所有已过期的预订
   * @param currentTick - 当前 tick
   */
  cleanupExpired(currentTick: number): void {
    for (const [id, res] of this.reservations) {
      if (currentTick >= res.expiresAtTick) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }

  /**
   * 释放指定角色的所有预订
   * @param pawnId - 角色对象ID
   */
  releaseAllByPawn(pawnId: ObjectId): void {
    for (const [id, res] of this.reservations) {
      if (res.claimantId === pawnId) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }

  /**
   * 释放指定工作关联的所有预订
   * @param jobId - 工作ID
   */
  releaseAllForJob(jobId: string): void {
    for (const [id, res] of this.reservations) {
      if (res.jobId === jobId) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }
}
