/**
 * @file building.systems.ts
 * @description 建筑 tick 系统，处理建筑的电力连接和仓储逻辑（当前为占位实现）
 * @dependencies core/types（TickPhase）, core/tick-runner, world/world, building.queries
 * @part-of 建筑系统（building）
 */

import { TickPhase } from '../../core/types';
import type { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import { getAllBuildings } from './building.queries';

/**
 * 建筑 tick 系统 —— 每 10 tick 执行一次
 * 在 WORLD_UPDATE 阶段遍历所有地图的建筑，处理电力连接状态
 * 当前为占位实现，后续将扩展电力网络计算和仓储逻辑
 */
export const buildingTickSystem: SystemRegistration = {
  id: 'building_tick',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 10,
  /**
   * 遍历所有地图上的建筑，跳过已销毁的建筑
   * 对有电力组件的建筑，暂时将连接状态设为 true（占位逻辑）
   * @param world - 游戏世界实例
   */
  execute(world: World) {
    for (const [, map] of world.maps) {
      const buildings = getAllBuildings(map);
      for (const building of buildings) {
        if (building.destroyed) continue;
        // 电力连接占位逻辑 —— 后续替换为真实电网计算
        // Power connectivity placeholder
        if (building.power) {
          building.power.connected = true;
        }
      }
    }
  },
};
