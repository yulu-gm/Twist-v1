/**
 * @file selection-highlight.ts
 * @description 选中高亮渲染 — 在选中的地图对象周围绘制高亮矩形边框
 * @dependencies phaser — 渲染引擎；presentation — 展示状态；render-utils — 像素计算
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import type { PresentationState } from '../../presentation/presentation-state';
import type { GameMap } from '../../world/game-map';
import type { ObjectId } from '../../core/types';
import { getObjectPixelCenter, getSpriteSize, LAYER_DEPTH } from './render-utils';

/** 选中高亮样式常量 */
const SELECTION = {
  /** 边框颜色（白色） */
  strokeColor: 0xffffff,
  /** 边框宽度 */
  strokeWidth: 2,
  /** 边框透明度 */
  strokeAlpha: 0.9,
  /** 填充颜色（白色） */
  fillColor: 0xffffff,
  /** 填充透明度（极淡） */
  fillAlpha: 0.08,
} as const;

/** 选中高亮深度：建筑层(5)之上、pawn层(6)之下 */
const SELECTION_DEPTH = LAYER_DEPTH.building + 0.5;

/**
 * 选中高亮类 — 管理选中对象的高亮矩形
 *
 * 独立于 ObjectRenderer 体系，遵循 WorldPreview 的覆盖层模式：
 * 每帧读取 PresentationState.selectedObjectIds，diff-based 创建/更新/移除矩形。
 */
export class SelectionHighlight {
  private scene: Phaser.Scene;
  private map: GameMap;

  /** 按对象 ID 存储的高亮矩形 */
  private highlightRects: Map<ObjectId, Phaser.GameObjects.Rectangle> = new Map();

  constructor(scene: Phaser.Scene, map: GameMap) {
    this.scene = scene;
    this.map = map;
  }

  /**
   * 每帧更新 — 根据选中状态同步高亮矩形
   *
   * 逻辑：
   * 1. 对 selectedObjectIds 中的每个 ID，查找对象并创建/更新矩形
   * 2. 移除不再选中的矩形
   */
  update(presentation: PresentationState): void {
    const selectedIds = presentation.selectedObjectIds;

    // 创建/更新选中对象的高亮矩形
    for (const id of selectedIds) {
      const obj = this.map.objects.get(id);
      if (!obj || obj.destroyed) {
        // 对象不存在或已销毁，移除残留矩形
        const existing = this.highlightRects.get(id);
        if (existing) {
          existing.destroy();
          this.highlightRects.delete(id);
        }
        continue;
      }

      const center = getObjectPixelCenter(obj.cell, obj.footprint);
      const size = getSpriteSize(obj);
      const existing = this.highlightRects.get(id);

      if (existing) {
        // 更新已有矩形的位置
        existing.setPosition(center.x, center.y);
      } else {
        // 创建新矩形
        const rect = this.scene.add
          .rectangle(center.x, center.y, size.w, size.h, SELECTION.fillColor, SELECTION.fillAlpha)
          .setStrokeStyle(SELECTION.strokeWidth, SELECTION.strokeColor, SELECTION.strokeAlpha)
          .setDepth(SELECTION_DEPTH);
        this.highlightRects.set(id, rect);
      }
    }

    // 移除不再选中的矩形
    for (const [id, rect] of this.highlightRects) {
      if (!selectedIds.has(id)) {
        rect.destroy();
        this.highlightRects.delete(id);
      }
    }
  }
}
