import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, SimSpeed } from '../../core/types';
import { getClockDisplay } from '../../core/clock';
import { PresentationState, ToolType } from '../../presentation/presentation-state';

const UI_DEPTH = 100;
const PANEL_BG = 0x1a1a2e;
const PANEL_ALPHA = 0.9;
const TEXT_COLOR = '#e0e0e0';
const FONT_SIZE = '14px';

export class UIManager {
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;
  private presentation: PresentationState;

  // Top bar
  private topBarBg!: Phaser.GameObjects.Rectangle;
  private clockText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private tickText!: Phaser.GameObjects.Text;
  private pawnCountText!: Phaser.GameObjects.Text;

  // Bottom toolbar
  private toolbarBg!: Phaser.GameObjects.Rectangle;
  private toolTexts: Phaser.GameObjects.Text[] = [];

  // Selection panel
  private selectionBg!: Phaser.GameObjects.Rectangle;
  private selectionText!: Phaser.GameObjects.Text;

  // Debug panel
  private debugBg!: Phaser.GameObjects.Rectangle;
  private debugText!: Phaser.GameObjects.Text;

  // Placement preview
  private previewRect: Phaser.GameObjects.Rectangle | null = null;

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

    this.createTopBar();
    this.createToolbar();
    this.createSelectionPanel();
    this.createDebugPanel();
  }

  private createTopBar(): void {
    const w = this.scene.scale.width;
    this.topBarBg = this.scene.add.rectangle(w / 2, 15, w, 30, PANEL_BG, PANEL_ALPHA)
      .setScrollFactor(0).setDepth(UI_DEPTH);

    this.clockText = this.scene.add.text(10, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);

    this.speedText = this.scene.add.text(300, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);

    this.tickText = this.scene.add.text(450, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);

    this.pawnCountText = this.scene.add.text(600, 5, '', { fontSize: FONT_SIZE, color: TEXT_COLOR })
      .setScrollFactor(0).setDepth(UI_DEPTH + 1);
  }

  private createToolbar(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.toolbarBg = this.scene.add.rectangle(w / 2, h - 20, w, 40, PANEL_BG, PANEL_ALPHA)
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
      const text = this.scene.add.text(10 + i * 130, h - 30, label, {
        fontSize: '12px',
        color: TEXT_COLOR,
      }).setScrollFactor(0).setDepth(UI_DEPTH + 1);
      this.toolTexts.push(text);
    });
  }

  private createSelectionPanel(): void {
    const h = this.scene.scale.height;
    this.selectionBg = this.scene.add.rectangle(140, h - 140, 260, 180, PANEL_BG, PANEL_ALPHA)
      .setScrollFactor(0).setDepth(UI_DEPTH).setVisible(false);

    this.selectionText = this.scene.add.text(20, h - 225, '', {
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: 240 },
    }).setScrollFactor(0).setDepth(UI_DEPTH + 1).setVisible(false);
  }

  private createDebugPanel(): void {
    const w = this.scene.scale.width;
    this.debugBg = this.scene.add.rectangle(w - 160, 130, 300, 230, PANEL_BG, PANEL_ALPHA)
      .setScrollFactor(0).setDepth(UI_DEPTH).setVisible(false);

    this.debugText = this.scene.add.text(w - 300, 25, '', {
      fontSize: '12px',
      color: TEXT_COLOR,
      lineSpacing: 4,
    }).setScrollFactor(0).setDepth(UI_DEPTH + 1).setVisible(false);
  }

  update(): void {
    // Top bar
    const speedLabels = ['Paused', '1x', '2x', '3x'];
    this.clockText.setText(getClockDisplay(this.world.clock));
    this.speedText.setText(`Speed: ${speedLabels[this.world.speed]}`);
    this.tickText.setText(`Tick: ${this.world.tick}`);

    const pawnCount = this.map.objects.allOfKind(ObjectKind.Pawn).length;
    this.pawnCountText.setText(`Pawns: ${pawnCount}`);

    // Selection panel
    if (this.presentation.selectedObjectIds.size > 0) {
      this.selectionBg.setVisible(true);
      this.selectionText.setVisible(true);
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
      this.selectionText.setText(info);
    } else {
      this.selectionBg.setVisible(false);
      this.selectionText.setVisible(false);
    }

    // Debug panel
    if (this.presentation.showDebugPanel) {
      this.debugBg.setVisible(true);
      this.debugText.setVisible(true);
      const hovered = this.presentation.hoveredCell;
      let dbg = `--- Debug ---\n`;
      dbg += `Tool: ${this.presentation.activeTool}\n`;
      if (hovered) {
        dbg += `Hover: (${hovered.x}, ${hovered.y})\n`;
        const terrain = this.map.terrain.get(hovered.x, hovered.y);
        dbg += `Terrain: ${terrain}\n`;
        const objs = this.map.spatial.getAt(hovered);
        dbg += `Objects: ${objs.length}\n`;
        for (const id of objs) {
          const o = this.map.objects.get(id);
          if (o) dbg += `  ${o.kind}: ${o.id}\n`;
        }
        dbg += `Passable: ${this.map.spatial.isPassable(hovered)}\n`;
      }
      dbg += `Total objects: ${this.map.objects.size}\n`;
      const reservations = this.map.reservations.getAll();
      dbg += `Reservations: ${reservations.length}\n`;
      this.debugText.setText(dbg);
    } else {
      this.debugBg.setVisible(false);
      this.debugText.setVisible(false);
    }

    // Placement preview
    if (this.presentation.placementPreview) {
      const pp = this.presentation.placementPreview;
      if (!this.previewRect) {
        this.previewRect = this.scene.add.rectangle(0, 0, 30, 30, 0x66aaff, 0.5)
          .setDepth(50).setStrokeStyle(2, pp.valid ? 0x00ff00 : 0xff0000);
      }
      this.previewRect.setPosition(pp.cell.x * 32 + 16, pp.cell.y * 32 + 16);
      this.previewRect.setStrokeStyle(2, pp.valid ? 0x00ff00 : 0xff0000);
      this.previewRect.setVisible(true);
    } else if (this.previewRect) {
      this.previewRect.setVisible(false);
    }
  }
}
