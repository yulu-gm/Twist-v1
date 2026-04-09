/**
 * @file terrain-renderer.ts
 * @description 地形渲染器 — 地形贴图、可开采岩石纹理、网格线
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { SeededRandom } from '../../core/seeded-random';
import { TILE_SIZE, LayerName, scaleColor } from './render-utils';

/**
 * 地形渲染器 — 管理地形贴图和网格线的渲染
 *
 * 使用 dirty flag 优化，仅在地形变化时重绘。
 */
export class TerrainRenderer {
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;

  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private terrainDirty = true;
  private showGrid = false;

  constructor(scene: Phaser.Scene, world: World, map: GameMap) {
    this.scene = scene;
    this.world = world;
    this.map = map;
  }

  markDirty(): void { this.terrainDirty = true; }

  /** 如果地形脏，重绘并清除标记 */
  syncIfDirty(layers: Map<LayerName, Phaser.GameObjects.Container>): void {
    if (!this.terrainDirty) return;
    this.render(layers);
    this.terrainDirty = false;
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.gridGraphics.setVisible(show);
  }

  /** 渲染地形层 — 带颜色变体、边缘暗线和散落装饰 */
  private render(layers: Map<LayerName, Phaser.GameObjects.Container>): void {
    if (this.terrainGraphics) this.terrainGraphics.destroy();
    this.terrainGraphics = this.scene.add.graphics();
    layers.get('terrain')!.add(this.terrainGraphics);

    this.map.terrain.forEach((x, y, defId) => {
      const def = this.world.defs.terrains.get(defId);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      const cellSeed = x * 7919 + y * 6271 + 1009;
      const cellRng = new SeededRandom(cellSeed);

      // ── 可开采岩石：草地底色 + 不规则多边形岩石 ──
      if (def?.mineable) {
        const grassBase = 0x4a7c3f;
        const grassVar = 1 + (cellRng.next() - 0.5) * 0.1;
        this.terrainGraphics.fillStyle(scaleColor(grassBase, grassVar), 1);
        this.terrainGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        const rockColor = def.color ?? 0x666666;
        const rockVar = 1 + (cellRng.next() - 0.5) * 0.12;
        const baseRock = scaleColor(rockColor, rockVar);
        const m = 2;
        const pts: { x: number; y: number }[] = [];
        pts.push({ x: px + m + cellRng.nextInt(0, 3), y: py + m + cellRng.nextInt(0, 3) });
        pts.push({ x: px + TILE_SIZE / 2 + cellRng.nextInt(-2, 2), y: py + m + cellRng.nextInt(0, 2) });
        pts.push({ x: px + TILE_SIZE - m - cellRng.nextInt(0, 3), y: py + m + cellRng.nextInt(0, 3) });
        pts.push({ x: px + TILE_SIZE - m - cellRng.nextInt(0, 2), y: py + TILE_SIZE / 2 + cellRng.nextInt(-2, 2) });
        pts.push({ x: px + TILE_SIZE - m - cellRng.nextInt(0, 3), y: py + TILE_SIZE - m - cellRng.nextInt(0, 3) });
        pts.push({ x: px + TILE_SIZE / 2 + cellRng.nextInt(-2, 2), y: py + TILE_SIZE - m - cellRng.nextInt(0, 2) });
        pts.push({ x: px + m + cellRng.nextInt(0, 3), y: py + TILE_SIZE - m - cellRng.nextInt(0, 3) });
        pts.push({ x: px + m + cellRng.nextInt(0, 2), y: py + TILE_SIZE / 2 + cellRng.nextInt(-2, 2) });

        this.terrainGraphics.fillStyle(baseRock, 1);
        this.terrainGraphics.beginPath();
        this.terrainGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          this.terrainGraphics.lineTo(pts[i].x, pts[i].y);
        }
        this.terrainGraphics.closePath();
        this.terrainGraphics.fillPath();

        // 高光
        const hiColor = scaleColor(baseRock, 1.3);
        this.terrainGraphics.lineStyle(1, hiColor, 0.6);
        for (let i = 0; i < 2; i++) {
          const lx1 = px + cellRng.nextInt(4, TILE_SIZE / 2);
          const ly1 = py + cellRng.nextInt(3, TILE_SIZE / 2);
          const lx2 = lx1 + cellRng.nextInt(4, 10);
          const ly2 = ly1 + cellRng.nextInt(-2, 3);
          this.terrainGraphics.beginPath();
          this.terrainGraphics.moveTo(lx1, ly1);
          this.terrainGraphics.lineTo(lx2, ly2);
          this.terrainGraphics.strokePath();
        }

        // 裂纹
        const crackColor = scaleColor(baseRock, 0.5);
        this.terrainGraphics.lineStyle(1, crackColor, 0.5);
        const cx1 = px + cellRng.nextInt(6, TILE_SIZE - 6);
        const cy1 = py + cellRng.nextInt(6, TILE_SIZE - 6);
        const cx2 = cx1 + cellRng.nextInt(-6, 6);
        const cy2 = cy1 + cellRng.nextInt(3, 8);
        this.terrainGraphics.beginPath();
        this.terrainGraphics.moveTo(cx1, cy1);
        this.terrainGraphics.lineTo(cx2, cy2);
        this.terrainGraphics.strokePath();

        // 边缘暗线
        const edgeColor = scaleColor(grassBase, 0.85);
        this.terrainGraphics.fillStyle(edgeColor, 1);
        this.terrainGraphics.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
        this.terrainGraphics.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
        return;
      }

      const baseColor = (def?.passable !== false) ? 0x4a7c3f : (def?.color ?? 0x333333);
      const variation = 1 + (cellRng.next() - 0.5) * 0.1;
      const fillColor = scaleColor(baseColor, variation);

      this.terrainGraphics.fillStyle(fillColor, 1);
      this.terrainGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // 边缘暗线
      const edgeColor = scaleColor(baseColor, 0.85);
      this.terrainGraphics.fillStyle(edgeColor, 1);
      this.terrainGraphics.fillRect(px, (y + 1) * TILE_SIZE - 1, TILE_SIZE, 1);
      this.terrainGraphics.fillRect((x + 1) * TILE_SIZE - 1, py, 1, TILE_SIZE);

      // 散落装饰
      if (def?.passable !== false && cellRng.chance(0.12)) {
        const dotColor = cellRng.chance(0.5) ? scaleColor(baseColor, 0.7) : scaleColor(baseColor, 1.15);
        this.terrainGraphics.fillStyle(dotColor, 0.6);
        const dotX = px + cellRng.nextInt(4, TILE_SIZE - 4);
        const dotY = py + cellRng.nextInt(4, TILE_SIZE - 4);
        this.terrainGraphics.fillCircle(dotX, dotY, cellRng.nextInt(1, 2));
      }
    });

    this.renderGrid(layers);
  }

  /** 渲染网格线层 */
  private renderGrid(layers: Map<LayerName, Phaser.GameObjects.Container>): void {
    if (this.gridGraphics) this.gridGraphics.destroy();
    this.gridGraphics = this.scene.add.graphics();
    layers.get('grid')!.add(this.gridGraphics);
    this.gridGraphics.lineStyle(1, 0x000000, 0.15);

    for (let x = 0; x <= this.map.width; x++) {
      this.gridGraphics.moveTo(x * TILE_SIZE, 0);
      this.gridGraphics.lineTo(x * TILE_SIZE, this.map.height * TILE_SIZE);
    }
    for (let y = 0; y <= this.map.height; y++) {
      this.gridGraphics.moveTo(0, y * TILE_SIZE);
      this.gridGraphics.lineTo(this.map.width * TILE_SIZE, y * TILE_SIZE);
    }
    this.gridGraphics.strokePath();
    this.gridGraphics.setVisible(this.showGrid);
  }
}
