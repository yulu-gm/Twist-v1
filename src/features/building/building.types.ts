/**
 * @file building.types.ts
 * @description 建筑（Building）类型定义，描述已建成的建筑对象及其可选组件（电力/仓储/交互）
 * @dependencies core/types（ObjectKind, MapObjectBase, Rotation, DefId, StoragePriority, CellCoord）
 * @part-of 建筑系统（building）
 */

import type {
  ObjectKind,
  MapObjectBase,
  Rotation,
  DefId,
  StoragePriority,
  CellCoord,
} from '../../core/types';

// ── 建筑接口 ──

/**
 * 建筑接口 —— 施工完成后生成的最终建筑实体
 * 可选挂载电力、仓储、交互等组件
 */
export interface Building extends MapObjectBase {
  /** 对象类型标识：建筑 */
  kind: ObjectKind.Building;
  /** 建筑朝向（北/东/南/西） */
  rotation: Rotation;
  /** 当前生命值 */
  hpCurrent: number;
  /** 最大生命值 */
  hpMax: number;
  category?: 'structure' | 'furniture';

  // ── 可选组件 ──

  furniture?: {
    usageType: 'bed' | 'table' | 'chair' | 'storage';
  };

  /** 电力组件：管理建筑的耗电/发电状态 */
  power?: {
    /** 耗电量 */
    consumption: number;
    /** 发电量 */
    production: number;
    /** 是否已连接到电网 */
    connected: boolean;
  };
  /** 仓储组件：将建筑作为物品容器使用 */
  storage?: {
    /** 允许存放的物品定义ID集合 */
    allowedDefIds: Set<DefId>;
    /** 存储优先级 */
    priority: StoragePriority;
  };
  /** 交互组件：棋子与建筑互动时使用的格子位置 */
  interaction?: {
    /** 交互操作发生的格子坐标 */
    interactionCell: CellCoord;
  };
  bed?: {
    ownerPawnId?: string;
    occupantPawnId?: string;
    role: 'public' | 'owned' | 'medical' | 'prisoner';
    autoAssignable: boolean;
    restRateMultiplier: number;
    moodBonus: number;
  };
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Building]: Building;
  }
}
