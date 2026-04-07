import Phaser from 'phaser';
import { World } from '../world/world';
import type { GameMap } from '../world/game-map';
import { SimSpeed } from '../core/types';
import { advanceClock } from '../core/clock';
import { log } from '../core/logger';
import { RenderSync } from './render/render-sync';
import { CameraController } from './render/camera-controller';
import { InputHandler } from './input/input-handler';
import { UIManager } from './ui/ui-manager';
import { DebugOverlay } from './debug/debug-overlay';
import { installDebugConsole } from './debug/console';
import { createPresentationState, PresentationState } from '../presentation/presentation-state';

const TICK_MS = 100; // base tick interval at 1x

export class MainScene extends Phaser.Scene {
  private world: World;
  private activeMap!: GameMap;
  private renderSync!: RenderSync;
  private cameraController!: CameraController;
  private inputHandler!: InputHandler;
  private uiManager!: UIManager;
  private debugOverlay!: DebugOverlay;
  private presentation!: PresentationState;
  private accumulator = 0;

  constructor(world: World) {
    super({ key: 'MainScene' });
    this.world = world;
  }

  create(): void {
    // Get the first map
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
    this.uiManager = new UIManager(this, this.world, this.activeMap, this.presentation);
    this.debugOverlay = new DebugOverlay(this, this.world, this.activeMap, this.presentation);

    // Install debug console (window.opus)
    installDebugConsole(this.world, this.activeMap);

    // Initial render
    this.renderSync.fullSync();

    log.info('general', 'Game scene created');
  }

  update(_time: number, delta: number): void {
    // Always update input and UI (even when paused)
    this.inputHandler.update();
    this.uiManager.update();
    this.debugOverlay.update();

    if (this.world.speed === SimSpeed.Paused) {
      return;
    }

    const multiplier = this.world.speed === SimSpeed.Normal ? 1
      : this.world.speed === SimSpeed.Fast ? 2 : 3;

    this.accumulator += delta * multiplier;

    let ticksThisFrame = 0;
    const maxTicksPerFrame = 10; // prevent spiral of death

    while (this.accumulator >= TICK_MS && ticksThisFrame < maxTicksPerFrame) {
      this.world.tick++;
      log.setTick(this.world.tick);
      advanceClock(this.world.clock);

      // Run all systems
      this.world.tickRunner.executeTick(this.world);

      // Dispatch events
      if (this.world.eventBuffer.length > 0) {
        this.world.eventBus.dispatch(this.world.eventBuffer);
        this.world.eventBuffer = [];
      }

      this.accumulator -= TICK_MS;
      ticksThisFrame++;
    }

    // Render sync
    this.renderSync.sync();
  }
}
