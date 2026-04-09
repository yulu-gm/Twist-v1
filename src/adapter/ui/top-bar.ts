/**
 * @file top-bar.ts
 * @description 顶栏 UI 组件 — 时钟、速度按钮、tick 计数、殖民者数量
 * @part-of adapter/ui
 */

import { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import { getClockDisplay } from '../../core/clock';

/** 顶栏 UI 组件 */
export class TopBarUI {
  private world: World;
  private map: GameMap;

  private clockEl: HTMLElement;
  private pawnCountEl: HTMLElement;
  private tickEl: HTMLElement;
  private speedBtns: HTMLElement[];

  private prevClock = '';
  private prevSpeed = -1;
  private prevTick = -1;
  private prevPawnCount = -1;

  constructor(world: World, map: GameMap) {
    this.world = world;
    this.map = map;

    this.clockEl = document.getElementById('ui-clock')!;
    this.pawnCountEl = document.getElementById('ui-pawn-count')!;
    this.tickEl = document.getElementById('ui-tick')!;
    this.speedBtns = Array.from(document.querySelectorAll('.speed-btn')) as HTMLElement[];

    this.setupSpeedButtons();
  }

  private setupSpeedButtons(): void {
    for (const btn of this.speedBtns) {
      btn.addEventListener('click', (e) => {
        const speed = parseInt(btn.dataset.speed ?? '0', 10);
        this.world.commandQueue.push({
          type: 'set_speed',
          payload: { speed },
        });
        (e.target as HTMLElement).blur();
      });
    }
  }

  update(): void {
    const clockStr = getClockDisplay(this.world.clock);
    if (clockStr !== this.prevClock) {
      this.clockEl.textContent = clockStr;
      this.prevClock = clockStr;
    }

    if (this.world.speed !== this.prevSpeed) {
      for (const btn of this.speedBtns) {
        const btnSpeed = parseInt(btn.dataset.speed ?? '-1', 10);
        btn.classList.toggle('active', btnSpeed === this.world.speed);
      }
      this.prevSpeed = this.world.speed;
    }

    if (this.world.tick !== this.prevTick) {
      this.tickEl.textContent = `T:${this.world.tick}`;
      this.prevTick = this.world.tick;
    }

    const pawnCount = this.map.objects.allOfKind(ObjectKind.Pawn).length;
    if (pawnCount !== this.prevPawnCount) {
      this.pawnCountEl.textContent = `${pawnCount} colonists`;
      this.prevPawnCount = pawnCount;
    }
  }

  destroy(): void {}
}
