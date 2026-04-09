/**
 * @file path-grid.ts
 * @description 寻路网格（PathGrid），维护地图的可通行性数据供寻路算法使用
 * @dependencies core/grid — Grid 工具类；core/types — ObjectKind, MapObjectBase；
 *               world/def-database — DefDatabase（可选）
 * @part-of world 模块——游戏世界数据层
 */

import { Grid } from '../core/grid';
import { ObjectKind } from '../core/types';
import type { MapObjectBase } from '../core/types';
import type { GameMap } from './game-map';
import type { DefDatabase } from './def-database';

/**
 * PathGrid 维护地图的可通行性网格，供寻路算法使用。
 * 综合考虑地形和建筑物的通行阻挡。
 */
export class PathGrid {
  /** 可通行性网格（true=可通行，false=不可通行） */
  private passable: Grid<boolean>;

  /**
   * 构造寻路网格
   * @param width - 地图宽度
   * @param height - 地图高度
   */
  constructor(width: number, height: number) {
    this.passable = new Grid(width, height, true);
  }

  /**
   * 检查指定格子是否可通行
   * @param x - 格子X坐标
   * @param y - 格子Y坐标
   * @returns 是否可通行（越界也返回 false）
   */
  isPassable(x: number, y: number): boolean {
    return this.passable.inBounds(x, y) && this.passable.get(x, y);
  }

  /**
   * 设置指定格子的可通行性
   * @param x - 格子X坐标
   * @param y - 格子Y坐标
   * @param value - 是否可通行
   */
  setPassable(x: number, y: number, value: boolean): void {
    if (this.passable.inBounds(x, y)) {
      this.passable.set(x, y, value);
    }
  }

  /** 地图宽度 */
  get width(): number { return this.passable.width; }
  /** 地图高度 */
  get height(): number { return this.passable.height; }

  /**
   * 根据地图数据重建整个可通行性网格
   * 先根据地形设置基础通行性，再叠加建筑物的阻挡
   * @param map - 游戏地图
   * @param defs - 定义数据库（可选，用于查询地形/建筑的通行属性）
   */
  rebuildFrom(map: GameMap, defs?: DefDatabase): void {
    const terrain = map.terrain;
    terrain.forEach((x, y, defId) => {
      if (defs) {
        const tDef = defs.terrains.get(defId);
        this.passable.set(x, y, tDef ? tDef.passable : true);
      } else {
        // 回退方案：使用硬编码的不可通行地形类型
        const impassable = defId === 'rock' || defId === 'water';
        this.passable.set(x, y, !impassable);
      }
    });
    // 标记阻挡移动的建筑物所占格子为不可通行
    map.objects.allOfKind(ObjectKind.Building).forEach((obj: MapObjectBase) => {
      if (defs) {
        const bDef = defs.buildings.get(obj.defId);
        if (bDef && bDef.blocksMovement) {
          const fp = obj.footprint ?? { width: 1, height: 1 };
          for (let dy = 0; dy < fp.height; dy++) {
            for (let dx = 0; dx < fp.width; dx++) {
              this.setPassable(obj.cell.x + dx, obj.cell.y + dy, false);
            }
          }
        }
      } else if (obj.tags.has('impassable')) {
        const fp = obj.footprint ?? { width: 1, height: 1 };
        for (let dy = 0; dy < fp.height; dy++) {
          for (let dx = 0; dx < fp.width; dx++) {
            this.setPassable(obj.cell.x + dx, obj.cell.y + dy, false);
          }
        }
      }
    });
  }
}
