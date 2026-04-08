import Phaser from 'phaser';
import type { GameMap } from '../../world/game-map';

const TILE_SIZE = 32;
const SCROLL_SPEED = 10;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const EDGE_SCROLL_MARGIN = 30;

export class CameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private map: GameMap;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, map: GameMap) {
    this.scene = scene;
    this.map = map;
    this.camera = scene.cameras.main;

    // Set camera bounds
    this.camera.setBounds(
      -TILE_SIZE * 2,
      -TILE_SIZE * 2,
      map.width * TILE_SIZE + TILE_SIZE * 4,
      map.height * TILE_SIZE + TILE_SIZE * 4,
    );

    // Center on map
    this.camera.centerOn(
      (map.width * TILE_SIZE) / 2,
      (map.height * TILE_SIZE) / 2,
    );

    // Keyboard
    if (scene.input.keyboard) {
      this.wasd = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Mouse wheel zoom
    scene.input.on('wheel', (_pointer: any, _over: any, _dx: number, dy: number) => {
      const newZoom = Phaser.Math.Clamp(
        this.camera.zoom + (dy > 0 ? -ZOOM_STEP : ZOOM_STEP),
        ZOOM_MIN,
        ZOOM_MAX,
      );
      this.camera.setZoom(newZoom);
    });

    // Middle mouse drag
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isDragging = true;
        this.dragStart.x = pointer.x;
        this.dragStart.y = pointer.y;
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = pointer.x - this.dragStart.x;
        const dy = pointer.y - this.dragStart.y;
        this.camera.scrollX -= dx / this.camera.zoom;
        this.camera.scrollY -= dy / this.camera.zoom;
        this.dragStart.x = pointer.x;
        this.dragStart.y = pointer.y;
      }
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonReleased()) {
        this.isDragging = false;
      }
    });
  }

  update(): void {
    const speed = SCROLL_SPEED / this.camera.zoom;

    if (this.wasd) {
      if (this.wasd.W.isDown) this.camera.scrollY -= speed;
      if (this.wasd.S.isDown) this.camera.scrollY += speed;
      if (this.wasd.A.isDown) this.camera.scrollX -= speed;
      if (this.wasd.D.isDown) this.camera.scrollX += speed;
    }
  }
}
