/**
 * @file world-preview.ts
 * @description 世界空间预览渲染 — 在游戏地图上显示建筑放置和指派操作的预览矩形
 * @dependencies phaser — 渲染引擎；presentation — 展示状态
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import { PresentationState } from '../../presentation/presentation-state';

/** 地图格子像素大小 */
const TILE_SIZE = 32;

/** 预览颜色统一常量 */
const PREVIEW = {
  validFill: 0x00ff00,
  validFillAlpha: 0.2,
  validStroke: 0x00ff00,
  invalidFill: 0xff0000,
  invalidFillAlpha: 0.2,
  invalidStroke: 0xff0000,
  strokeWidth: 2,
} as const;

/**
 * 世界空间预览类 — 管理建筑放置和指派操作的可视化预览
 *
 * 这些预览存在于世界坐标空间中，随摄像机缩放/平移移动，
 * 因此必须由 Phaser 渲染而非 DOM。
 */
export class WorldPreview {
  private scene: Phaser.Scene;

  /** 建筑放置预览矩形 */
  private previewRect: Phaser.GameObjects.Rectangle | null = null;
  /** 指派预览矩形 */
  private designationRect: Phaser.GameObjects.Rectangle | null = null;
  /** 拖拽预览 Graphics */
  private dragGraphics: Phaser.GameObjects.Graphics | null = null;
  /** 区域预览 Graphics */
  private zoneGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 每帧更新 — 根据展示状态显示/隐藏/定位预览矩形
   */
  update(presentation: PresentationState): void {
    // 建筑放置预览
    if (presentation.placementPreview) {
      const pp = presentation.placementPreview;
      const fill = pp.valid ? PREVIEW.validFill : PREVIEW.invalidFill;
      const fillAlpha = pp.valid ? PREVIEW.validFillAlpha : PREVIEW.invalidFillAlpha;
      const stroke = pp.valid ? PREVIEW.validStroke : PREVIEW.invalidStroke;
      if (!this.previewRect) {
        this.previewRect = this.scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, fill, fillAlpha)
          .setDepth(50).setStrokeStyle(PREVIEW.strokeWidth, stroke);
      }
      this.previewRect.setPosition(pp.cell.x * TILE_SIZE + TILE_SIZE / 2, pp.cell.y * TILE_SIZE + TILE_SIZE / 2);
      this.previewRect.setFillStyle(fill, fillAlpha);
      this.previewRect.setStrokeStyle(PREVIEW.strokeWidth, stroke);
      this.previewRect.setVisible(true);
    } else if (this.previewRect) {
      this.previewRect.setVisible(false);
    }

    // 指派预览
    if (presentation.designationPreview) {
      const dp = presentation.designationPreview;
      const fill = dp.valid ? PREVIEW.validFill : PREVIEW.invalidFill;
      const fillAlpha = dp.valid ? PREVIEW.validFillAlpha : PREVIEW.invalidFillAlpha;
      const stroke = dp.valid ? PREVIEW.validStroke : PREVIEW.invalidStroke;
      if (!this.designationRect) {
        this.designationRect = this.scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, fill, fillAlpha)
          .setDepth(50);
      }
      this.designationRect.setFillStyle(fill, fillAlpha);
      this.designationRect.setStrokeStyle(PREVIEW.strokeWidth, stroke);
      this.designationRect.setPosition(dp.cell.x * TILE_SIZE + TILE_SIZE / 2, dp.cell.y * TILE_SIZE + TILE_SIZE / 2);
      this.designationRect.setVisible(true);
    } else if (this.designationRect) {
      this.designationRect.setVisible(false);
    }

    // 区域预览：区域工具和取消工具都可能对区域产生彩色预览
    if (presentation.zonePreview) {
      this.renderZonePreview(presentation);
      if (this.dragGraphics) {
        this.dragGraphics.clear();
      }
    } else if (this.zoneGraphics) {
      this.zoneGraphics.clear();
    }

    // 拖拽选框预览
    if (!presentation.zonePreview && presentation.dragRect) {
      if (!this.dragGraphics) {
        this.dragGraphics = this.scene.add.graphics().setDepth(50);
      }
      this.dragGraphics.clear();
      const { startCell, endCell } = presentation.dragRect;
      const minX = Math.min(startCell.x, endCell.x);
      const maxX = Math.max(startCell.x, endCell.x);
      const minY = Math.min(startCell.y, endCell.y);
      const maxY = Math.max(startCell.y, endCell.y);

      // 半透明填充
      this.dragGraphics.fillStyle(0xffffff, 0.1);
      this.dragGraphics.fillRect(
        minX * TILE_SIZE, minY * TILE_SIZE,
        (maxX - minX + 1) * TILE_SIZE, (maxY - minY + 1) * TILE_SIZE,
      );

      // 白色边框
      this.dragGraphics.lineStyle(2, 0xffffff, 0.8);
      this.dragGraphics.strokeRect(
        minX * TILE_SIZE, minY * TILE_SIZE,
        (maxX - minX + 1) * TILE_SIZE, (maxY - minY + 1) * TILE_SIZE,
      );
    } else if (this.dragGraphics) {
      this.dragGraphics.clear();
    }
  }

  private renderZonePreview(presentation: PresentationState): void {
    const zonePreview = presentation.zonePreview;
    if (!zonePreview) {
      if (this.zoneGraphics) {
        this.zoneGraphics.clear();
      }
      return;
    }

    if (!this.zoneGraphics) {
      this.zoneGraphics = this.scene.add.graphics().setDepth(50);
    }

    this.zoneGraphics.clear();

    const validSet = new Set(zonePreview.validCells.map((cell) => `${cell.x},${cell.y}`));
    const validFill = zonePreview.mode === 'erase' ? 0xffb300 : PREVIEW.validFill;
    const validStroke = zonePreview.mode === 'erase' ? 0xffb300 : PREVIEW.validStroke;

    for (const cell of zonePreview.cells) {
      const isValid = validSet.has(`${cell.x},${cell.y}`);
      const fill = isValid ? validFill : PREVIEW.invalidFill;
      const fillAlpha = isValid ? 0.18 : 0.16;
      const stroke = isValid ? validStroke : PREVIEW.invalidStroke;

      this.zoneGraphics.fillStyle(fill, fillAlpha);
      this.zoneGraphics.lineStyle(PREVIEW.strokeWidth, stroke, 0.9);
      this.zoneGraphics.fillRect(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.zoneGraphics.strokeRect(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}
