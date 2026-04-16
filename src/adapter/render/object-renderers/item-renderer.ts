/**
 * @file item-renderer.ts
 * @description 物品对象渲染器 — 小矩形 + 堆叠数 + 投影
 * @part-of adapter/render/object-renderers
 */

import Phaser from 'phaser';
import { ObjectKind, MapObjectBase } from '../../../core/types';
import { TILE_SIZE, scaleColor } from '../render-utils';
import type { ObjectRenderer } from './types';
import type { Item } from '../../../features/item/item.types';

/**
 * 物品渲染器 — 处理 Item 的精灵创建和更新
 */
export class ItemRenderer implements ObjectRenderer {
  readonly kinds = new Set([ObjectKind.Item]);

  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;
  }

  createSprite(obj: MapObjectBase, cx: number, cy: number, color: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(cx, cy);

    // 投影椭圆
    const shadow = this.scene.add.ellipse(0, 5, 10, 4, 0x000000, 0.2);
    container.add(shadow);

    // 小矩形主体
    const rect = this.scene.add.rectangle(0, 0, 14, 14, color);
    rect.setStrokeStyle(1, scaleColor(color, 0.6), 1);
    container.add(rect);

    // 堆叠数标签
    const stackCount = (obj as Item).stackCount ?? 1;
    if (stackCount > 1) {
      const countText = this.scene.add.text(5, 3, `${stackCount}`, {
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'right',
      });
      countText.setOrigin(0.5, 0.5);
      container.add(countText);
    }

    this.layer.add(container);
    return container;
  }

  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, _color: number): void {
    const cx = obj.cell.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = obj.cell.y * TILE_SIZE + TILE_SIZE / 2;

    if (sprite instanceof Phaser.GameObjects.Container) {
      sprite.setPosition(cx, cy);

      // 更新堆叠数标签
      if (obj.kind === ObjectKind.Item) {
        const stackCount = (obj as Item).stackCount ?? 1;
        const countText = sprite.list[2] as Phaser.GameObjects.Text | undefined;
        if (stackCount > 1) {
          if (countText) {
            countText.setText(`${stackCount}`);
            countText.setVisible(true);
          }
        } else if (countText) {
          countText.setVisible(false);
        }
      }
    }
  }
}
