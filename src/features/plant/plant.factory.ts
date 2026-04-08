/**
 * @file plant.factory.ts
 * @description 植物工厂函数，根据定义和参数创建植物对象实例
 * @dependencies core/types（DefId, CellCoord, MapId, ObjectKind, nextObjectId, Tag）,
 *               plant.types, world/def-database
 * @part-of 植物系统（plant）
 */

import { DefId, CellCoord, MapId, ObjectKind, nextObjectId, Tag } from '../../core/types';
import { Plant } from './plant.types';
import type { DefDatabase } from '../../world/def-database';

/**
 * 创建植物实例
 * 根据定义数据库初始化植物的标签和生长状态
 *
 * @param params.defId - 植物定义ID，用于从定义数据库获取植物配置
 * @param params.cell - 植物所在的格子坐标
 * @param params.mapId - 植物所在的地图ID
 * @param params.sownByPlayer - 是否为玩家播种（可选，默认 false 表示野生）
 * @param params.growthProgress - 初始生长进度（可选，默认 0 表示刚种下）
 * @param params.defs - 定义数据库实例（可选），用于合并植物定义中的标签
 * @returns 完整初始化的 Plant 对象
 */
export function createPlant(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  sownByPlayer?: boolean;
  growthProgress?: number;
  defs?: DefDatabase;
}): Plant {
  const growthProgress = params.growthProgress ?? 0;

  // 初始化基础标签 'plant'，然后合并定义中的额外标签
  // Start with base tag, then merge tags from Def if available
  const tags = new Set<Tag>(['plant']);
  if (params.defs) {
    const plantDef = params.defs.plants.get(params.defId);
    if (plantDef) {
      for (const t of plantDef.tags) tags.add(t);
    }
  }

  return {
    id: nextObjectId(),
    kind: ObjectKind.Plant,
    defId: params.defId,
    mapId: params.mapId,
    cell: { x: params.cell.x, y: params.cell.y },
    tags,
    destroyed: false,
    growthProgress,
    growthStage: 0,
    sownByPlayer: params.sownByPlayer ?? false,
    harvestReady: false,
    dyingProgress: 0,
  };
}
