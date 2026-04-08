/**
 * @file item.types.ts
 * @description 物品（Item）类型定义，描述地图上可拾取、可堆叠的物品实体
 * @dependencies core/types — ObjectKind, MapObjectBase, QualityLevel 基础类型
 * @part-of features/item 物品功能模块
 */

import type {
  ObjectKind,
  MapObjectBase,
  QualityLevel,
} from '../../core/types';

// ── Item（物品：地图上可搬运和堆叠的实体） ──
export interface Item extends MapObjectBase {
  /** 对象类型标识，固定为 Item */
  kind: ObjectKind.Item;
  /** 当前堆叠数量 */
  stackCount: number;
  /** 最大堆叠上限 */
  maxStack: number;
  /** 物品品质等级（可选） */
  quality?: QualityLevel;
}
