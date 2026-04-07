import Phaser from 'phaser';
import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { CellCoord, ObjectKind, DesignationType, SimSpeed } from '../../core/types';
import { PresentationState, ToolType, OverlayType } from '../../presentation/presentation-state';

const TILE_SIZE = 32;

export class InputHandler {
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;
  private presentation: PresentationState;
  private selectedBuildingDefId: string | null = null;
  private designationType: DesignationType = DesignationType.Mine;

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

    this.setupInputs();
  }

  private setupInputs(): void {
    // Left click
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;

      const cell = this.pointerToCell(pointer);
      if (!cell) return;

      switch (this.presentation.activeTool) {
        case ToolType.Select:
          this.handleSelect(cell);
          break;
        case ToolType.Build:
          this.handleBuild(cell);
          break;
        case ToolType.Designate:
          this.handleDesignate(cell);
          break;
      }
    });

    // Keyboard shortcuts
    if (this.scene.input.keyboard) {
      const kb = this.scene.input.keyboard;

      // Speed controls
      kb.on('keydown-SPACE', () => {
        this.world.commandQueue.push({
          type: 'set_speed',
          payload: { speed: this.world.speed === SimSpeed.Paused ? SimSpeed.Normal : SimSpeed.Paused },
        });
      });
      kb.on('keydown-ONE', () => {
        this.world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Normal } });
      });
      kb.on('keydown-TWO', () => {
        this.world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Fast } });
      });
      kb.on('keydown-THREE', () => {
        this.world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.UltraFast } });
      });

      // Tool shortcuts
      kb.on('keydown-ESC', () => {
        this.presentation.activeTool = ToolType.Select;
        this.presentation.placementPreview = null;
        this.presentation.selectedObjectIds.clear();
        this.selectedBuildingDefId = null;
      });
      kb.on('keydown-B', () => {
        this.presentation.activeTool = ToolType.Build;
        this.selectedBuildingDefId = 'wall_wood';
      });
      kb.on('keydown-M', () => {
        this.presentation.activeTool = ToolType.Designate;
        this.designationType = DesignationType.Mine;
      });
      kb.on('keydown-H', () => {
        this.presentation.activeTool = ToolType.Designate;
        this.designationType = DesignationType.Harvest;
      });
      kb.on('keydown-X', () => {
        this.presentation.activeTool = ToolType.Designate;
        this.designationType = DesignationType.Cut;
      });

      // Debug: F1 toggle debug panel
      kb.on('keydown-F1', () => {
        this.presentation.showDebugPanel = !this.presentation.showDebugPanel;
      });

      // Overlay toggles: F2-F6
      kb.on('keydown-F2', () => {
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Zones ? OverlayType.None : OverlayType.Zones;
      });
      kb.on('keydown-F3', () => {
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Rooms ? OverlayType.None : OverlayType.Rooms;
      });
      kb.on('keydown-F4', () => {
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Temperature ? OverlayType.None : OverlayType.Temperature;
      });
      kb.on('keydown-F5', (event: KeyboardEvent) => {
        event.preventDefault(); // prevent browser refresh
        this.presentation.activeOverlay =
          this.presentation.activeOverlay === OverlayType.Pathfinding ? OverlayType.None : OverlayType.Pathfinding;
      });

      // Save/Load: F6 save, F7 load
      kb.on('keydown-F6', () => {
        this.world.commandQueue.push({ type: 'save_game', payload: {} });
      });
      kb.on('keydown-F7', () => {
        this.world.commandQueue.push({ type: 'load_game', payload: {} });
      });
    }
  }

  private pointerToCell(pointer: Phaser.Input.Pointer): CellCoord | null {
    const cam = this.scene.cameras.main;
    const worldX = (pointer.x + cam.scrollX * cam.zoom) / cam.zoom;
    const worldY = (pointer.y + cam.scrollY * cam.zoom) / cam.zoom;
    const x = Math.floor(worldX / TILE_SIZE);
    const y = Math.floor(worldY / TILE_SIZE);

    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return null;
    return { x, y };
  }

  private handleSelect(cell: CellCoord): void {
    this.presentation.selectedObjectIds.clear();
    const objectIds = this.map.spatial.getAt(cell);
    for (const id of objectIds) {
      this.presentation.selectedObjectIds.add(id);
    }
  }

  private handleBuild(cell: CellCoord): void {
    if (!this.selectedBuildingDefId) return;
    this.world.commandQueue.push({
      type: 'place_blueprint',
      payload: { defId: this.selectedBuildingDefId, cell, rotation: 0 },
    });
  }

  private handleDesignate(cell: CellCoord): void {
    switch (this.designationType) {
      case DesignationType.Mine:
        this.world.commandQueue.push({
          type: 'designate_mine',
          payload: { cell },
        });
        break;
      case DesignationType.Harvest: {
        const objIds = this.map.spatial.getAt(cell);
        for (const id of objIds) {
          const obj = this.map.objects.get(id);
          if (obj && obj.kind === ObjectKind.Plant) {
            this.world.commandQueue.push({
              type: 'designate_harvest',
              payload: { targetId: id },
            });
          }
        }
        break;
      }
      case DesignationType.Cut: {
        const objIds = this.map.spatial.getAt(cell);
        for (const id of objIds) {
          const obj = this.map.objects.get(id);
          if (obj && obj.kind === ObjectKind.Plant && obj.tags.has('tree')) {
            this.world.commandQueue.push({
              type: 'designate_cut',
              payload: { targetId: id },
            });
          }
        }
        break;
      }
    }
  }

  update(): void {
    // Update hovered cell
    const pointer = this.scene.input.activePointer;
    this.presentation.hoveredCell = this.pointerToCell(pointer);

    // Update placement preview
    if (this.presentation.activeTool === ToolType.Build && this.selectedBuildingDefId && this.presentation.hoveredCell) {
      const cell = this.presentation.hoveredCell;
      const isPassable = this.map.spatial.isPassable(cell);
      this.presentation.placementPreview = {
        defId: this.selectedBuildingDefId,
        cell,
        rotation: 0,
        valid: isPassable,
      };
    } else {
      this.presentation.placementPreview = null;
    }
  }

  setSelectedBuilding(defId: string): void {
    this.selectedBuildingDefId = defId;
    this.presentation.activeTool = ToolType.Build;
  }

  setDesignationType(type: DesignationType): void {
    this.designationType = type;
    this.presentation.activeTool = ToolType.Designate;
  }
}
