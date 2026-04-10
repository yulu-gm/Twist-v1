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
  CellCoord,
  DefId,
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

// ── Item placement（落地/堆叠） ──
export type ItemPlacementSearchScope = 'stockpile-only' | 'nearest-compatible';
export type ItemPlacementSelectionPreference = 'nearest' | 'prefer-existing-stacks';

export type ItemNoCapacityPolicy = 'fail' | 'force-overflow';

export interface PlaceItemOnMapParams {
  map: import('../../world/game-map').GameMap;
  defs: import('../../world/def-database').DefDatabase;
  defId: DefId;
  count: number;
  preferredCell: CellCoord;
  searchScope: ItemPlacementSearchScope;
  selectionPreference?: ItemPlacementSelectionPreference;
  noCapacityPolicy: ItemNoCapacityPolicy;
}

export interface PlaceItemOnMapResult {
  placedCount: number;
  remainingCount: number;
  usedFallback: boolean;
  usedCells: CellCoord[];
  success: boolean;
}

export interface ItemPlacementCapacitySummary {
  totalCapacity: number;
  bestCell: CellCoord | null;
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Item]: Item;
  }
}
