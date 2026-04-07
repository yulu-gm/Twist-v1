import Phaser from 'phaser';

const UI_DEPTH = 100;
const PANEL_BG = 0x1a1a2e;
const PANEL_ALPHA = 0.9;
const TEXT_COLOR = '#e0e0e0';

/**
 * Toolbar — bottom bar showing keyboard shortcuts.
 */
export class Toolbar {
  private bg: Phaser.GameObjects.Rectangle;
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
