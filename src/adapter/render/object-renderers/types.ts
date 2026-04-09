/**
 * @file types.ts
 * @description 对象渲染器接口定义
 * @part-of adapter/render/object-renderers — 对象渲染器模块
 */

import type Phaser from 'phaser';
import type { MapObjectBase, ObjectKind } from '../../../core/types';

/**
 * 对象渲染器接口 — 每种渲染域实现此接口
 *
 * 负责特定类型对象的精灵创建、每帧更新和清理。
 * RenderSync 根据 ObjectKind 将对象分发到对应的渲染器。
 */
export interface ObjectRenderer {
  /** 该渲染器处理哪些 ObjectKind */
  readonly kinds: ReadonlySet<ObjectKind>;

  /** 为对象创建 Phaser 精灵 */
  createSprite(obj: MapObjectBase, cx: number, cy: number, color: number): Phaser.GameObjects.GameObject;

  /** 每帧更新精灵状态（位置/属性） */
  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, color: number): void;

  /** 精灵被移除前的清理（可选，如删除进度条） */
  onRemove?(objId: string, sprite: Phaser.GameObjects.GameObject): void;
}
