/**
 * @file default-renderer.ts
 * @description 默认对象渲染器 — Building/Blueprint/ConstructionSite/Designation 等
 * @part-of adapter/render/object-renderers
 */

import Phaser from 'phaser';
import { ObjectKind, MapObjectBase } from '../../../core/types';
import { LayerName, kindToLayer, getSpriteSize, getObjectPixelCenter, scaleColor } from '../render-utils';
import type { ObjectRenderer } from './types';
import type { Building } from '../../../features/building/building.types';

/**
 * 默认渲染器 — 处理没有专用渲染器的对象类型
 *
 * 渲染为带描边的矩形，颜色由 getSpriteColor 提供。
 */
export class DefaultRenderer implements ObjectRenderer {
  readonly kinds = new Set([
    ObjectKind.Building,
    ObjectKind.Designation,
  ]);

  private scene: Phaser.Scene;
  private layers: Map<LayerName, Phaser.GameObjects.Container>;

  constructor(
    scene: Phaser.Scene,
    layers: Map<LayerName, Phaser.GameObjects.Container>,
  ) {
    this.scene = scene;
    this.layers = layers;
  }

  createSprite(obj: MapObjectBase, cx: number, cy: number, color: number): Phaser.GameObjects.GameObject {
    if (this.isBed(obj)) {
      return this.createBedSprite(obj, cx, cy, color);
    }

    const size = getSpriteSize(obj);
    const rect = this.scene.add.rectangle(cx, cy, size.w - 2, size.h - 2, color);
    rect.setStrokeStyle(1, 0x000000, 0.3);
    this.layers.get(kindToLayer(obj.kind))!.add(rect);
    return rect;
  }

  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, color: number): void {
    const center = getObjectPixelCenter(obj.cell, obj.footprint);

    if (sprite instanceof Phaser.GameObjects.Graphics && this.isBed(obj)) {
      sprite.setPosition(center.x, center.y);
      return;
    }

    if (sprite instanceof Phaser.GameObjects.Rectangle) {
      sprite.setPosition(center.x, center.y);
      sprite.setFillStyle(color);
    }
  }

  private isBed(obj: MapObjectBase): obj is Building {
    return obj.kind === ObjectKind.Building
      && ((obj as Building).bed !== undefined
      || (obj as Building).furniture?.usageType === 'bed'
      || obj.defId === 'bed_wood');
  }

  private createBedSprite(
    obj: MapObjectBase,
    cx: number,
    cy: number,
    color: number,
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.setPosition(cx, cy);
    this.redrawBedSprite(graphics, getSpriteSize(obj), color);
    this.layers.get(kindToLayer(obj.kind))!.add(graphics);
    return graphics;
  }

  private redrawBedSprite(
    graphics: Phaser.GameObjects.Graphics,
    size: { w: number; h: number },
    color: number,
  ): void {
    const frameColor = scaleColor(color, 0.68);
    const mattressColor = 0xe6dcc8;
    const sheetColor = scaleColor(color, 1.08);
    const pillowColor = 0xf4efe4;
    const blanketShadow = scaleColor(color, 0.82);
    const shadowWidth = Math.max(12, size.w - 12);

    graphics.clear();

    graphics.fillStyle(0x000000, 0.18);
    graphics.fillEllipse(0, size.h * 0.3, shadowWidth, 10);

    graphics.fillStyle(frameColor, 1);
    graphics.fillRect(-size.w / 2 + 2, -size.h / 2 + 2, size.w - 4, size.h - 4);

    graphics.fillStyle(mattressColor, 1);
    graphics.fillRect(-size.w / 2 + 6, -size.h / 2 + 8, size.w - 12, size.h - 18);

    graphics.fillStyle(pillowColor, 1);
    graphics.fillRect(-size.w / 2 + 8, -size.h / 2 + 10, size.w - 16, 10);

    graphics.fillStyle(sheetColor, 0.96);
    graphics.fillRect(-size.w / 2 + 6, -4, size.w - 12, size.h / 2 - 6);

    graphics.fillStyle(blanketShadow, 0.55);
    graphics.fillRect(-size.w / 2 + 6, size.h / 2 - 14, size.w - 12, 6);

    graphics.fillStyle(frameColor, 1);
    graphics.fillRect(-size.w / 2 + 4, -size.h / 2 + 4, size.w - 8, 4);
    graphics.fillRect(-size.w / 2 + 4, size.h / 2 - 8, size.w - 8, 4);

    graphics.lineStyle(1, scaleColor(frameColor, 0.78), 0.75);
    graphics.strokeRect(-size.w / 2 + 2, -size.h / 2 + 2, size.w - 4, size.h - 4);
    graphics.strokeRect(-size.w / 2 + 6, -size.h / 2 + 8, size.w - 12, size.h - 18);
  }
}
