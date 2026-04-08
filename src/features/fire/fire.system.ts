/**
 * @file fire.system.ts
 * @description 火焰模拟系统——每隔5个tick执行一次，处理火焰的存活时间累加、强度衰减、蔓延扩散及熄灭销毁
 * @dependencies ObjectKind, TickPhase, nextObjectId, cellKey — 核心类型与工具函数；
 *              SystemRegistration — tick系统注册接口；World — 世界状态；Fire — 火焰类型
 * @part-of features/fire — 火焰模拟功能
 */

import { ObjectKind, TickPhase, nextObjectId, cellKey } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';
import { Fire } from './fire.types';

/** 四个基本方向的偏移量（上下左右邻居） */
const ADJACENT_OFFSETS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

/**
 * 火焰模拟主逻辑
 * @param world - 世界状态对象
 * 操作：遍历所有地图中的火焰对象，执行以下步骤：
 *  1. 累加存活时间（每次+5，对应系统执行频率）
 *  2. 递减蔓延冷却计时器
 *  3. 按衰减速率降低火焰强度，强度归零则标记销毁
 *  4. 当蔓延冷却到期时，随机选择一个相邻格子尝试点燃新火焰
 */
function fireExecute(world: World): void {
  const TICK_STEP = 5; // 与系统执行频率匹配
  const SPREAD_COOLDOWN_RESET = 100; // 每次蔓延尝试后的冷却tick数
  const SPREAD_CHANCE = 0.15; // 点燃相邻格子的基础概率
  const DECAY_RATE = 0.002; // 每次执行时损失的强度值

  for (const [, map] of world.maps) {
    const fires = map.objects.allOfKind(ObjectKind.Fire) as Fire[];
    const fireCells = new Set<string>();

    // 构建已着火格子的集合，避免重复点燃
    for (const fire of fires) {
      if (!fire.destroyed) {
        fireCells.add(cellKey(fire.cell));
      }
    }

    for (const fire of fires) {
      if (fire.destroyed) continue;

      fire.ticksAlive += TICK_STEP;
      fire.spreadCooldown -= TICK_STEP;

      // 自然衰减——降低火焰强度
      fire.intensity = Math.max(0, fire.intensity - DECAY_RATE);

      // 强度降至零，火焰熄灭并销毁
      if (fire.intensity <= 0) {
        fire.destroyed = true;
        map.objects.remove(fire.id);
        continue;
      }

      // 蔓延冷却到期时尝试向相邻格子扩散
      if (fire.spreadCooldown <= 0) {
        fire.spreadCooldown = SPREAD_COOLDOWN_RESET;

        // 随机选取一个相邻格子
        const offset = world.rng.pick(ADJACENT_OFFSETS);
        const nx = fire.cell.x + offset.x;
        const ny = fire.cell.y + offset.y;

        // 边界检查
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;

        const targetKey = cellKey({ x: nx, y: ny });
        if (fireCells.has(targetKey)) continue;

        // 按强度比例计算蔓延概率，成功则在目标格子创建新火焰
        if (world.rng.chance(SPREAD_CHANCE * fire.intensity)) {
          const newFire: Fire = {
            id: nextObjectId(),
            kind: ObjectKind.Fire,
            defId: 'fire',
            mapId: map.id,
            cell: { x: nx, y: ny },
            tags: new Set(['fire']),
            destroyed: false,
            intensity: fire.intensity * 0.8,
            ticksAlive: 0,
            spreadCooldown: SPREAD_COOLDOWN_RESET,
          };
          map.objects.add(newFire);
          fireCells.add(targetKey);
        }
      }
    }
  }
}

/** 火焰系统注册：在 WORLD_UPDATE 阶段以频率5执行火焰模拟 */
export const fireSystem: SystemRegistration = {
  id: 'fire',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 5,
  execute: fireExecute,
};
