import Phaser from "phaser";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.75;

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

  public constructor(private readonly scene: Phaser.Scene) {}

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
    if (!pointer.middleButtonDown()) return;
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
    const newZoom = Phaser.Math.Clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (newZoom === oldZoom) return;

    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
    cam.setZoom(newZoom);
    const after = cam.getWorldPoint(pointer.x, pointer.y);
    cam.scrollX += worldPoint.x - after.x;
    cam.scrollY += worldPoint.y - after.y;
  }
}
