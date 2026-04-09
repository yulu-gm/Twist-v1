/**
 * @file designation.types.ts
 * @description 指派（Designation）对象的类型定义，描述玩家对地图上目标发出的工作指令
 * @dependencies MapObjectBase, ObjectKind, DesignationType, ObjectId, CellCoord, WorkPriority — 核心类型
 * @part-of features/designation — 指派/工作指令功能
 */

import {
  MapObjectBase,
  ObjectKind,
  DesignationType,
  ObjectId,
  CellCoord,
  WorkPriority,
} from '../../core/types';

/**
 * 指派对象接口
 * 继承自 MapObjectBase，代表一条待执行的工作指令（如采集、挖矿、砍伐）
 */
export interface Designation extends MapObjectBase {
  /** 对象类型标识，固定为 Designation */
  kind: ObjectKind.Designation;
  /** 指派类型，表明需要执行何种工作（采集/挖矿/砍伐等） */
  designationType: DesignationType;
  /** 指派目标对象的ID（如需要砍伐的树木），可选 */
  targetObjectId?: ObjectId;
  /** 指派目标格子坐标（如需要挖矿的位置），可选 */
  targetCell?: CellCoord;
  /** 工作优先级，用于排序任务执行顺序 */
  priority: WorkPriority;
}

// ── KindMap 类型注册 ──
declare module '../../core/types' {
  interface KindMap {
    [ObjectKind.Designation]: Designation;
  }
}
