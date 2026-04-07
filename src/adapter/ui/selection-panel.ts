import Phaser from 'phaser';
import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { PresentationState } from '../../presentation/presentation-state';

const UI_DEPTH = 100;
const PANEL_BG = 0x1a1a2e;
const PANEL_ALPHA = 0.9;
const TEXT_COLOR = '#e0e0e0';
const FONT_SIZE = '14px';

/**
 * SelectionPanel — displays info about currently selected objects.
 */
export class SelectionPanel {
  private bg: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private map: GameMap;
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
