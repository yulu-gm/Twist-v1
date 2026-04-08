/**
 * @file speed-controls.ts
 * @description 速度控制栏 UI 组件，在屏幕顶部显示时钟、速度和 tick 信息
 * @dependencies phaser — UI 渲染；world/world — 读取世界速度/tick/时钟；
 *               core/types — SimSpeed；core/clock — 时钟显示格式化
 * @part-of adapter/ui — UI 组件模块
 */

import Phaser from 'phaser';
import type { World } from '../../world/world';
import { SimSpeed } from '../../core/types';
import { getClockDisplay } from '../../core/clock';

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
 * 速度控制栏类 — 屏幕顶部的信息栏
 *
 * 每帧更新显示：游戏时钟（年/季/天/时）、速度倍率、当前 tick 数。
 */
export class SpeedControls {
  // ── UI 元素 ──
  /** 顶栏背景矩形 */
  private bg: Phaser.GameObjects.Rectangle;
  /** 时钟文本 */
  private clockText: Phaser.GameObjects.Text;
  /** 速度文本 */
  private speedText: Phaser.GameObjects.Text;
  /** tick 计数文本 */
  private tickText: Phaser.GameObjects.Text;

  // ── 引用 ──
  /** 游戏世界状态 */
  private world: World;

  constructor(scene: Phaser.Scene, world: World) {
    this.world = world;
    const w = scene.scale.width;
    this.bg = scene.add.rectangle(w / 2, 15, w, 30, PANEL_BG, PANEL_ALPHA)
      .setScrollFactor(0).setDepth(UI_DEPTH);
    this.clockText = scene.add.text(10, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);
    this.speedText = scene.add.text(300, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);
    this.tickText = scene.add.text(450, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);
  }

  /** 每帧更新 — 刷新时钟、速度和 tick 显示文本 */
  update(): void {
    const speedLabels = ['Paused', '1x', '2x', '3x'];
    this.clockText.setText(getClockDisplay(this.world.clock));
    this.speedText.setText(`Speed: ${speedLabels[this.world.speed]}`);
    this.tickText.setText(`Tick: ${this.world.tick}`);
  }
}
