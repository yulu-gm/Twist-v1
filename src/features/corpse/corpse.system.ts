/**
 * @file corpse.system.ts
 * @description 尸体腐烂系统，每 50 tick 推进一次腐烂进度，完全腐烂后销毁尸体
 * @dependencies core/types — ObjectKind、TickPhase；core/tick-runner — 系统注册接口；
 *               world/world — World 状态；corpse.types — Corpse 接口
 * @part-of features/corpse — 尸体功能模块
 */

import { ObjectKind, TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';
import { Corpse } from './corpse.types';

/**
 * 尸体腐烂系统的执行函数
 *
 * @param world - 当前世界状态
 *
 * 操作：遍历所有地图中的尸体，每次调用使腐烂进度 +0.01。
 * 当 decayProgress 达到 1.0 时，标记尸体为 destroyed 并从对象池移除。
 */
function corpseDecayExecute(world: World): void {
  for (const [, map] of world.maps) {
    const corpses = map.objects.allOfKind(ObjectKind.Corpse) as Corpse[];

    for (const corpse of corpses) {
      // 跳过已销毁的尸体
      if (corpse.destroyed) continue;

      // 推进腐烂进度，最大为 1
      corpse.decayProgress = Math.min(1, corpse.decayProgress + 0.01);

      // 完全腐烂后销毁并从对象池移除
      if (corpse.decayProgress >= 1.0) {
        corpse.destroyed = true;
        map.objects.remove(corpse.id);
      }
    }
  }
}

/** 尸体腐烂系统注册配置 — 在 WORLD_UPDATE 阶段每 50 tick 执行一次 */
export const corpseDecaySystem: SystemRegistration = {
  id: 'corpseDecay',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 50,
  execute: corpseDecayExecute,
};
