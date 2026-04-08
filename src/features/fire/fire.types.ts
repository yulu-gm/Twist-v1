/**
 * @file fire.types.ts
 * @description 火焰对象的类型定义，描述地图上一个火焰实例的数据结构
 * @dependencies MapObjectBase, ObjectKind — 来自核心类型模块
 * @part-of features/fire — 火焰模拟功能
 */

import { MapObjectBase, ObjectKind } from '../../core/types';

/**
 * 火焰对象接口
 * 继承自 MapObjectBase，表示地图上的一个火焰实例
 * 火焰具有强度衰减、存活时间追踪、蔓延冷却等行为属性
 */
export interface Fire extends MapObjectBase {
  /** 对象类型标识，固定为 Fire */
  kind: ObjectKind.Fire;
  /** 火焰强度，范围 0（余烬将灭）到 1（熊熊烈火） */
  intensity: number;
  /** 火焰已存活的 tick 数 */
  ticksAlive: number;
  /** 距离下一次尝试蔓延的剩余冷却 tick 数 */
  spreadCooldown: number;
}
