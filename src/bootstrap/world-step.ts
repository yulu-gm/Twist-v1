/**
 * @file world-step.ts
 * @description 共享的单 tick 推进函数 — 递增世界 tick、推进时钟、执行系统、分发并清空事件缓冲。
 *              被生产入口 (main-scene) 和测试 harness 共同复用。
 * @dependencies core/clock — 时钟推进；world/world — 世界状态；core/event-bus — 事件类型
 * @part-of bootstrap — 启动/共享基础设施层
 */

import { advanceClock } from '../core/clock';
import type { World } from '../world/world';
import type { GameEvent } from '../core/event-bus';

/** advanceWorldTick 的可选配置 */
interface AdvanceWorldTickOptions {
  /** 自定义事件分发回调 - 在 eventBus.dispatch 之前调用，允许外部收集事件 */
  dispatchEvents?: (events: GameEvent[]) => void;
}

/** 将事件缓冲中的事件分发出去并清空缓冲，若缓冲为空则直接返回 */
function flushWorldEvents(world: World, options: AdvanceWorldTickOptions = {}): void {
  if (world.eventBuffer.length === 0) {
    return;
  }

  const events = [...world.eventBuffer];
  options.dispatchEvents?.(events);
  world.eventBus.dispatch(events);
  world.eventBuffer.length = 0;
}

/** 处理当前命令队列，但不推进 tick 或模拟时钟。 */
export function processWorldCommands(world: World, options: AdvanceWorldTickOptions = {}): void {
  world.commandBus.processQueue(world);
  flushWorldEvents(world, options);
}

/**
 * 推进世界一个 tick
 *
 * 操作顺序：
 * 1. tick 计数 +1
 * 2. 推进模拟时钟（小时/天/季节/年）
 * 3. 执行所有已注册系统（按阶段顺序）
 * 4. 若事件缓冲非空：先调用 dispatchEvents 回调，再通过 eventBus 广播，最后清空缓冲
 *
 * @param world - 游戏世界对象
 * @param options - 可选配置
 */
export function advanceWorldTick(world: World, options: AdvanceWorldTickOptions = {}): void {
  // 1. 递增 tick
  world.tick += 1;

  // 2. 推进时钟
  advanceClock(world.clock);

  // 3. 执行所有系统
  world.tickRunner.executeTick(world);

  // 4. 分发并清空事件缓冲
  flushWorldEvents(world, options);
}
