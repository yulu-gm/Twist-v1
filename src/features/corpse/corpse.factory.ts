/**
 * @file corpse.factory.ts
 * @description 尸体工厂函数，负责创建尸体实体
 * @dependencies core/types — ID 生成、坐标类型；corpse.types — Corpse 接口
 * @part-of features/corpse — 尸体功能模块
 */

import { DefId, CellCoord, MapId, ObjectKind, ObjectId, nextObjectId } from '../../core/types';
import { Corpse } from './corpse.types';

/**
 * 创建一个尸体实体
 *
 * @param params.originalPawnId - 产生该尸体的原始棋子 ID
 * @param params.defId - 尸体的定义 ID（决定外观等）
 * @param params.cell - 尸体所在格子坐标
 * @param params.mapId - 尸体所属地图 ID
 * @returns 新建的 Corpse 对象，初始腐烂进度为 0，带有 'corpse' 和 'haulable' 标签
 */
export function createCorpse(params: {
  originalPawnId: ObjectId;
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
}): Corpse {
  return {
    id: nextObjectId(),
    kind: ObjectKind.Corpse,
    defId: params.defId,
    mapId: params.mapId,
    cell: { x: params.cell.x, y: params.cell.y },
    tags: new Set(['corpse', 'haulable']),
    destroyed: false,
    originalPawnId: params.originalPawnId,
    decayProgress: 0,
  };
}
