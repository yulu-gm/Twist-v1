/**
 * @file pawn-renderer.ts
 * @description Pawn 对象渲染器 — 创建/更新/插值/朝向/进度条
 * @part-of adapter/render/object-renderers
 */

import Phaser from 'phaser';
import { ObjectKind, ObjectId, MapObjectBase, CellCoord } from '../../../core/types';
import type { Pawn } from '../../../features/pawn/pawn.types';
import { TILE_SIZE, LayerName } from '../render-utils';
import type { ObjectRenderer } from './types';

/** Pawn 朝向（纯渲染概念） */
type Direction = 'up' | 'down' | 'left' | 'right';

/** 朝向对应的旋转角度（弧度） */
const DIRECTION_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * Pawn 渲染器 — 处理殖民者的精灵创建和每帧更新
 *
 * 功能：圆形 + 名字标签 + 朝向指示器、平滑移动插值、任务进度条
 */
export class PawnRenderer implements ObjectRenderer {
  readonly kinds = new Set([ObjectKind.Pawn]);

  private scene: Phaser.Scene;
  private layers: Map<LayerName, Phaser.GameObjects.Container>;

  /** Pawn 朝向缓存（纯渲染状态） */
  private facingMap = new Map<ObjectId, Direction>();
  /** Pawn 任务进度条 */
  private progressBars = new Map<ObjectId, Phaser.GameObjects.Graphics>();
  /** tick 间插值进度 */
  private currentTickProgress = 0;

  constructor(
    scene: Phaser.Scene,
    layers: Map<LayerName, Phaser.GameObjects.Container>,
  ) {
    this.scene = scene;
    this.layers = layers;
  }

  /** 由 RenderSync 每帧调用，设置当前 tick 插值因子 */
  setTickProgress(t: number): void {
    this.currentTickProgress = t;
  }

  createSprite(obj: MapObjectBase, cx: number, cy: number, _color: number): Phaser.GameObjects.Container {
    const pawn = obj as unknown as Pawn;
    const color = 0x4fc3f7;

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

    const indicator = this.scene.add.triangle(12, 0, 0, -3, 6, 0, 0, 3, 0xffffff);
    indicator.setAlpha(0.8);

    container.add([circle, nameText, indicator]);
    this.layers.get('pawn')!.add(container);

    // 创建进度条（加入 worldUI 层，初始隐藏）
    const progressBar = this.scene.add.graphics();
    progressBar.setVisible(false);
    this.layers.get('worldUI')!.add(progressBar);
    this.progressBars.set(pawn.id, progressBar);

    return container;
  }

  updateSprite(sprite: Phaser.GameObjects.GameObject, obj: MapObjectBase, _color: number): void {
    const pawnPos = this.getPawnRenderPosition(obj);
    if (sprite instanceof Phaser.GameObjects.Container) {
      sprite.setPosition(pawnPos.x, pawnPos.y);

      // 更新朝向指示器
      const facing = this.inferFacing(obj);
      this.facingMap.set(obj.id, facing);
      const indicator = sprite.list[2] as Phaser.GameObjects.Triangle | undefined;
      if (indicator) {
        const angle = DIRECTION_ANGLE[facing];
        indicator.setPosition(Math.cos(angle) * 12, Math.sin(angle) * 12);
        indicator.setRotation(angle);
      }

      // 更新任务进度条
      this.updateProgressBar(obj, pawnPos);
    }
  }

  onRemove(objId: string, _sprite: Phaser.GameObjects.GameObject): void {
    this.facingMap.delete(objId);
    const bar = this.progressBars.get(objId);
    if (bar) {
      bar.destroy();
      this.progressBars.delete(objId);
    }
  }

  // ── 渲染位置计算 ──

  private getPawnRenderPosition(obj: MapObjectBase): { x: number; y: number } {
    const pawn = obj as any;
    const mv = pawn.movement;

    if (mv?.prevCell && mv.path?.length > 0) {
      const t = this.currentTickProgress;
      return {
        x: (mv.prevCell.x + (obj.cell.x - mv.prevCell.x) * t) * TILE_SIZE + TILE_SIZE / 2,
        y: (mv.prevCell.y + (obj.cell.y - mv.prevCell.y) * t) * TILE_SIZE + TILE_SIZE / 2,
      };
    }

    return {
      x: obj.cell.x * TILE_SIZE + TILE_SIZE / 2,
      y: obj.cell.y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  // ── 任务进度条 ──

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
    const y = pos.y - 22;

    bar.fillStyle(0x333333, 0.8);
    bar.fillRect(x, y, barW, barH);

    const ratio = Math.min(progress.current / progress.total, 1);
    bar.fillStyle(0x44cc44, 1);
    bar.fillRect(x, y, barW * ratio, barH);
  }

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

  // ── 朝向推导 ──

  private inferFacing(obj: MapObjectBase): Direction {
    const pawn = obj as any;
    const mv = pawn.movement;

    if (mv?.path?.length > 0 && mv.pathIndex < mv.path.length) {
      const next = mv.path[mv.pathIndex];
      return this.directionFrom(obj.cell, next);
    }

    const job = pawn.ai?.currentJob;
    if (job) {
      const toil = job.toils?.[job.currentToilIndex];
      if (toil?.targetCell && (toil.type === 'work' || toil.type === 'interact')) {
        return this.directionFrom(obj.cell, toil.targetCell);
      }
    }

    return this.facingMap.get(obj.id) ?? 'down';
  }

  private directionFrom(from: CellCoord, to: CellCoord): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }
}
