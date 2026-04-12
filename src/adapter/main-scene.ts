/**
 * @file main-scene.ts
 * @description Phaser 主场景，负责游戏循环的 tick 推进、系统执行和渲染同步
 * @dependencies phaser — 渲染引擎；world/world — 游戏世界；core/types — SimSpeed；
 *               core/clock — 时钟推进；render/* — 渲染同步和摄像机；
 *               input/* — 输入处理；debug/* — 调试工具；
 *               presentation — 展示层状态
 * @part-of adapter — 适配器层
 */

import Phaser from 'phaser';
import { World } from '../world/world';
import type { GameMap } from '../world/game-map';
import { SimSpeed } from '../core/types';
import { log } from '../core/logger';
import { RenderSync } from './render/render-sync';
import { CameraController } from './render/camera-controller';
import { InputHandler } from './input/input-handler';
import { WorldPreview } from './render/world-preview';
import { SelectionHighlight } from './render/selection-highlight';
import { DebugOverlay } from './debug/debug-overlay';
import { installDebugConsole } from './debug/console';
import { createPresentationState, PresentationState } from '../presentation/presentation-state';
import type { EngineSnapshotBridge } from '../ui/kernel/ui-bridge';
import { advanceWorldTick, processWorldCommands } from '../bootstrap/world-step';

/** 基础 tick 间隔（毫秒），1x 速度下每 100ms 执行一次 tick */
const TICK_MS = 100; // base tick interval at 1x

/**
 * 主场景类 — Phaser 的核心场景
 *
 * 职责：
 * 1. 初始化所有子系统（渲染、输入、UI、调试）
 * 2. 在 update 循环中按速度倍率累积时间并执行 tick
 * 3. 每帧同步渲染状态
 */
export class MainScene extends Phaser.Scene {
  // ── 核心引用 ──
  /** 游戏世界状态 */
  world: World;
  /** 展示层状态：存储选中、悬停、预览等 UI 状态 */
  presentation!: PresentationState;
  /** 当前激活的地图 */
  activeMap!: GameMap;

  // ── 子系统 ──
  /** 渲染同步器：将世界对象同步为 Phaser 精灵 */
  private renderSync!: RenderSync;
  /** 摄像机控制器：处理缩放、平移、键盘/鼠标移动 */
  private cameraController!: CameraController;
  /** 输入处理器：处理鼠标点击和键盘快捷键 */
  private inputHandler!: InputHandler;
  /** 世界空间预览：建筑放置和指派预览矩形 */
  private worldPreview!: WorldPreview;
  /** 选中高亮：在选中对象周围绘制高亮矩形 */
  private selectionHighlight!: SelectionHighlight;
  /** 调试覆盖层：渲染区域/房间/温度等可视化 */
  private debugOverlay!: DebugOverlay;

  // ── tick 累积器 ──
  /** 累积的帧间隔时间（毫秒），达到 TICK_MS 时消耗并执行 tick */
  private accumulator = 0;
  /** Preact UI 桥接：每帧发射快照供 UI 渲染 */
  private uiBridge: EngineSnapshotBridge | null;
  /** 上一帧的 showGrid 值，用于检测变化 */
  private prevShowGrid = false;

  constructor(world: World, uiBridge?: EngineSnapshotBridge) {
    super({ key: 'MainScene' });
    this.world = world;
    this.uiBridge = uiBridge ?? null;
  }

  /**
   * 场景创建回调 — 初始化所有子系统
   *
   * 操作：获取首个地图 → 创建展示状态 → 初始化渲染/摄像机/输入/调试 →
   *       安装调试控制台 → 执行首次完整渲染
   */
  create(): void {
    // 获取第一张地图
    const mapEntry = this.world.maps.entries().next();
    if (!mapEntry.done) {
      this.activeMap = mapEntry.value[1];
    } else {
      throw new Error('No maps in world');
    }

    this.presentation = createPresentationState();
    this.renderSync = new RenderSync(this, this.world, this.activeMap);
    this.cameraController = new CameraController(this, this.activeMap);
    this.inputHandler = new InputHandler(this, this.world, this.activeMap, this.presentation);
    this.worldPreview = new WorldPreview(this);
    this.selectionHighlight = new SelectionHighlight(this, this.activeMap);
    this.debugOverlay = new DebugOverlay(this, this.world, this.activeMap, this.presentation);

    // 安装调试控制台（window.opus）
    installDebugConsole(this.world, this.activeMap);

    // 首次完整渲染
    this.renderSync.fullSync();

    // 监听地形变化事件（采矿完成后需要重绘地形）
    this.world.eventBus.on('designation_completed', () => {
      this.renderSync.markTerrainDirty();
    });

    log.info('general', 'Game scene created');
  }

  /**
   * 每帧更新回调 — 执行 tick 循环和渲染同步
   *
   * @param _time - 当前时间戳（未使用）
   * @param delta - 距上一帧的毫秒数
   *
   * 操作：
   * 1. 始终更新输入/UI/调试（即使暂停）
   * 2. 暂停时直接返回
   * 3. 按速度倍率累积 delta，每达到 TICK_MS 执行一次 tick
   * 4. 每帧最多执行 maxTicksPerFrame 次 tick 防止死亡螺旋
   * 5. 同步渲染状态
   */
  update(_time: number, delta: number): void {
    // 始终更新输入和 UI（即使暂停时也需响应操作）
    this.inputHandler.update();
    this.worldPreview.update(this.presentation);
    this.selectionHighlight.update(this.presentation);
    this.debugOverlay.update();

    // 通知 Preact UI 桥接发射新快照
    if (this.uiBridge) this.uiBridge.emit();

    // 网格线开关同步
    if (this.presentation.showGrid !== this.prevShowGrid) {
      this.renderSync.setShowGrid(this.presentation.showGrid);
      this.prevShowGrid = this.presentation.showGrid;
    }

    if (this.world.speed === SimSpeed.Paused) {
      if (this.world.commandQueue.length > 0) {
        processWorldCommands(this.world);
        this.renderSync.sync(0);
      }
      return;
    }

    // 根据速度计算倍率：Normal=1x, Fast=2x, UltraFast=3x
    const multiplier = this.world.speed === SimSpeed.Normal ? 1
      : this.world.speed === SimSpeed.Fast ? 2 : 3;

    this.accumulator += delta * multiplier;

    let ticksThisFrame = 0;
    const maxTicksPerFrame = 10; // 防止死亡螺旋：每帧最多执行 10 次 tick

    while (this.accumulator >= TICK_MS && ticksThisFrame < maxTicksPerFrame) {
      log.setTick(this.world.tick + 1);

      // 使用共享的 tick 推进函数
      advanceWorldTick(this.world);

      this.accumulator -= TICK_MS;
      ticksThisFrame++;
    }

    // 同步渲染状态（将世界对象变化反映到精灵）
    const tickProgress = Math.min(this.accumulator / TICK_MS, 1);
    this.renderSync.sync(tickProgress);
  }
}
