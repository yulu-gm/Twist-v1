/**
 * @file toolbar.ts
 * @description 底部工具栏 UI 组件，显示键盘快捷键提示
 * @dependencies phaser — UI 渲染
 * @part-of adapter/ui — UI 组件模块
 */

import Phaser from 'phaser';

/** UI 层渲染深度 */
const UI_DEPTH = 100;
/** 面板背景色 */
const PANEL_BG = 0x1a1a2e;
/** 面板背景透明度 */
const PANEL_ALPHA = 0.9;
/** 文本颜色 */
const TEXT_COLOR = '#e0e0e0';

/**
 * 工具栏类 — 屏幕底部的快捷键提示栏
 *
 * 显示所有可用的键盘快捷键标签（选择、建造、采矿、收获、砍伐、暂停、速度、调试）。
 */
export class Toolbar {
  /** 工具栏背景矩形 */
  private bg: Phaser.GameObjects.Rectangle;
  /** 各快捷键标签文本列表 */
  private toolTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    const w = scene.scale.width;
    const h = scene.scale.height;
    this.bg = scene.add.rectangle(w / 2, h - 20, w, 40, PANEL_BG, PANEL_ALPHA)
      .setScrollFactor(0).setDepth(UI_DEPTH);

    const tools = [
      '[ESC] Select',
      '[B] Build Wall',
      '[M] Mine',
      '[H] Harvest',
      '[X] Cut Tree',
      '[SPACE] Pause',
      '[1-3] Speed',
      '[F1] Debug',
    ];

    tools.forEach((label, i) => {
      const text = scene.add.text(10 + i * 130, h - 30, label, {
        fontSize: '12px',
        color: TEXT_COLOR,
      }).setScrollFactor(0).setDepth(UI_DEPTH + 1);
      this.toolTexts.push(text);
    });
  }
}
