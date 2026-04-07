import Phaser from "phaser";

/** 与默认 48px 格、原 0.4 最小缩放等价的屏幕格边最小像素（可读性下限）。 */
const BASELINE_CELL_PX = 48;
const MIN_CELL_SCREEN_PX = 0.4 * BASELINE_CELL_PX;
/** 与默认 48px 格、原 2.75 最大缩放等价的屏幕格边最大像素（避免单格过大挤压 HUD）。 */
const MAX_CELL_SCREEN_PX = 2.75 * BASELINE_CELL_PX;

function zoomLimitsForCellSize(cellSizePx: number): { minZoom: number; maxZoom: number } {
  const cs = Math.max(1, cellSizePx);
  let minZ = MIN_CELL_SCREEN_PX / cs;
  let maxZ = MAX_CELL_SCREEN_PX / cs;
  minZ = Phaser.Math.Clamp(minZ, 0.15, 2.5);
  maxZ = Phaser.Math.Clamp(maxZ, 1.05, 5);
  if (minZ >= maxZ) {
    maxZ = Math.min(5, minZ * 1.1);
  }
  return { minZoom: minZ, maxZoom: maxZ };
}

function isMiddleButton(pointer: Phaser.Input.Pointer): boolean {
  if (pointer.middleButtonDown()) return true;
  const ev = pointer.event as MouseEvent | PointerEvent | undefined;
  return ev?.button === 1;
}

/**
 * 主相机：中键拖拽平移、滚轮以指针为中心缩放（与左键地板框选互不干扰）。
 */
export class GameSceneCameraControls {
  private panPointerId: number | null = null;
  private panStartScreenX = 0;
  private panStartScreenY = 0;
  private panStartScrollX = 0;
  private panStartScrollY = 0;
  private readonly minZoom: number;
  private readonly maxZoom: number;

  public constructor(
    private readonly scene: Phaser.Scene,
    cellSizePx: number
  ) {
    const { minZoom, maxZoom } = zoomLimitsForCellSize(cellSizePx);
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  public bind(): void {
    const input = this.scene.input;
    if (input.mouse) {
      input.mouse.preventDefaultWheel = true;
    }
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }

  public unbind(): void {
    this.endPan();
    const input = this.scene.input;
    if (input.mouse) {
      input.mouse.preventDefaultWheel = false;
    }
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!isMiddleButton(pointer)) return;
    pointer.event?.preventDefault?.();
    const cam = this.scene.cameras.main;
    this.panPointerId = pointer.id;
    this.panStartScreenX = pointer.x;
    this.panStartScreenY = pointer.y;
    this.panStartScrollX = cam.scrollX;
    this.panStartScrollY = cam.scrollY;
    this.scene.input.setDefaultCursor("grabbing");
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.panPointerId !== pointer.id || !pointer.isDown) return;
    if (!isMiddleButton(pointer)) return;
    const cam = this.scene.cameras.main;
    const z = cam.zoom;
    const dx = pointer.x - this.panStartScreenX;
    const dy = pointer.y - this.panStartScreenY;
    cam.setScroll(this.panStartScrollX - dx / z, this.panStartScrollY - dy / z);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.panPointerId !== pointer.id) return;
    this.endPan();
  }

  private endPan(): void {
    if (this.panPointerId === null) return;
    this.panPointerId = null;
    this.scene.input.setDefaultCursor("");
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
    _deltaZ: number
  ): void {
    const cam = this.scene.cameras.main;
    const oldZoom = cam.zoom;
    const factor = deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Phaser.Math.Clamp(oldZoom * factor, this.minZoom, this.maxZoom);
    if (newZoom === oldZoom) return;

    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
    cam.setZoom(newZoom);
    const after = cam.getWorldPoint(pointer.x, pointer.y);
    cam.scrollX += worldPoint.x - after.x;
    cam.scrollY += worldPoint.y - after.y;
  }
}
