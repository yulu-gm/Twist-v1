/**
 * @file selection-panel.ts
 * @description 选择面板 UI 组件，当玩家选中地图对象时显示对象详情
 * @dependencies phaser — UI 渲染；world/game-map — 地图对象查询；
 *               core/types — ObjectKind；presentation — 选中对象 ID 集合
 * @part-of adapter/ui — UI 组件模块
 */

import Phaser from 'phaser';
import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { PresentationState } from '../../presentation/presentation-state';

/** UI 层渲染深度 */
const UI_DEPTH = 100;
/** 面板背景色 */
const PANEL_BG = 0x1a1a2e;
/** 面板背景透明度 */
const PANEL_ALPHA = 0.9;
/** 文本颜色 */
const TEXT_COLOR = '#e0e0e0';
/** 字体大小 */
const FONT_SIZE = '14px';

/**
 * 选择面板类 — 显示选中对象的详细信息
 *
 * 当 presentation.selectedObjectIds 不为空时显示面板，
 * 展示每个选中对象的类型、ID、位置，以及棋子的额外信息（名称、任务、食物）。
 */
export class SelectionPanel {
  // ── UI 元素 ──
  /** 面板背景矩形 */
  private bg: Phaser.GameObjects.Rectangle;
  /** 信息文本 */
  private text: Phaser.GameObjects.Text;

  // ── 引用 ──
  /** 地图对象（用于查询对象详情） */
  private map: GameMap;
  /** 展示层状态（读取选中对象 ID） */
  private presentation: PresentationState;

  constructor(scene: Phaser.Scene, map: GameMap, presentation: PresentationState) {
    this.map = map;
    this.presentation = presentation;

    const h = scene.scale.height;
    this.bg = scene.add.rectangle(140, h - 140, 260, 180, PANEL_BG, PANEL_ALPHA)
      .setScrollFactor(0).setDepth(UI_DEPTH).setVisible(false);
    this.text = scene.add.text(20, h - 225, '', {
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: 240 },
    }).setScrollFactor(0).setDepth(UI_DEPTH + 1).setVisible(false);
  }

  /** 每帧更新 — 有选中对象时显示面板并填充信息，否则隐藏 */
  update(): void {
    if (this.presentation.selectedObjectIds.size > 0) {
      this.bg.setVisible(true);
      this.text.setVisible(true);
      let info = '';
      for (const id of this.presentation.selectedObjectIds) {
        const obj = this.map.objects.get(id);
        if (!obj) continue;
        info += `[${obj.kind}] ${obj.id}\n`;
        info += `  Def: ${obj.defId}\n`;
        info += `  Cell: (${obj.cell.x}, ${obj.cell.y})\n`;
        if (obj.kind === ObjectKind.Pawn) {
          const pawn = obj as any;
          info += `  Name: ${pawn.name}\n`;
          if (pawn.ai?.currentJob) {
            info += `  Job: ${pawn.ai.currentJob.defId}\n`;
          } else {
            info += `  Job: idle\n`;
          }
          info += `  Food: ${Math.floor(pawn.needs?.food ?? 0)}\n`;
        }
      }
      this.text.setText(info);
    } else {
      this.bg.setVisible(false);
      this.text.setVisible(false);
    }
  }
}
