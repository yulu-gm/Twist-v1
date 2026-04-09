/**
 * @file default-renderer.ts
 * @description 默认对象渲染器 — Building/Blueprint/ConstructionSite/Fire/Designation 等
 * @part-of adapter/render/object-renderers
 */

import Phaser from 'phaser';
import { ObjectKind, MapObjectBase } from '../../../core/types';
import { TILE_SIZE, LayerName, kindToLayer, getSpriteSize } from '../render-utils';
import type { ObjectRenderer } from './types';

/**
 * 默认渲染器 — 处理没有专用渲染器的对象类型
 *
 * 渲染为带描边的矩形，颜色由 getSpriteColor 提供。
 */
export class DefaultRenderer implements ObjectRenderer {
  readonly kinds = new Set([
    ObjectKind.Building,
    ObjectKind.Blueprint,
    ObjectKind.ConstructionSite,
    ObjectKind.Fire,
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

  createSprite(obj: MapObjectBase, cx: number, cy: number, color: number): Phaser.GameObjects.Rectangle {
    const size = getSpriteSize(obj);
    const rect = this.scene.add.rectangle(cx, cy, size.w - 2, size.h - 2, color);
    rect.setStrokeStyle(1, 0x000000, 0.3);
    this.layers.get(kindToLayer(obj.kind))!.add(rect);
    return rect;
  }

  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, color: number): void {
    const cx = obj.cell.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = obj.cell.y * TILE_SIZE + TILE_SIZE / 2;

    if (sprite instanceof Phaser.GameObjects.Rectangle) {
      sprite.setPosition(cx, cy);
      sprite.setFillStyle(color);
    }
  }
}
