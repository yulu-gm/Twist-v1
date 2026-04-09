/**
 * @file plant-renderer.ts
 * @description 植物对象渲染器 — 树、灌木丛、作物、草
 * @part-of adapter/render/object-renderers
 */

import Phaser from 'phaser';
import { ObjectKind, MapObjectBase } from '../../../core/types';
import { SeededRandom } from '../../../core/seeded-random';
import { TILE_SIZE, scaleColor } from '../render-utils';
import type { ObjectRenderer } from './types';

/**
 * 植物渲染器 — 处理所有 Plant 类型的精灵创建和更新
 *
 * 按 tag 分类：树（三角形）、灌木/浆果丛（圆形丛簇）、作物（茎穗）、草（弧线）
 */
export class PlantRenderer implements ObjectRenderer {
  readonly kinds = new Set([ObjectKind.Plant]);

  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  createSprite(obj: MapObjectBase, cx: number, cy: number, color: number): Phaser.GameObjects.GameObject {
    if (obj.tags.has('tree')) {
      return this.createTreeSprite(obj, cx, cy, color);
    }
    return this.createNonTreeSprite(obj, cx, cy, color);
  }

  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, _color: number): void {
    const cx = obj.cell.x * TILE_SIZE + TILE_SIZE / 2;

    // 树：底部对齐 Y 偏移
    if (obj.tags.has('tree')) {
      const growth = (obj as any).growthProgress ?? 1;
      const scale = 0.5 + growth * 0.5;
      const margin = 4;
      const baseH = (TILE_SIZE - margin * 2) * scale;
      const bottomY = obj.cell.y * TILE_SIZE + TILE_SIZE;
      const centerY = bottomY - baseH / 2;
      if (sprite instanceof Phaser.GameObjects.Triangle) {
        sprite.setPosition(cx, centerY);
      }
      return;
    }

    // 非树植物
    if (sprite instanceof Phaser.GameObjects.Graphics) {
      sprite.setPosition(cx, obj.cell.y * TILE_SIZE + TILE_SIZE / 2);
    }
  }

  // ── 树 ──

  private createTreeSprite(
    obj: MapObjectBase, cx: number, _cy: number, baseColor: number,
  ): Phaser.GameObjects.Triangle {
    const idNum = parseInt(obj.id.replace(/\D/g, '') || '0', 10);
    const colorRng = new SeededRandom(idNum + 3571);
    const colorVariation = 1 + (colorRng.next() - 0.5) * 0.15;
    const color = scaleColor(baseColor, colorVariation);

    const growth = (obj as any).growthProgress ?? 1;
    const scale = 0.5 + growth * 0.5;

    const margin = 4;
    const baseW = (TILE_SIZE - margin * 2) * scale;
    const baseH = (TILE_SIZE - margin * 2) * scale;

    const bottomY = obj.cell.y * TILE_SIZE + TILE_SIZE;
    const centerX = cx;
    const centerY = bottomY - baseH / 2;

    const tri = this.scene.add.triangle(
      centerX, centerY,
      0, 0,
      baseW, 0,
      baseW / 2, -baseH,
      color,
    );
    tri.setOrigin(0.5, 0.5);
    tri.setStrokeStyle(1, 0x000000, 0.3);
    this.layer.add(tri);
    return tri;
  }

  // ── 非树植物：灌木/作物/草 ──

  private createNonTreeSprite(
    obj: MapObjectBase, cx: number, cy: number, baseColor: number,
  ): Phaser.GameObjects.Graphics {
    const idNum = parseInt(obj.id.replace(/\D/g, '') || '0', 10);
    const rng = new SeededRandom(idNum + 7727);
    const growth = (obj as any).growthProgress ?? 1;
    const scale = 0.4 + growth * 0.6;

    const g = this.scene.add.graphics();
    g.setPosition(cx, cy);

    if (obj.tags.has('grass')) {
      this.drawGrass(g, rng, baseColor, scale);
    } else if (obj.tags.has('crop')) {
      this.drawCrop(g, rng, baseColor, scale, growth);
    } else {
      this.drawBush(g, rng, obj, baseColor, scale, growth);
    }

    this.layer.add(g);
    return g;
  }

  private drawGrass(
    g: Phaser.GameObjects.Graphics, rng: SeededRandom,
    baseColor: number, scale: number,
  ): void {
    const color = scaleColor(baseColor, 1 + (rng.next() - 0.5) * 0.2);
    const bladeCount = 2 + rng.nextInt(0, 1);
    g.lineStyle(1.5, color, 0.9);
    for (let i = 0; i < bladeCount; i++) {
      const baseX = rng.nextFloat(-4, 4);
      const angle = rng.nextFloat(-0.5, 0.5);
      const h = (8 + rng.nextInt(0, 5)) * scale;
      g.beginPath();
      g.moveTo(baseX, 6);
      g.lineTo(baseX + angle * h, 6 - h);
      g.strokePath();
    }
  }

  private drawCrop(
    g: Phaser.GameObjects.Graphics, rng: SeededRandom,
    baseColor: number, scale: number, growth: number,
  ): void {
    const stemColor = scaleColor(baseColor, 0.7);
    const headColor = scaleColor(baseColor, 1 + (rng.next() - 0.5) * 0.15);
    const stemH = (10 + rng.nextInt(0, 4)) * scale;
    const headW = (4 + rng.nextInt(0, 2)) * scale;
    const headH = (3 + rng.nextInt(0, 2)) * scale;

    g.lineStyle(1.5, stemColor, 0.9);
    g.beginPath();
    g.moveTo(0, 6);
    g.lineTo(0, 6 - stemH);
    g.strokePath();

    g.fillStyle(headColor, 0.9);
    g.fillEllipse(0, 6 - stemH - headH / 2, headW, headH);

    if (growth > 0.4) {
      g.lineStyle(1, headColor, 0.6);
      g.beginPath();
      g.moveTo(0, 6 - stemH * 0.5);
      g.lineTo(-4 * scale, 6 - stemH * 0.6);
      g.strokePath();
      g.beginPath();
      g.moveTo(0, 6 - stemH * 0.35);
      g.lineTo(4 * scale, 6 - stemH * 0.45);
      g.strokePath();
    }
  }

  private drawBush(
    g: Phaser.GameObjects.Graphics, rng: SeededRandom,
    obj: MapObjectBase, baseColor: number, scale: number, growth: number,
  ): void {
    const colorVar = 1 + (rng.next() - 0.5) * 0.15;
    const color = scaleColor(baseColor, colorVar);
    const r = (4 + rng.nextInt(0, 2)) * scale;
    const offsets = [
      { x: rng.nextFloat(-3, -1), y: rng.nextFloat(-1, 2) },
      { x: rng.nextFloat(1, 3), y: rng.nextFloat(-1, 2) },
      { x: rng.nextFloat(-1, 1), y: rng.nextFloat(-4, -2) },
    ];

    g.fillStyle(color, 0.85);
    for (const off of offsets) {
      g.fillCircle(off.x * scale, off.y * scale, r);
    }
    g.lineStyle(1, scaleColor(color, 0.6), 0.5);
    for (const off of offsets) {
      g.strokeCircle(off.x * scale, off.y * scale, r);
    }

    if (obj.tags.has('harvestable') && growth > 0.5) {
      const berryColor = 0xcc3333;
      g.fillStyle(berryColor, 0.9);
      const berryCount = 2 + rng.nextInt(0, 2);
      for (let i = 0; i < berryCount; i++) {
        const off = offsets[i % offsets.length];
        const bx = off.x * scale + rng.nextFloat(-2, 2);
        const by = off.y * scale + rng.nextFloat(-2, 2);
        g.fillCircle(bx, by, 1.5);
      }
    }
  }

}
