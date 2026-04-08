/**
 * @file sprite-registry.ts
 * @description 精灵注册表，维护对象 ID 到 Phaser 游戏对象的映射关系
 * @dependencies phaser — GameObject 类型；core/types — ObjectId
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import { ObjectId } from '../../core/types';

/**
 * 精灵注册表类 — 管理地图对象与其对应的 Phaser 精灵之间的映射
 *
 * 提供增删查改操作，以及批量清除（销毁所有精灵）。
 * 被 RenderSync 使用来追踪哪些对象已创建精灵。
 */
export class SpriteRegistry {
  /** 对象 ID → Phaser 游戏对象 的映射表 */
  private sprites: Map<ObjectId, Phaser.GameObjects.GameObject> = new Map();

  /**
   * 根据对象 ID 获取对应的精灵
   * @param id - 对象 ID
   * @returns 对应的游戏对象，不存在则返回 undefined
   */
  get(id: ObjectId): Phaser.GameObjects.GameObject | undefined {
    return this.sprites.get(id);
  }

  /**
   * 注册或更新对象 ID 对应的精灵
   * @param id - 对象 ID
   * @param sprite - Phaser 游戏对象
   */
  set(id: ObjectId, sprite: Phaser.GameObjects.GameObject): void {
    this.sprites.set(id, sprite);
  }

  /**
   * 移除对象 ID 的精灵映射（不销毁精灵本身）
   * @param id - 对象 ID
   */
  delete(id: ObjectId): void {
    this.sprites.delete(id);
  }

  /**
   * 检查对象 ID 是否已有对应精灵
   * @param id - 对象 ID
   * @returns true 表示已注册
   */
  has(id: ObjectId): boolean {
    return this.sprites.has(id);
  }

  /**
   * 获取所有映射条目的迭代器
   * @returns [ObjectId, GameObject] 对的迭代器
   */
  entries(): IterableIterator<[ObjectId, Phaser.GameObjects.GameObject]> {
    return this.sprites.entries();
  }

  /** 销毁所有精灵并清空映射表 */
  clear(): void {
    for (const [, sprite] of this.sprites) {
      sprite.destroy();
    }
    this.sprites.clear();
  }
}
