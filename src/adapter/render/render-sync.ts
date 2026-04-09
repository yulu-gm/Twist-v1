/**
 * @file render-sync.ts
 * @description 渲染同步器，将世界中的地图对象同步为 Phaser 可视精灵。
 *              使用 Container 分层架构管理渲染层序，terrain 使用 dirty flag 避免无谓重绘。
 * @dependencies phaser — 渲染引擎；world/world — 定义数据库；world/game-map — 地图数据；
 *               core/types — ObjectKind、ObjectId、MapObjectBase；
 *               features/pawn — Pawn 类型；sprite-registry — 精灵映射管理；
 *               core/seeded-random — 确定性随机（地表装饰用）
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, ObjectId, MapObjectBase, CellCoord } from '../../core/types';
import type { Pawn } from '../../features/pawn/pawn.types';
import { SpriteRegistry } from './sprite-registry';
import { SeededRandom } from '../../core/seeded-random';

/** 地图格子像素大小 */
const TILE_SIZE = 32;

/** 渲染层名称与 depth 映射 */
const LAYER_DEPTH = {
  terrain: 0,
  grid: 1,
  designation: 2,
  item: 3,
  plant: 4,
  building: 5,
  pawn: 6,
  worldUI: 7,
} as const;

type LayerName = keyof typeof LAYER_DEPTH;

/** ObjectKind → Container 层映射 */
function kindToLayer(kind: ObjectKind): LayerName {
  switch (kind) {
    case ObjectKind.Designation: return 'designation';
    case ObjectKind.Item: return 'item';
    case ObjectKind.Plant: return 'plant';
    case ObjectKind.Building: return 'building';
    case ObjectKind.Blueprint: return 'building';
    case ObjectKind.ConstructionSite: return 'building';
    case ObjectKind.Fire: return 'building';
    case ObjectKind.Corpse: return 'item';
    case ObjectKind.Pawn: return 'pawn';
    default: return 'building';
  }
}

// ── 颜色工具函数 ──

/** 将 0xRRGGBB 整数拆分为 {r, g, b} (0-255) */
function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

/** 将 {r, g, b} 合并为 0xRRGGBB 整数 */
function rgbToHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

/** 对颜色按比例缩放亮度（factor < 1 变暗，> 1 变亮） */
function scaleColor(hex: number, factor: number): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, Math.max(0, Math.round(r * factor))),
    Math.min(255, Math.max(0, Math.round(g * factor))),
    Math.min(255, Math.max(0, Math.round(b * factor))),
  );
}

/** Pawn 朝向（纯渲染概念，不属于 Simulation 层） */
type Direction = 'up' | 'down' | 'left' | 'right';

/** 朝向对应的旋转角度（弧度） */
const DIRECTION_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * 渲染同步器类 — 负责将世界状态映射为可视化精灵
 *
 * 职责：
 * 1. 管理有序 Container 渲染层（terrain → grid → … → worldUI）
 * 2. 首次加载时渲染地形和网格（fullSync）
 * 3. 每帧同步对象精灵：创建新精灵、更新位置、移除已销毁的精灵
 * 4. 根据对象类型选择不同的视觉表示
 */
export class RenderSync {
  // ── 引用 ──
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;
  private spriteRegistry: SpriteRegistry;

  // ── 分层 Container ──
  private layers = new Map<LayerName, Phaser.GameObjects.Container>();

  // ── 静态渲染 ──
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private terrainDirty = true;
  private showGrid = false;

  // ── 确定性随机（仅用于渲染装饰，不影响 simulation rng） ──
  private renderRng: SeededRandom;

  // ── Pawn 朝向（纯渲染状态） ──
  private facingMap = new Map<ObjectId, Direction>();

  // ── Pawn 任务进度条 ──
  private progressBars = new Map<ObjectId, Phaser.GameObjects.Graphics>();

  // ── tick 间插值进度 ──
  private currentTickProgress = 0;

