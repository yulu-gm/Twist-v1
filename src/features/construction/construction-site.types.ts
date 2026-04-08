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
}
