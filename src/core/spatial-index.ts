/**
 * @file spatial-index.ts
 * @description 基于格子的空间索引，支持快速查询某格子上的对象及通行性判断
 * @dependencies types.ts (CellCoord, Footprint, ObjectId)
 * @part-of core 核心模块 — 供寻路、碰撞检测、对象查询等系统使用
 */

import { CellCoord, Footprint, ObjectId } from './types';

/**
 * SpatialIndex — cell-based spatial lookup.
 * Backed by a flat array of Sets, one per cell.
 * 空间索引类：每个格子维护一个对象 ID 集合，支持快速的位置查询与通行性检测
 */
export class SpatialIndex {
  // ── 网格尺寸 ──
  readonly width: number;    // 地图宽度（格子数）
  readonly height: number;   // 地图高度（格子数）

  // ── 内部数据 ──
  private cells: Set<ObjectId>[];   // 每个格子上的对象 ID 集合
  private impassable: Set<ObjectId>; // 阻碍移动的对象 ID 集合

  /**
   * 创建空间索引
   * @param width - 地图宽度
   * @param height - 地图高度
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = new Set();
    }
    this.impassable = new Set();
  }

  /** 将二维坐标转换为一维数组索引 */
  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  /** 判断坐标是否在地图范围内 */
  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * 获取指定格子上的所有对象 ID
   * @param cell - 目标格子坐标
   * @returns 对象 ID 数组（越界时返回空数组）
   */
  getAt(cell: CellCoord): ObjectId[] {
    if (!this.inBounds(cell.x, cell.y)) return [];
    return Array.from(this.cells[this.idx(cell.x, cell.y)]);
  }

  /**
   * 获取矩形区域内的所有对象 ID
   * @param min - 矩形左上角坐标
   * @param max - 矩形右下角坐标
   * @returns 区域内所有对象 ID 数组
   */
  getInRect(min: CellCoord, max: CellCoord): ObjectId[] {
    const result: ObjectId[] = [];
    const x0 = Math.max(0, min.x);
    const y0 = Math.max(0, min.y);
    const x1 = Math.min(this.width - 1, max.x);
    const y1 = Math.min(this.height - 1, max.y);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (const id of this.cells[this.idx(x, y)]) {
          result.push(id);
        }
      }
    }
    return result;
  }

  /**
   * 判断指定格子是否可通行（不含阻碍移动的对象）
   * @param cell - 目标格子坐标
   * @returns 可通行返回 true；越界或有不可通行对象时返回 false
   */
  isPassable(cell: CellCoord): boolean {
    if (!this.inBounds(cell.x, cell.y)) return false;
    const ids = this.cells[this.idx(cell.x, cell.y)];
    for (const id of ids) {
      if (this.impassable.has(id)) return false;
    }
    return true;
  }

  /**
   * 判断指定格子是否有任何对象占据
   * @param cell - 目标格子坐标
   * @returns 有对象返回 true
   */
  isOccupied(cell: CellCoord): boolean {
    if (!this.inBounds(cell.x, cell.y)) return false;
    return this.cells[this.idx(cell.x, cell.y)].size > 0;
  }

  /**
   * 对象被添加到地图时更新索引（支持多格占地）
   * @param id - 对象标识
   * @param cell - 对象左上角坐标
   * @param footprint - 占地尺寸（可选，默认 1x1）
   * @param blocksMovement - 是否阻碍移动
   */
  onObjectAdded(id: ObjectId, cell: CellCoord, footprint?: Footprint, blocksMovement: boolean = false): void {
    const w = footprint?.width ?? 1;
    const h = footprint?.height ?? 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = cell.x + dx;
        const cy = cell.y + dy;
        if (this.inBounds(cx, cy)) {
          this.cells[this.idx(cx, cy)].add(id);
        }
      }
    }
    if (blocksMovement) {
      this.impassable.add(id);
    }
  }

  /**
   * 对象从地图移除时更新索引
   * @param id - 对象标识
   * @param cell - 对象原始左上角坐标
   * @param footprint - 占地尺寸（可选）
   */
  onObjectRemoved(id: ObjectId, cell: CellCoord, footprint?: Footprint): void {
    const w = footprint?.width ?? 1;
    const h = footprint?.height ?? 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = cell.x + dx;
        const cy = cell.y + dy;
        if (this.inBounds(cx, cy)) {
          this.cells[this.idx(cx, cy)].delete(id);
        }
      }
    }
    this.impassable.delete(id);
  }

  /**
   * 对象在地图上移动时更新索引（先移除旧位置，再添加新位置）
   * @param id - 对象标识
   * @param from - 移动前的坐标
   * @param to - 移动后的坐标
   * @param footprint - 占地尺寸（可选）
   */
  onObjectMoved(id: ObjectId, from: CellCoord, to: CellCoord, footprint?: Footprint): void {
    this.onObjectRemoved(id, from, footprint);
    this.onObjectAdded(id, to, footprint, this.impassable.has(id));
  }

  /**
   * 将对象标记为不可通行（阻碍寻路）
   * @param id - 对象标识
   */
  markImpassable(id: ObjectId): void {
    this.impassable.add(id);
  }

  /**
   * 将对象标记为可通行（取消阻碍）
   * @param id - 对象标识
   */
  markPassable(id: ObjectId): void {
    this.impassable.delete(id);
  }

  /** 清空所有索引数据（用于地图重置） */
  clear(): void {
    for (const set of this.cells) {
      set.clear();
    }
    this.impassable.clear();
  }
}
