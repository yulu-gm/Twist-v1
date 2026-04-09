/**
 * @file zone-renderer.ts
 * @description 正式区域渲染器——负责在常规渲染层显示地图上的已建区域
 * @dependencies phaser — 渲染引擎；world/game-map — 地图数据；
 *               core/types — ZoneType、parseKey；render-utils — 区域颜色工具
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import type { GameMap } from '../../world/game-map';
import { parseKey, ZoneType } from '../../core/types';
import { TILE_SIZE, getZoneColor } from './render-utils';

/**
 * ZoneRenderer 负责把地图上的区域对象绘制到正式游戏画面中。
 *
 * 目标：
 * - 不依赖 debug overlay
 * - 显示已建区域的常驻视觉
 * - 区域层位于地形/网格之上、对象之下
 */
export class ZoneRenderer {
  private map: GameMap;
  private graphics: Phaser.GameObjects.Graphics;
  private lastSignature = '';

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, map: GameMap) {
    this.map = map;
    this.graphics = scene.add.graphics();
    layer.add(this.graphics);
  }

  /** 每帧/按需刷新正式区域渲染 */
  update(): void {
    const signature = this.buildSignature();
    if (signature === this.lastSignature) return;

    this.lastSignature = signature;
    this.graphics.clear();

    const zones = this.map.zones.getAll().slice().sort((a, b) => a.id.localeCompare(b.id));
    for (const zone of zones) {
      const color = this.resolveZoneColor(zone.zoneType);
      if (zone.cells.size === 0) continue;

      this.graphics.fillStyle(color, 0.22);
      this.graphics.lineStyle(1, color, 0.8);

      for (const key of zone.cells) {
        const cell = parseKey(key);
        this.graphics.fillRect(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.strokeRect(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private buildSignature(): string {
    const zones = this.map.zones.getAll().slice().sort((a, b) => a.id.localeCompare(b.id));
    return zones
      .map((zone) => {
        const cells = Array.from(zone.cells).sort().join('|');
        return `${zone.id}:${zone.zoneType}:${cells}`;
      })
      .join('||');
  }

  private resolveZoneColor(zoneType: string): number {
    switch (zoneType as ZoneType) {
      case ZoneType.Stockpile:
        return getZoneColor(ZoneType.Stockpile);
      case ZoneType.Growing:
        return getZoneColor(ZoneType.Growing);
      case ZoneType.Animal:
        return getZoneColor(ZoneType.Animal);
      default:
        return getZoneColor(ZoneType.Stockpile);
    }
  }
}
