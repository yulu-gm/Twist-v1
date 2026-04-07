import Phaser from 'phaser';
import type { World } from '../../world/world';
import { SimSpeed } from '../../core/types';
import { getClockDisplay } from '../../core/clock';

const UI_DEPTH = 100;
const PANEL_BG = 0x1a1a2e;
const PANEL_ALPHA = 0.9;
const TEXT_COLOR = '#e0e0e0';
const FONT_SIZE = '14px';

/**
 * SpeedControls — top bar showing clock, speed, and tick info.
 */
export class SpeedControls {
  private bg: Phaser.GameObjects.Rectangle;
  private clockText: Phaser.GameObjects.Text;
  private speedText: Phaser.GameObjects.Text;
  private tickText: Phaser.GameObjects.Text;
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

  update(): void {
    const speedLabels = ['Paused', '1x', '2x', '3x'];
    this.clockText.setText(getClockDisplay(this.world.clock));
    this.speedText.setText(`Speed: ${speedLabels[this.world.speed]}`);
    this.tickText.setText(`Tick: ${this.world.tick}`);
  }
}
