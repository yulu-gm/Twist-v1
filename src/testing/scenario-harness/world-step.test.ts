/**
 * @file world-step.test.ts
 * @description 验证 advanceWorldTick 的核心行为：递增 tick、执行系统、分发并清空事件缓冲
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '@defs/index';
import { createWorld } from '@world/world';
import { createGameMap } from '@world/game-map';
import { advanceWorldTick, processWorldCommands } from '../../bootstrap/world-step';
import { registerDefaultCommands } from '../../bootstrap/default-registrations';
import { SimSpeed } from '../../core/types';

describe('advanceWorldTick', () => {
  it('会递增 tick、执行 tickRunner，并清空已分发的事件缓冲', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'test', width: 8, height: 8 });
    world.maps.set(map.id, map);

    let executed = 0;

    world.tickRunner.register({
      id: 'test-system',
      phase: 0,
      frequency: 1,
      execute: (w: any) => {
        executed += 1;
        w.eventBuffer.push({ type: 'test_event', tick: w.tick, data: { executed } });
      },
    });

    const dispatched: string[] = [];
    advanceWorldTick(world, {
      dispatchEvents(events) {
        dispatched.push(...events.map((event: any) => event.type));
      },
    });

    expect(world.tick).toBe(1);
    expect(executed).toBe(1);
    expect(dispatched).toEqual(['test_event']);
    expect(world.eventBuffer).toEqual([]);
  });

  it('can process queued commands without advancing the simulation tick', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 2 });
    const map = createGameMap({ id: 'test', width: 8, height: 8 });
    world.maps.set(map.id, map);
    registerDefaultCommands(world);
    world.speed = SimSpeed.Paused;
    world.commandQueue.push({ type: 'set_speed', payload: { speed: SimSpeed.Normal } });

    const dispatched: string[] = [];

    processWorldCommands(world, {
      dispatchEvents(events) {
        dispatched.push(...events.map((event: any) => event.type));
      },
    });

    expect(world.tick).toBe(0);
    expect(world.speed).toBe(SimSpeed.Normal);
    expect(dispatched).toEqual(['speed_changed']);
    expect(world.commandQueue).toEqual([]);
    expect(world.eventBuffer).toEqual([]);
  });
});
