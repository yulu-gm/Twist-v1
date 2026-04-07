import Phaser from 'phaser';
import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind, cellKey } from '../../core/types';
import { OverlayType, PresentationState } from '../../presentation/presentation-state';

const TILE_SIZE = 32;

/**
 * Debug overlay — renders visual overlays for zones, rooms, paths, etc.
 */
export class DebugOverlay {
  private scene: Phaser.Scene;
  private world: World;
  private map: GameMap;
  private presentation: PresentationState;
  private graphics: Phaser.GameObjects.Graphics;
  private currentOverlay: OverlayType = OverlayType.None;

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
    this.graphics = scene.add.graphics().setDepth(50);
  }

  update(): void {
    const overlay = this.presentation.activeOverlay;
    if (overlay === this.currentOverlay && overlay === OverlayType.None) return;

    this.graphics.clear();
    this.currentOverlay = overlay;

    switch (overlay) {
      case OverlayType.Zones:
        this.renderZones();
        break;
      case OverlayType.Rooms:
        this.renderRooms();
        break;
      case OverlayType.Temperature:
        this.renderTemperature();
        break;
      case OverlayType.Beauty:
        this.renderBeauty();
        break;
      case OverlayType.Pathfinding:
        this.renderPathfinding();
        break;
      case OverlayType.None:
      default:
        break;
    }
  }

  private renderZones(): void {
    const zones = this.map.zones.getAll();
    const colors = [0xFFFF00, 0x00FF00, 0xFF00FF, 0x00FFFF, 0xFF8800];
    let colorIdx = 0;

    for (const zone of zones) {
      const color = colors[colorIdx % colors.length];
      this.graphics.fillStyle(color, 0.25);
      this.graphics.lineStyle(1, color, 0.6);

      for (const key of zone.cells) {
        const [x, y] = key.split(',').map(Number);
        this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
      colorIdx++;
    }
  }

  private renderRooms(): void {
    const rooms = this.map.rooms.rooms;
    const colors = [0xFF4444, 0x44FF44, 0x4444FF, 0xFFFF44, 0xFF44FF, 0x44FFFF];

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (room.isOutdoor) continue; // Skip outdoor

      const color = colors[i % colors.length];
      this.graphics.fillStyle(color, 0.2);

      for (const key of room.cells) {
        const [x, y] = key.split(',').map(Number);
        this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private renderTemperature(): void {
    this.map.temperature.forEach((x, y, temp) => {
      // Blue (cold) → Red (hot): 0°C = blue, 20°C = green, 40°C = red
      const t = Math.max(0, Math.min(1, (temp - 0) / 40));
      const r = Math.floor(t * 255);
      const b = Math.floor((1 - t) * 255);
      const color = (r << 16) | (0 << 8) | b;
      this.graphics.fillStyle(color, 0.3);
      this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }

  private renderBeauty(): void {
    this.map.beauty.forEach((x, y, val) => {
      if (val === 0) return;
      const positive = val > 0;
      const intensity = Math.min(1, Math.abs(val) / 10);
      const color = positive ? 0x00FF00 : 0xFF0000;
      this.graphics.fillStyle(color, intensity * 0.4);
      this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }

  private renderPathfinding(): void {
    // Show passability: red = impassable, transparent = passable
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.map.spatial.isPassable({ x, y })) {
          this.graphics.fillStyle(0xFF0000, 0.3);
          this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Render active pawn paths
    const pawns = this.map.objects.allOfKind(ObjectKind.Pawn);
    this.graphics.lineStyle(2, 0x00FF00, 0.8);
    for (const pawn of pawns) {
      const p = pawn as any;
      if (!p.movement?.path || p.movement.path.length === 0) continue;
      const path = p.movement.path;
      const idx = p.movement.pathIndex ?? 0;

      this.graphics.beginPath();
      this.graphics.moveTo(
        pawn.cell.x * TILE_SIZE + TILE_SIZE / 2,
        pawn.cell.y * TILE_SIZE + TILE_SIZE / 2,
      );
      for (let i = idx; i < path.length; i++) {
        this.graphics.lineTo(
          path[i].x * TILE_SIZE + TILE_SIZE / 2,
          path[i].y * TILE_SIZE + TILE_SIZE / 2,
        );
      }
      this.graphics.strokePath();
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
