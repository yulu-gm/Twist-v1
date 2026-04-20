/**
 * @file camera-controller.ts
 * @description 摄像机控制器，处理摄像机的缩放、平移、WASD 键盘移动和鼠标中键拖拽
 * @dependencies phaser — 摄像机和输入系统；world/game-map — 地图尺寸
 * @part-of adapter/render — 渲染模块
 */

import Phaser from 'phaser';
import type { GameMap } from '../../world/game-map';

/** 地图格子像素大小 */
const TILE_SIZE = 32;
/** WASD 键盘目标速度（像素/秒） */
const SCROLL_SPEED = 900;
/** 键盘按下时的加速平滑系数（越大越跟手） */
const MOVE_ACCEL = 14;
/** 松开按键时的减速平滑系数（越大越快停下） */
const MOVE_DECEL = 12;
/** 最小缩放倍率 */
const ZOOM_MIN = 0.25;
/** 最大缩放倍率 */
const ZOOM_MAX = 3;
/** 每次滚轮缩放的步长 */
const ZOOM_STEP = 0.1;

/**
 * 摄像机控制器类 — 管理主摄像机的所有交互操作
 *
 * 支持的操作：
 * - WASD 键盘：平移摄像机
 * - 鼠标滚轮：缩放摄像机
 * - 鼠标中键拖拽：平移摄像机
 */
export class CameraController {
  /** 主摄像机 */
  private camera: Phaser.Cameras.Scene2D.Camera;
  /** WASD 移动速度向量（像素/秒） */
  private velocity = { x: 0, y: 0 };

  // ── 拖拽状态 ──
  /** 是否正在中键拖拽 */
  private isDragging = false;
  /** 拖拽起始屏幕坐标 */
  private dragStart = { x: 0, y: 0 };

  // ── 键盘按键 ──
  /** WASD 按键引用 */
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, map: GameMap) {
    this.camera = scene.cameras.main;

    // 设置摄像机边界（地图范围 + 2 格余量）
    this.camera.setBounds(
      -TILE_SIZE * 2,
      -TILE_SIZE * 2,
      map.width * TILE_SIZE + TILE_SIZE * 4,
      map.height * TILE_SIZE + TILE_SIZE * 4,
    );

    // 初始位置：居中显示地图
    this.camera.centerOn(
      (map.width * TILE_SIZE) / 2,
      (map.height * TILE_SIZE) / 2,
    );

    // 注册 WASD 键盘按键
    if (scene.input.keyboard) {
      this.wasd = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // 鼠标滚轮缩放
    scene.input.on('wheel', (_pointer: any, _over: any, _dx: number, dy: number) => {
      const newZoom = Phaser.Math.Clamp(
        this.camera.zoom + (dy > 0 ? -ZOOM_STEP : ZOOM_STEP),
        ZOOM_MIN,
        ZOOM_MAX,
      );
      this.camera.setZoom(newZoom);
    });

    // 鼠标中键拖拽平移
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

  /** 每帧更新 — 处理 WASD 键盘平移（含缓动，delta 驱动） */
  update(deltaMs: number): void {
    if (!this.wasd) return;

    const dt = Math.max(0, deltaMs) / 1000;
    if (dt <= 0) return;

    // 键盘方向输入
    let inputX = 0;
    let inputY = 0;
    if (this.wasd.A.isDown) inputX -= 1;
    if (this.wasd.D.isDown) inputX += 1;
    if (this.wasd.W.isDown) inputY -= 1;
    if (this.wasd.S.isDown) inputY += 1;

    // 对角线方向归一化，避免斜向速度更快
    const inputLength = Math.hypot(inputX, inputY);
    if (inputLength > 0) {
      inputX /= inputLength;
      inputY /= inputLength;
    }

    const targetVx = inputX * SCROLL_SPEED;
    const targetVy = inputY * SCROLL_SPEED;
    const smoothing = inputLength > 0 ? MOVE_ACCEL : MOVE_DECEL;
    const lerpFactor = 1 - Math.exp(-smoothing * dt);

    this.velocity.x += (targetVx - this.velocity.x) * lerpFactor;
    this.velocity.y += (targetVy - this.velocity.y) * lerpFactor;

    // 保持既有手感：缩放越大，世界坐标平移步长越小
    const zoomFactor = 1 / Math.max(this.camera.zoom, 0.0001);
    this.camera.scrollX += this.velocity.x * dt * zoomFactor;
    this.camera.scrollY += this.velocity.y * dt * zoomFactor;
  }
}
