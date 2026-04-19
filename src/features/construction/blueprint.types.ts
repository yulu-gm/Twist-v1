/**
 * @file blueprint.types.ts
 * @description 蓝图（Blueprint）类型定义，表示玩家放置的建筑计划，等待材料运送
 * @dependencies core/types（MapObjectBase, ObjectKind, DefId, Rotation, MaterialReq）
 * @part-of 建造系统（construction）
 */

import {
  MapObjectBase, ObjectKind, DefId, Rotation, MaterialReq,
} from '../../core/types';

/**
 * 蓝图接口 —— 玩家下达建造指令后在地图上生成的占位对象
 * 当所有材料运送完毕后，蓝图会转换为施工工地（ConstructionSite）。
 * 由工作订单派生时会回填 workOrderId / workOrderItemId 以便溯源。
 */
export interface Blueprint extends MapObjectBase {
  /** 对象类型标识：蓝图 */
  kind: ObjectKind.Blueprint;
  /** 目标建筑的定义ID，标识最终要建成哪种建筑 */
  targetDefId: DefId;
  /** 建筑朝向（北/东/南/西） */
  rotation: Rotation;
  /** 建造所需的材料清单（defId + 数量） */
  materialsRequired: MaterialReq[];
  /** 已运送到蓝图位置的材料清单（defId + 已到数量） */
  materialsDelivered: MaterialReq[];
  /** 派生该蓝图的工作订单 ID（可选；由订单流程回填，便于溯源/级联取消） */
  workOrderId?: string;
  /** 派生该蓝图的订单 item ID（可选；由订单流程回填） */
  workOrderItemId?: string;
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Blueprint]: Blueprint;
  }
}