  constructor(scene: Phaser.Scene, world: World, map: GameMap) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.spriteRegistry = new SpriteRegistry();
    this.renderRng = new SeededRandom(42);
    this.createLayers();
  }

  // ── 公开 API ──

  /** 完整同步 — 渲染地形、网格，然后同步所有对象精灵 */
  fullSync(): void {
    this.terrainDirty = true;
    this.sync();
  }

  /**
   * 每帧同步 — 按需重绘地形，创建/更新/移除精灵
   * @param tickProgress - tick 进度 [0,1)，用于帧间插值平滑移动
   */
  sync(tickProgress = 0): void {
    this.currentTickProgress = tickProgress;
    // 地形脏检查
    if (this.terrainDirty) {
      this.renderTerrain();
      this.terrainDirty = false;
    }

    const seen = new Set<ObjectId>();

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
        this.facingMap.delete(id);
        const bar = this.progressBars.get(id);
        if (bar) {
          bar.destroy();
          this.progressBars.delete(id);
        }
      }
    }
  }

  /** 标记地形需要重绘（采矿等改变地形后调用） */
  markTerrainDirty(): void {
    this.terrainDirty = true;
  }

  /** 切换网格线显示 */
  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.gridGraphics.setVisible(show);
  }

  /** 获取世界空间 UI 层（供 WorldPreview、进度条等使用） */
  getWorldUILayer(): Phaser.GameObjects.Container {
    return this.layers.get('worldUI')!;
  }

  getRegistry(): SpriteRegistry { return this.spriteRegistry; }
  getTileSize(): number { return TILE_SIZE; }

  // ── 内部实现 ──

  /** 创建有序渲染层 */
  private createLayers(): void {
    for (const [name, depth] of Object.entries(LAYER_DEPTH)) {
      const container = this.scene.add.container(0, 0);
      container.setDepth(depth);
      this.layers.set(name as LayerName, container);
    }
  }

  /** 将 Phaser 对象添加到对应的渲染层 */
  private addToLayer(layerName: LayerName, obj: Phaser.GameObjects.GameObject): void {
    this.layers.get(layerName)!.add(obj);
  }

  // ── 地形渲染 ──

  /** 渲染地形层 — 带颜色变体、边缘暗线和散落装饰 */
  private renderTerrain(): void {
    if (this.terrainGraphics) this.terrainGraphics.destroy();
    this.terrainGraphics = this.scene.add.graphics();
    this.addToLayer('terrain', this.terrainGraphics);

    // 为每个格子使用确定性随机（基于坐标种子，不消耗 world.rng）
    this.map.terrain.forEach((x, y, defId) => {
      const def = this.world.defs.terrains.get(defId);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      // 基于坐标的确定性随机偏移
      const cellSeed = x * 7919 + y * 6271 + 1009;
      const cellRng = new SeededRandom(cellSeed);

      // ── 可开采岩石：先画草地底色，再叠加不规则多边形岩石 ──
      if (def?.mineable) {
        // 底色用草地
        const grassBase = 0x4a7c3f;
        const grassVar = 1 + (cellRng.next() - 0.5) * 0.1;
        this.terrainGraphics.fillStyle(scaleColor(grassBase, grassVar), 1);
        this.terrainGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // 不规则多边形岩石
        const rockColor = def.color ?? 0x666666;
        const rockVar = 1 + (cellRng.next() - 0.5) * 0.12;
        const baseRock = scaleColor(rockColor, rockVar);
        const m = 2; // 边距
        // 生成 8 个顶点的不规则多边形（沿矩形边缘随机偏移）
        const pts: { x: number; y: number }[] = [];
        // 上边 3 点
        pts.push({ x: px + m + cellRng.nextInt(0, 3), y: py + m + cellRng.nextInt(0, 3) });
        pts.push({ x: px + TILE_SIZE / 2 + cellRng.nextInt(-2, 2), y: py + m + cellRng.nextInt(0, 2) });
        pts.push({ x: px + TILE_SIZE - m - cellRng.nextInt(0, 3), y: py + m + cellRng.nextInt(0, 3) });
        // 右边 1 点
        pts.push({ x: px + TILE_SIZE - m - cellRng.nextInt(0, 2), y: py + TILE_SIZE / 2 + cellRng.nextInt(-2, 2) });
        // 下边 3 点
        pts.push({ x: px + TILE_SIZE - m - cellRng.nextInt(0, 3), y: py + TILE_SIZE - m - cellRng.nextInt(0, 3) });
        pts.push({ x: px + TILE_SIZE / 2 + cellRng.nextInt(-2, 2), y: py + TILE_SIZE - m - cellRng.nextInt(0, 2) });
        pts.push({ x: px + m + cellRng.nextInt(0, 3), y: py + TILE_SIZE - m - cellRng.nextInt(0, 3) });
        // 左边 1 点
        pts.push({ x: px + m + cellRng.nextInt(0, 2), y: py + TILE_SIZE / 2 + cellRng.nextInt(-2, 2) });

        // 填充岩石主体
        this.terrainGraphics.fillStyle(baseRock, 1);
        this.terrainGraphics.beginPath();
        this.terrainGraphics.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          this.terrainGraphics.lineTo(pts[i].x, pts[i].y);
        }
        this.terrainGraphics.closePath();
        this.terrainGraphics.fillPath();

        // 高光线（左上方向的棱面）
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

        // 裂纹（深色线段）
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

      // 基础色变体 (±5%)
      const variation = 1 + (cellRng.next() - 0.5) * 0.1;
      const fillColor = scaleColor(baseColor, variation);

      this.terrainGraphics.fillStyle(fillColor, 1);
      this.terrainGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      // 边缘暗线（底边 + 右边，1px）
      const edgeColor = scaleColor(baseColor, 0.85);
      this.terrainGraphics.fillStyle(edgeColor, 1);
      // 底边
      this.terrainGraphics.fillRect(x * TILE_SIZE, (y + 1) * TILE_SIZE - 1, TILE_SIZE, 1);
      // 右边
      this.terrainGraphics.fillRect((x + 1) * TILE_SIZE - 1, y * TILE_SIZE, 1, TILE_SIZE);

      // 散落装饰（仅可通行地形，约 12% 概率）
      if (def?.passable !== false && cellRng.chance(0.12)) {
        const dotColor = cellRng.chance(0.5) ? scaleColor(baseColor, 0.7) : scaleColor(baseColor, 1.15);
        this.terrainGraphics.fillStyle(dotColor, 0.6);
        const dotX = x * TILE_SIZE + cellRng.nextInt(4, TILE_SIZE - 4);
        const dotY = y * TILE_SIZE + cellRng.nextInt(4, TILE_SIZE - 4);
        this.terrainGraphics.fillCircle(dotX, dotY, cellRng.nextInt(1, 2));
      }
    });

    // 网格线（单独 Graphics，可开关）
    this.renderGrid();
  }

  /** 渲染网格线层 — 默认隐藏，F8 切换 */
  private renderGrid(): void {
    if (this.gridGraphics) this.gridGraphics.destroy();
    this.gridGraphics = this.scene.add.graphics();
    this.addToLayer('grid', this.gridGraphics);
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

  // ── 精灵创建 ──

  /**
   * 为地图对象创建对应的 Phaser 精灵并加入正确的渲染层
   */
  private createSprite(obj: MapObjectBase): Phaser.GameObjects.GameObject {
    const color = this.getSpriteColor(obj);
    const layer = kindToLayer(obj.kind);
    const cx = obj.cell.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = obj.cell.y * TILE_SIZE + TILE_SIZE / 2;

    // ── 殖民者：圆形 + 名字标签 ──
    if (obj.kind === ObjectKind.Pawn) {
      return this.createPawnSprite(obj as unknown as Pawn, cx, cy, color, layer);
    }

    // ── 树：底部对齐三角形 ──
    if (obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
      return this.createTreeSprite(obj, cx, cy, color, layer);
    }

    // ── 非树植物：灌木丛/作物/草 ──
    if (obj.kind === ObjectKind.Plant) {
      return this.createPlantSprite(obj, cx, cy, color, layer);
    }

    // ── 物品：小矩形 + 堆叠数 + 投影 ──
    if (obj.kind === ObjectKind.Item) {
      return this.createItemSprite(obj, cx, cy, color, layer);
    }

    // ── 默认：矩形 ──
    const size = this.getSpriteSize(obj);
    const rect = this.scene.add.rectangle(cx, cy, size.w - 2, size.h - 2, color);
    rect.setStrokeStyle(1, 0x000000, 0.3);
    this.addToLayer(layer, rect);
    return rect;
  }

  /** 创建殖民者精灵：圆形 + 名字标签 + 朝向指示器的 Container */
  private createPawnSprite(
    pawn: Pawn, cx: number, cy: number, color: number, layer: LayerName,
  ): Phaser.GameObjects.Container {
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

    // 朝向指示器：小三角形，沿圆形边缘指示方向
    const indicator = this.scene.add.triangle(12, 0, 0, -3, 6, 0, 0, 3, 0xffffff);
    indicator.setAlpha(0.8);

    container.add([circle, nameText, indicator]);
    this.addToLayer(layer, container);

    // 创建进度条（加入 worldUI 层，初始隐藏）
    const progressBar = this.scene.add.graphics();
    progressBar.setVisible(false);
    this.addToLayer('worldUI', progressBar);
    this.progressBars.set(pawn.id, progressBar);

    return container;
  }

  /** 创建树精灵：底部对齐的三角形，支持 growthProgress 缩放和颜色变体 */
  private createTreeSprite(
    obj: MapObjectBase, cx: number, _cy: number, baseColor: number, layer: LayerName,
  ): Phaser.GameObjects.Triangle {
    // 确定性颜色变体
    const idNum = parseInt(obj.id.replace(/\D/g, '') || '0', 10);
    const colorRng = new SeededRandom(idNum + 3571);
    const colorVariation = 1 + (colorRng.next() - 0.5) * 0.15;
    const color = scaleColor(baseColor, colorVariation);

    // 生长缩放
    const growth = (obj as any).growthProgress ?? 1;
    const scale = 0.5 + growth * 0.5; // 幼苗 50% → 成熟 100%

    const margin = 4;
    const baseW = (TILE_SIZE - margin * 2) * scale;
    const baseH = (TILE_SIZE - margin * 2) * scale;

    // 底部对齐：三角形底边在格子底部
    const bottomY = obj.cell.y * TILE_SIZE + TILE_SIZE;  // 格子底边 y
    const centerX = cx;
    const centerY = bottomY - baseH / 2;  // 三角形中心

    // 使用正值坐标定义顶点，然后用 setOrigin 居中
    const tri = this.scene.add.triangle(
      centerX, centerY,
      0, 0,                      // 左下
      baseW, 0,                  // 右下
      baseW / 2, -baseH,         // 顶部中心
      color,
    );
    tri.setOrigin(0.5, 0.5);
    tri.setStrokeStyle(1, 0x000000, 0.3);
    this.addToLayer(layer, tri);
    return tri;
  }

  /** 创建非树植物精灵：灌木丛/作物/草 */
  private createPlantSprite(
    obj: MapObjectBase, cx: number, cy: number, baseColor: number, layer: LayerName,
  ): Phaser.GameObjects.GameObject {
    const idNum = parseInt(obj.id.replace(/\D/g, '') || '0', 10);
    const rng = new SeededRandom(idNum + 7727);
    const growth = (obj as any).growthProgress ?? 1;
    const scale = 0.4 + growth * 0.6; // 幼苗 40% → 成熟 100%

    const g = this.scene.add.graphics();
    g.setPosition(cx, cy);

    if (obj.tags.has('grass')) {
      // ── 草：2-3 条从底部散开的细弧线 ──
      const color = scaleColor(baseColor, 1 + (rng.next() - 0.5) * 0.2);
      const bladeCount = 2 + (rng.nextInt(0, 1));
      g.lineStyle(1.5, color, 0.9);
      for (let i = 0; i < bladeCount; i++) {
        const baseX = rng.nextFloat(-4, 4);
        const angle = rng.nextFloat(-0.5, 0.5); // 散开角度
        const h = (8 + rng.nextInt(0, 5)) * scale;
        g.beginPath();
        g.moveTo(baseX, 6);
        g.lineTo(baseX + angle * h, 6 - h);
        g.strokePath();
      }
    } else if (obj.tags.has('crop')) {
      // ── 作物：茎 + 顶部穗/叶 ──
      const stemColor = scaleColor(baseColor, 0.7);
      const headColor = scaleColor(baseColor, 1 + (rng.next() - 0.5) * 0.15);
      const stemH = (10 + rng.nextInt(0, 4)) * scale;
      const headW = (4 + rng.nextInt(0, 2)) * scale;
      const headH = (3 + rng.nextInt(0, 2)) * scale;

      // 茎
      g.lineStyle(1.5, stemColor, 0.9);
      g.beginPath();
      g.moveTo(0, 6);
      g.lineTo(0, 6 - stemH);
      g.strokePath();

      // 穗（椭圆）
      g.fillStyle(headColor, 0.9);
      g.fillEllipse(0, 6 - stemH - headH / 2, headW, headH);

      // 叶（两侧各一片小线段）
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
    } else {
      // ── 灌木/浆果丛：3 个小圆组成丛簇 ──
      const colorVar = 1 + (rng.next() - 0.5) * 0.15;
      const color = scaleColor(baseColor, colorVar);
      const r = (4 + rng.nextInt(0, 2)) * scale;
      const offsets = [
        { x: rng.nextFloat(-3, -1), y: rng.nextFloat(-1, 2) },
        { x: rng.nextFloat(1, 3), y: rng.nextFloat(-1, 2) },
        { x: rng.nextFloat(-1, 1), y: rng.nextFloat(-4, -2) },
      ];

      // 丛簇圆形
      g.fillStyle(color, 0.85);
      for (const off of offsets) {
        g.fillCircle(off.x * scale, off.y * scale, r);
      }
      // 轮廓
      g.lineStyle(1, scaleColor(color, 0.6), 0.5);
      for (const off of offsets) {
        g.strokeCircle(off.x * scale, off.y * scale, r);
      }

      // 果实小点（harvestable 且有成熟度时）
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

    this.addToLayer(layer, g);
    return g;
  }

  /** 创建物品精灵：小矩形 + 堆叠数标签 + 投影的 Container */
  private createItemSprite(
    obj: MapObjectBase, cx: number, cy: number, color: number, layer: LayerName,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(cx, cy);

    // 投影椭圆
    const shadow = this.scene.add.ellipse(0, 5, 10, 4, 0x000000, 0.2);
    container.add(shadow);

    // 小矩形主体
    const rect = this.scene.add.rectangle(0, 0, 14, 14, color);
    rect.setStrokeStyle(1, scaleColor(color, 0.6), 1);
    container.add(rect);

    // 堆叠数标签
    const stackCount = (obj as any).stackCount ?? 1;
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

    this.addToLayer(layer, container);
    return container;
  }

  // ── 精灵更新 ──

  /** 更新精灵位置和动态属性 */
  private updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase): void {
    // ── Pawn 平滑移动插值 + 朝向更新 ──
    if (obj.kind === ObjectKind.Pawn) {
      const pawnPos = this.getPawnRenderPosition(obj);
      if (sprite instanceof Phaser.GameObjects.Container) {
        sprite.setPosition(pawnPos.x, pawnPos.y);

        // 更新朝向指示器
        const facing = this.inferFacing(obj);
        this.facingMap.set(obj.id, facing);
        const indicator = sprite.list[2] as Phaser.GameObjects.Triangle | undefined;
        if (indicator) {
          const angle = DIRECTION_ANGLE[facing];
          // 指示器沿圆形边缘定位（半径 12）
          indicator.setPosition(Math.cos(angle) * 12, Math.sin(angle) * 12);
          indicator.setRotation(angle);
        }

        // 更新任务进度条
        this.updateProgressBar(obj, pawnPos);
      }
      return;
    }

    const cx = obj.cell.x * TILE_SIZE + TILE_SIZE / 2;

    // 树的 y 轴特殊处理（底部对齐）
    if (obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
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

    // 非树植物（Graphics）：位置更新
    if (obj.kind === ObjectKind.Plant && sprite instanceof Phaser.GameObjects.Graphics) {
      sprite.setPosition(cx, obj.cell.y * TILE_SIZE + TILE_SIZE / 2);
      return;
    }

    const cy = obj.cell.y * TILE_SIZE + TILE_SIZE / 2;

    if (sprite instanceof Phaser.GameObjects.Container) {
      sprite.setPosition(cx, cy);

      // 物品：更新堆叠数标签
      if (obj.kind === ObjectKind.Item) {
        const stackCount = (obj as any).stackCount ?? 1;
        // Container 内部: [shadow, rect, countText?]
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
    } else if (sprite instanceof Phaser.GameObjects.Triangle) {
      sprite.setPosition(cx, cy);
    } else if (sprite instanceof Phaser.GameObjects.Rectangle) {
      sprite.setPosition(cx, cy);
      sprite.setFillStyle(this.getSpriteColor(obj));
    }
  }

  // ── Pawn 渲染位置计算 ──

  /**
   * 计算 Pawn 的渲染位置（支持格子间平滑插值）
   *
   * 使用 prevCell → cell 插值 + currentTickProgress 实现帧间平滑移动。
   * 当 Pawn 刚移动到新格子时，prevCell 记录了上一个位置，
   * 利用 tick 进度在两者之间线性插值。
   */
  private getPawnRenderPosition(obj: MapObjectBase): { x: number; y: number } {
    const pawn = obj as any;
    const mv = pawn.movement;

    // 有 prevCell 且仍在移动中（有路径），进行平滑插值
    if (mv?.prevCell && mv.path?.length > 0) {
      const t = this.currentTickProgress;
      return {
        x: (mv.prevCell.x + (obj.cell.x - mv.prevCell.x) * t) * TILE_SIZE + TILE_SIZE / 2,
        y: (mv.prevCell.y + (obj.cell.y - mv.prevCell.y) * t) * TILE_SIZE + TILE_SIZE / 2,
      };
    }

    // 静止或刚到达：定位到 cell 中心
    return {
      x: obj.cell.x * TILE_SIZE + TILE_SIZE / 2,
      y: obj.cell.y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  // ── Pawn 任务进度条 ──

  /** 更新 Pawn 头顶的任务进度条 */
  private updateProgressBar(obj: MapObjectBase, pos: { x: number; y: number }): void {
    const bar = this.progressBars.get(obj.id);
    if (!bar) return;

    const progress = this.getToilProgress(obj);
    if (!progress) {
      bar.setVisible(false);
      return;
    }

    bar.setVisible(true);
    bar.clear();

    const barW = 20;
    const barH = 3;
    const x = pos.x - barW / 2;
    const y = pos.y - 22; // 头顶上方

    // 背景
    bar.fillStyle(0x333333, 0.8);
    bar.fillRect(x, y, barW, barH);

    // 填充
    const ratio = Math.min(progress.current / progress.total, 1);
    bar.fillStyle(0x44cc44, 1);
    bar.fillRect(x, y, barW * ratio, barH);
  }

  /** 读取 Pawn 当前 toil 的进度（Work/Wait/Interact） */
  private getToilProgress(obj: MapObjectBase): { current: number; total: number } | null {
    const pawn = obj as any;
    const job = pawn.ai?.currentJob;
    if (!job) return null;

    const toil = job.toils?.[job.currentToilIndex];
    if (!toil || toil.state !== 'in_progress') return null;

    switch (toil.type) {
      case 'work':
        return { current: toil.localData.workDone ?? 0, total: toil.localData.totalWork ?? 100 };
      case 'wait':
        return { current: toil.localData.waited ?? 0, total: toil.localData.waitTicks ?? 60 };
      case 'interact':
        return { current: toil.localData.interacted ?? 0, total: toil.localData.interactTicks ?? 30 };
      default:
        return null;
    }
  }

  // ── Pawn 朝向推导 ──

  /**
   * 推导 Pawn 朝向 — 纯渲染逻辑，不修改 Simulation 数据
   *
   * 优先级：正在移动 > 正在工作/交互 > 保持上次朝向 > 默认朝下
   */
  private inferFacing(obj: MapObjectBase): Direction {
    const pawn = obj as any;
    const mv = pawn.movement;

    // 正在移动：根据当前格和目标格的方向差
    if (mv?.path?.length > 0 && mv.pathIndex < mv.path.length) {
      const next = mv.path[mv.pathIndex];
      return this.directionFrom(obj.cell, next);
    }

    // 执行 Work/Interact：根据 toil.targetCell 和 pawn.cell 的方向差
    const job = pawn.ai?.currentJob;
    if (job) {
      const toil = job.toils?.[job.currentToilIndex];
      if (toil?.targetCell && (toil.type === 'work' || toil.type === 'interact')) {
        return this.directionFrom(obj.cell, toil.targetCell);
      }
    }

    // 保持上次朝向（或默认朝下）
    return this.facingMap.get(obj.id) ?? 'down';
  }

  /** 根据两格子坐标差计算朝向 */
  private directionFrom(from: CellCoord, to: CellCoord): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  // ── 工具方法 ──

  private getSpriteSize(obj: MapObjectBase): { w: number; h: number } {
    const fp = obj.footprint ?? { width: 1, height: 1 };
    return { w: fp.width * TILE_SIZE, h: fp.height * TILE_SIZE };
  }

  private getSpriteColor(obj: MapObjectBase): number {
    switch (obj.kind) {
      case ObjectKind.Pawn:
        return 0x4fc3f7;
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
}

export { TILE_SIZE };
