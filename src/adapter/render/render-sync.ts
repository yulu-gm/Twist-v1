/**
 * @file render-sync.ts
 * @description 渲染同步器，将世界中的地图对象同步为 Phaser 可视精灵
 * @dependencies phaser — 渲染引擎；world/world — 定义数据库；world/game-map — 地图数据；
 *               core/types — ObjectKind、ObjectId、MapObjectBase；
 *               features/pawn — Pawn 类型；sprite-registry — 精灵映射管理
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, ObjectId, MapObjectBase } from '../../core/types';
import type { Pawn } from '../../features/pawn/pawn.types';
import { SpriteRegistry } from './sprite-registry';

/** 地图格子像素大小 */
const TILE_SIZE = 32;

/**
 * 渲染同步器类 — 负责将世界状态映射为可视化精灵
 *
 * 职责：
 * 1. 首次加载时渲染地形和网格（fullSync）
 * 2. 每帧同步对象精灵：创建新精灵、更新位置、移除已销毁的精灵
 * 3. 根据对象类型选择不同的视觉表示（圆形=棋子、三角形=树、矩形=其他）
 */
export class RenderSync {
  // ── 引用 ──
  /** Phaser 场景 */
  private scene: Phaser.Scene;
  /** 游戏世界（用于访问定义数据库获取颜色等） */
  private world: World;
  /** 当前地图 */
  private map: GameMap;
  /** 精灵注册表 */
  private spriteRegistry: SpriteRegistry;

