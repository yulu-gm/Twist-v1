/**
 * @file debug-overlay.ts
 * @description 调试覆盖层，在地图上渲染区域、房间、温度、美观度和寻路等可视化信息
 * @dependencies phaser — 渲染引擎；world/world — 世界状态；world/game-map — 地图数据；
 *               core/types — ObjectKind、cellKey；presentation — 覆盖层类型枚举
 * @part-of adapter/debug — 调试工具模块
 */

import Phaser from 'phaser';
import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, cellKey } from '../../core/types';
import { OverlayType, PresentationState } from '../../presentation/presentation-state';
import type { Pawn } from '../../features/pawn/pawn.types';

/** 地图格子像素大小 */
const TILE_SIZE = 32;

/**
 * 调试覆盖层类 — 根据展示状态中的 activeOverlay 选择渲染模式
 *
 * 支持的覆盖类型：
 * - Zones: 用不同颜色高亮显示各区域的格子
 * - Rooms: 用不同颜色高亮显示各房间（跳过室外）
 * - Temperature: 用蓝→红渐变显示温度分布
 * - Beauty: 用绿/红显示正/负美观度
 * - Pathfinding: 红色标记不可通行格子，绿色线条显示棋子当前路径
 */
export class DebugOverlay {
  // ── 引用 ──
  /** Phaser 场景引用 */
  private scene: Phaser.Scene;
  /** 游戏世界状态 */
  private world: World;
  /** 当前地图 */
  private map: GameMap;
  /** 展示层状态（读取 activeOverlay） */
  private presentation: PresentationState;

  // ── 渲染对象 ──
  /** 用于绘制覆盖图形的 Graphics 对象 */
  private graphics: Phaser.GameObjects.Graphics;
  /** 当前正在显示的覆盖类型（用于变化检测） */
  private currentOverlay: OverlayType = OverlayType.None;

  constructor(
    scene: Phaser.Scene,
    world: World,
    map: GameMap,
    presentation: PresentationState,
  ) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.presentation = presentation;
    this.graphics = scene.add.graphics().setDepth(50);
  }

  /**
   * 每帧更新 — 检测覆盖类型变化，清除旧图形并绘制新覆盖
   *
   * 当覆盖类型未变且为 None 时跳过绘制以节省性能
   */
  update(): void {
    const overlay = this.presentation.activeOverlay;
    if (overlay === this.currentOverlay && overlay === OverlayType.None) return;

    this.graphics.clear();
    this.currentOverlay = overlay;

    switch (overlay) {
      case OverlayType.Zones:
        this.renderZones();
        break;
      case OverlayType.Rooms:
        this.renderRooms();
        break;
      case OverlayType.Temperature:
        this.renderTemperature();
        break;
      case OverlayType.Beauty:
        this.renderBeauty();
        break;
      case OverlayType.Pathfinding:
        this.renderPathfinding();
        break;
      case OverlayType.None:
      default:
        break;
    }
  }

  /** 渲染区域覆盖 — 每个区域使用不同颜色，半透明填充+边框 */
  private renderZones(): void {
    const zones = this.map.zones.getAll();
    const colors = [0xFFFF00, 0x00FF00, 0xFF00FF, 0x00FFFF, 0xFF8800];
    let colorIdx = 0;

    for (const zone of zones) {
      const color = colors[colorIdx % colors.length];
      this.graphics.fillStyle(color, 0.25);
      this.graphics.lineStyle(1, color, 0.6);

      for (const key of zone.cells) {
        const [x, y] = key.split(',').map(Number);
        this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
      colorIdx++;
    }
  }

  /** 渲染房间覆盖 — 每个室内房间使用不同颜色，跳过室外区域 */
  private renderRooms(): void {
    const rooms = this.map.rooms.rooms;
    const colors = [0xFF4444, 0x44FF44, 0x4444FF, 0xFFFF44, 0xFF44FF, 0x44FFFF];

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (room.isOutdoor) continue; // Skip outdoor

      const color = colors[i % colors.length];
      this.graphics.fillStyle(color, 0.2);

      for (const key of room.cells) {
        const [x, y] = key.split(',').map(Number);
        this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /** 渲染温度覆盖 — 蓝色(冷, 0°C)→红色(热, 40°C)渐变显示 */
  private renderTemperature(): void {
    this.map.temperature.forEach((x, y, temp) => {
      // Blue (cold) → Red (hot): 0°C = blue, 20°C = green, 40°C = red
      const t = Math.max(0, Math.min(1, (temp - 0) / 40));
      const r = Math.floor(t * 255);
      const b = Math.floor((1 - t) * 255);
      const color = (r << 16) | (0 << 8) | b;
      this.graphics.fillStyle(color, 0.3);
      this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }

  /** 渲染美观度覆盖 — 绿色表示正值，红色表示负值，透明度与强度成正比 */
  private renderBeauty(): void {
    this.map.beauty.forEach((x, y, val) => {
      if (val === 0) return;
      const positive = val > 0;
      const intensity = Math.min(1, Math.abs(val) / 10);
      const color = positive ? 0x00FF00 : 0xFF0000;
      this.graphics.fillStyle(color, intensity * 0.4);
      this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }

  /**
   * 渲染寻路覆盖 — 两部分：
   * 1. 红色半透明标记不可通行格子
   * 2. 绿色线条绘制每个棋子的当前移动路径
   */
  private renderPathfinding(): void {
    // 显示通行性：红色 = 不可通行，透明 = 可通行
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.map.spatial.isPassable({ x, y })) {
          this.graphics.fillStyle(0xFF0000, 0.3);
          this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 绘制棋子的活动移动路径
    const pawns = this.map.objects.allOfKind(ObjectKind.Pawn);
    this.graphics.lineStyle(2, 0x00FF00, 0.8);
    for (const pawn of pawns) {
      const p = pawn as Pawn;
      if (!p.movement?.path || p.movement.path.length === 0) continue;
      const path = p.movement.path;
      const idx = p.movement.pathIndex ?? 0;

      this.graphics.beginPath();
      this.graphics.moveTo(
        pawn.cell.x * TILE_SIZE + TILE_SIZE / 2,
        pawn.cell.y * TILE_SIZE + TILE_SIZE / 2,
      );
      for (let i = idx; i < path.length; i++) {
        this.graphics.lineTo(
          path[i].x * TILE_SIZE + TILE_SIZE / 2,
          path[i].y * TILE_SIZE + TILE_SIZE / 2,
        );
      }
      this.graphics.strokePath();
    }
  }

  /** 销毁覆盖层的 Graphics 对象 */
  destroy(): void {
    this.graphics.destroy();
  }
}
