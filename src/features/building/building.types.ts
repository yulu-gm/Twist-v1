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
  /** 建筑分类：结构类或家具类 */
  category?: 'structure' | 'furniture';

  // ── 可选组件 ──

  /** 家具组件：描述家具的使用类型 */
  furniture?: {
    /** 使用类型（床/桌子/椅子/储物） */
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
  /** 仓储组件：将建筑作为抽象库存容器使用 */
  storage?: {
    /** 收纳模式：'all-haulable' = 接受所有 haulable 物品 */
    mode: 'all-haulable';
    /** 仓库最大可存储总数 */
    capacityMax: number;
    /** 当前已存储总数 */
    storedCount: number;
    /** 按物品定义 ID 聚合的库存数量映射 */
    inventory: Partial<Record<DefId, number>>;
  };
  /** 交互组件：棋子与建筑互动时使用的格子位置 */
  interaction?: {
    /** 交互操作发生的格子坐标 */
    interactionCell: CellCoord;
  };
  /** 床位组件：描述床的所有权、占用状态和属性 */
  bed?: {
    /** 床位所有者棋子ID（undefined 表示无主） */
    ownerPawnId?: string;
    /** 当前占用床位的棋子ID（undefined 表示无人） */
    occupantPawnId?: string;
    /** 床位角色：公共/私有/医疗/囚犯 */
    role: 'public' | 'owned' | 'medical' | 'prisoner';
    /** 是否允许自动分配给无床棋子 */
    autoAssignable: boolean;
    /** 在此床睡觉时的休息恢复速率倍率 */
    restRateMultiplier: number;
    /** 在此床睡觉带来的心情加成 */
    moodBonus: number;
  };
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Building]: Building;
  }
}