  // ── 静态渲染层 ──
  /** 地形渲染图形对象 */
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  /** 网格线渲染图形对象 */
  private gridGraphics!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, world: World, map: GameMap) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.spriteRegistry = new SpriteRegistry();
  }

  /** 完整同步 — 渲染地形、网格，然后同步所有对象精灵 */
  fullSync(): void {
    this.renderTerrain();
    this.renderGrid();
    this.sync();
  }

  /** 渲染地形层 — 根据地形定义为每个格子填充对应颜色 */
  private renderTerrain(): void {
    if (this.terrainGraphics) this.terrainGraphics.destroy();
    this.terrainGraphics = this.scene.add.graphics();
    this.terrainGraphics.setDepth(0);

    this.map.terrain.forEach((x, y, defId) => {
      const def = this.world.defs.terrains.get(defId);
      const color = (def?.passable !== false) ? 0x4a7c3f : (def?.color ?? 0x333333);
      this.terrainGraphics.fillStyle(color, 1);
      this.terrainGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }

  /** 渲染网格线层 — 绘制半透明黑色网格线 */
  private renderGrid(): void {
    if (this.gridGraphics) this.gridGraphics.destroy();
    this.gridGraphics = this.scene.add.graphics();
    this.gridGraphics.setDepth(1);
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
  }

  /**
   * 每帧同步 — 创建/更新/移除精灵以匹配当前世界对象状态
   *
   * 操作：
   * 1. 遍历所有对象，为新对象创建精灵，为现有对象更新位置
   * 2. 移除已不在对象池中的精灵（已销毁/已移除的对象）
   */
  sync(): void {
    const seen = new Set<ObjectId>();

    // 同步所有对象
    for (const obj of this.map.objects.all()) {
      seen.add(obj.id);

      if (obj.destroyed) continue;

      let sprite = this.spriteRegistry.get(obj.id);
      if (!sprite) {
        sprite = this.createSprite(obj);
        this.spriteRegistry.set(obj.id, sprite);
      }
      this.updateSprite(sprite, obj);
    }

    // 移除已销毁/已移除对象的精灵
    for (const [id, sprite] of this.spriteRegistry.entries()) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.spriteRegistry.delete(id);
      }
    }
  }

  /**
   * 为地图对象创建对应的 Phaser 精灵
   *
   * @param obj - 地图对象
   * @returns 创建的游戏对象（棋子=圆形+名字容器，树=三角形，其他=矩形）
   */
  private createSprite(obj: MapObjectBase): Phaser.GameObjects.GameObject {
    const size = this.getSpriteSize(obj);
    const color = this.getSpriteColor(obj);
    const depth = this.getDepth(obj);
    const cx = obj.cell.x * TILE_SIZE + size.w / 2;
    const cy = obj.cell.y * TILE_SIZE + size.h / 2;

    // 棋子：圆形 + 名字标签的容器
    if (obj.kind === ObjectKind.Pawn) {
      const pawn = obj as unknown as Pawn;
      const container = this.scene.add.container(cx, cy);
      const circle = this.scene.add.arc(0, 0, 12, 0, 360, false, color);
      circle.setStrokeStyle(1, 0x000000, 0.5);
      const nameText = this.scene.add.text(0, -20, pawn.name, {
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
      });
      nameText.setOrigin(0.5, 0.5);
      container.add([circle, nameText]);
      container.setDepth(depth);
      return container;
    }

    // 树：三角形
    if (obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
      const margin = 4;
      const w = size.w - margin * 2;
      const h = size.h - margin * 2;
      // Triangle vertices relative to (0,0) center of tile
      const tri = this.scene.add.triangle(
        cx, cy,
        w / 2, h / 2,   // bottom-right
        0, -h / 2,       // top-center
        -w / 2, h / 2,   // bottom-left
        color,
      );
      tri.setStrokeStyle(1, 0x000000, 0.3);
      tri.setDepth(depth);
      return tri;
    }

    // 默认：矩形
    const rect = this.scene.add.rectangle(cx, cy, size.w - 2, size.h - 2, color);
    rect.setDepth(depth);
    rect.setStrokeStyle(1, 0x000000, 0.3);
    return rect;
  }

  /**
   * 更新精灵位置以匹配对象当前格子坐标
   *
   * @param sprite - 需要更新的游戏对象
   * @param obj - 对应的地图对象
   */
  private updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase): void {
    const size = this.getSpriteSize(obj);
    const cx = obj.cell.x * TILE_SIZE + size.w / 2;
    const cy = obj.cell.y * TILE_SIZE + size.h / 2;

    if (sprite instanceof Phaser.GameObjects.Container) {
      sprite.setPosition(cx, cy);
    } else if (sprite instanceof Phaser.GameObjects.Triangle) {
      sprite.setPosition(cx, cy);
    } else if (sprite instanceof Phaser.GameObjects.Rectangle) {
      sprite.setPosition(cx, cy);
      sprite.setFillStyle(this.getSpriteColor(obj));
    }
  }

  /**
   * 获取对象的精灵像素尺寸（基于 footprint）
   *
   * @param obj - 地图对象
   * @returns 宽高对象 { w, h }，单位为像素
   */
  private getSpriteSize(obj: MapObjectBase): { w: number; h: number } {
    const fp = obj.footprint ?? { width: 1, height: 1 };
    return { w: fp.width * TILE_SIZE, h: fp.height * TILE_SIZE };
  }

  /**
   * 根据对象类型和定义获取对应的渲染颜色
   *
   * @param obj - 地图对象
   * @returns 16 进制颜色值
   */
  private getSpriteColor(obj: MapObjectBase): number {
    switch (obj.kind) {
      case ObjectKind.Pawn:
        return 0x4fc3f7; // light blue
      case ObjectKind.Building: {
        const bDef = this.world.defs.buildings.get(obj.defId);
        return bDef?.color ?? 0x888888;
      }
      case ObjectKind.Item: {
        const iDef = this.world.defs.items.get(obj.defId);
        return iDef?.color ?? 0xcccccc;
      }
      case ObjectKind.Plant: {
        const pDef = this.world.defs.plants.get(obj.defId);
        return pDef?.color ?? 0x22aa22;
      }
      case ObjectKind.Fire:
        return 0xff4500;
      case ObjectKind.Corpse:
        return 0x555555;
      case ObjectKind.Blueprint:
        return 0x66aaff;
      case ObjectKind.ConstructionSite:
        return 0xffaa33;
      case ObjectKind.Designation:
        return 0xffffff;
      default:
        return 0xffffff;
    }
  }

  /**
   * 获取对象的渲染深度（z-order）
   *
   * @param obj - 地图对象
   * @returns 深度值，数值越大越靠前
   */
  private getDepth(obj: MapObjectBase): number {
    switch (obj.kind) {
      case ObjectKind.Designation: return 2;
      case ObjectKind.Blueprint: return 3;
      case ObjectKind.Item: return 4;
      case ObjectKind.Plant: return 5;
      case ObjectKind.Building: return 6;
      case ObjectKind.ConstructionSite: return 6;
      case ObjectKind.Fire: return 7;
      case ObjectKind.Pawn: return 8;
      case ObjectKind.Corpse: return 4;
      default: return 5;
    }
  }

  /** 获取精灵注册表实例 */
  getRegistry(): SpriteRegistry {
    return this.spriteRegistry;
  }

  /** 获取格子像素大小 */
  getTileSize(): number {
    return TILE_SIZE;
  }
}

export { TILE_SIZE };
