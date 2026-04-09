/**
 * @file render-sync.ts
 * @description 渲染编排器 — 管理渲染层、协调地形渲染器和对象渲染器
 * @dependencies phaser — 渲染引擎；world — 世界数据；
 *               render-utils — 共享常量；terrain-renderer — 地形渲染；
 *               object-renderers/* — 各类型对象渲染器；sprite-registry — 精灵映射
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, ObjectId, MapObjectBase } from '../../core/types';
import { TILE_SIZE, LAYER_DEPTH, LayerName, kindToLayer, getSpriteColor } from './render-utils';
import { SpriteRegistry } from './sprite-registry';
import { TerrainRenderer } from './terrain-renderer';
import { ZoneRenderer } from './zone-renderer';
import type { ObjectRenderer } from './object-renderers/types';
import { PawnRenderer } from './object-renderers/pawn-renderer';
import { PlantRenderer } from './object-renderers/plant-renderer';
import { ItemRenderer } from './object-renderers/item-renderer';
import { DefaultRenderer } from './object-renderers/default-renderer';

/**
 * 渲染编排器 — 管理渲染层并将对象分发到对应的渲染器
 *
 * 职责：
 * 1. 管理有序 Container 渲染层（terrain → grid → … → worldUI）
 * 2. 协调 TerrainRenderer 的脏检查重绘
 * 3. 每帧同步对象精灵：按 ObjectKind 分发到对应的 ObjectRenderer
 * 4. 管理精灵生命周期（创建/更新/销毁）
 */
export class RenderSync {
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;
  private spriteRegistry: SpriteRegistry;

  // ── 分层 Container ──
  private layers = new Map<LayerName, Phaser.GameObjects.Container>();

  // ── 子系统 ──
  private terrainRenderer: TerrainRenderer;
  private zoneRenderer: ZoneRenderer;
  private pawnRenderer: PawnRenderer;
  private rendererMap = new Map<ObjectKind, ObjectRenderer>();
  private defaultRenderer: DefaultRenderer;

  constructor(scene: Phaser.Scene, world: World, map: GameMap) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.spriteRegistry = new SpriteRegistry();

    this.createLayers();

    // 初始化子系统
    this.terrainRenderer = new TerrainRenderer(scene, world, map);
    this.zoneRenderer = new ZoneRenderer(scene, this.layers.get('zone')!, map);
    this.pawnRenderer = new PawnRenderer(scene, this.layers);
    const plantRenderer = new PlantRenderer(scene, this.layers.get('plant')!);
    const itemRenderer = new ItemRenderer(scene, this.layers.get('item')!);
    this.defaultRenderer = new DefaultRenderer(scene, this.layers);

    // 注册渲染器
    const renderers: ObjectRenderer[] = [
      this.pawnRenderer,
      plantRenderer,
      itemRenderer,
      this.defaultRenderer,
    ];
    for (const renderer of renderers) {
      for (const kind of renderer.kinds) {
        this.rendererMap.set(kind, renderer);
      }
    }
  }

  // ── 公开 API ──

  fullSync(): void {
    this.terrainRenderer.markDirty();
    this.sync();
  }

  /**
   * 每帧同步 — 按需重绘地形，创建/更新/移除精灵
   * @param tickProgress - 距下一次逻辑 tick 的时间比例 [0,1)；Pawn 上与 moveProgress、speed 同刻度推算边上位置
   */
  sync(tickProgress = 0): void {
    this.terrainRenderer.syncIfDirty(this.layers);
    this.zoneRenderer.update();
    this.pawnRenderer.setTickProgress(tickProgress);

    const seen = new Set<ObjectId>();

    for (const obj of this.map.objects.all()) {
      seen.add(obj.id);
      if (obj.destroyed) continue;

      const color = getSpriteColor(obj, this.world.defs);
      const renderer = this.getRenderer(obj.kind);

      let sprite = this.spriteRegistry.get(obj.id);
      if (!sprite) {
        const cx = obj.cell.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = obj.cell.y * TILE_SIZE + TILE_SIZE / 2;
        sprite = renderer.createSprite(obj, cx, cy, color);
        this.spriteRegistry.set(obj.id, sprite);
      }
      renderer.updateSprite(sprite, obj, color);
    }

    // 移除已销毁/已移除对象的精灵
    for (const [id, sprite] of this.spriteRegistry.entries()) {
      if (!seen.has(id)) {
        const obj = this.map.objects.get(id);
        const kind = obj?.kind;
        if (kind) {
          const renderer = this.getRenderer(kind);
          renderer.onRemove?.(id, sprite);
        } else {
          // 对象已完全移除，尝试 pawn cleanup（最常见的需要清理的类型）
          this.pawnRenderer.onRemove(id, sprite);
        }
        sprite.destroy();
        this.spriteRegistry.delete(id);
      }
    }
  }

  markTerrainDirty(): void { this.terrainRenderer.markDirty(); }

  setShowGrid(show: boolean): void { this.terrainRenderer.setShowGrid(show); }

  getWorldUILayer(): Phaser.GameObjects.Container { return this.layers.get('worldUI')!; }

  getRegistry(): SpriteRegistry { return this.spriteRegistry; }

  getTileSize(): number { return TILE_SIZE; }

  // ── 内部实现 ──

  private createLayers(): void {
    for (const [name, depth] of Object.entries(LAYER_DEPTH)) {
      const container = this.scene.add.container(0, 0);
      container.setDepth(depth);
      this.layers.set(name as LayerName, container);
    }
  }

  private getRenderer(kind: ObjectKind): ObjectRenderer {
    return this.rendererMap.get(kind) ?? this.defaultRenderer;
  }
}

export { TILE_SIZE };
