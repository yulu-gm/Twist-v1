/**
 * @file construction-site.types.ts
 * @description 施工工地（ConstructionSite）类型定义，表示材料已到位、正在施工的建筑
 * @dependencies core/types（MapObjectBase, ObjectKind, DefId, Rotation）
 * @part-of 建造系统（construction）
 */

import {
  MapObjectBase, ObjectKind, DefId, Rotation,
} from '../../core/types';

/**
 * 施工工地接口 —— 蓝图材料齐全后转换而来
 * 棋子（Pawn）对其执行建造工作，进度达到 1.0 后转换为最终建筑
 * 由工作订单派生时会回填 workOrderId / workOrderItemId 以便溯源/完成时回写。
 */
export interface ConstructionSite extends MapObjectBase {
  /** 对象类型标识：施工工地 */
  kind: ObjectKind.ConstructionSite;
  /** 目标建筑的定义ID */
  targetDefId: DefId;
  /** 建筑朝向 */
  rotation: Rotation;
  /** 建造进度，范围 0（刚开始）到 1（完工） */
  buildProgress: number;      // 0 to 1
  /** 完成建造所需的总工作量 */
  totalWorkAmount: number;
  /** 已完成的工作量 */
  workDone: number;
  /** 派生该工地的工作订单 ID（可选；从蓝图升级时拷贝） */
  workOrderId?: string;
  /** 派生该工地的订单 item ID（可选；从蓝图升级时拷贝） */
  workOrderItemId?: string;
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.ConstructionSite]: ConstructionSite;
  }
}
