/**
 * @file item.factory.ts
 * @description 物品工厂函数，根据定义数据创建新的物品实例
 * @dependencies core/types — 对象ID生成、DefId等; world/def-database — 物品定义数据库; item.types — 物品接口
 * @part-of features/item 物品功能模块
 */

import { ObjectKind, nextObjectId } from '../../core/types';
import type { CellCoord, DefId, MapId, Tag } from '../../core/types';
import type { DefDatabase } from '../../world/def-database';
import type { Item } from './item.types';
import { PHYSICAL_OCCUPANT_TAG } from '../../world/occupancy';

/**
 * 创建一个新的物品实例
 * @param params.defId - 物品定义ID（用于查找定义数据库中的属性）
 * @param params.cell - 放置位置的格子坐标
 * @param params.mapId - 所属地图ID
 * @param params.stackCount - 初始堆叠数量（默认为1）
 * @param params.defs - 定义数据库（用于获取 maxStack 和 tags 等信息）
 * @returns 完整初始化的物品对象
 */
export function createItem(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  stackCount?: number;
  defs: DefDatabase;
}): Item {
  const { defId, cell, mapId, stackCount, defs } = params;
  const def = defs.items.get(defId);

  const maxStack = def?.maxStack ?? 75;
  const tags = new Set<string>(def?.tags ?? []);
  tags.add('haulable');
  tags.add('selectable');
  tags.add(PHYSICAL_OCCUPANT_TAG);

  return {
    id: nextObjectId(),
    kind: ObjectKind.Item,
    defId,
    mapId,
    cell: { x: cell.x, y: cell.y },
    tags,
    destroyed: false,
    stackCount: stackCount ?? 1,
    maxStack,
  };
}

/**
 * 创建简单物品（不依赖 DefDatabase，用于 toil 执行等场景）
 * @param params.defId - 物品定义ID
 * @param params.cell - 放置位置
 * @param params.mapId - 所属地图ID
 * @param params.stackCount - 堆叠数量
 * @param params.tags - 标签集合（默认 haulable + resource）
 * @param params.maxStack - 最大堆叠数（默认 100）
 * @param params.defs - 可选定义数据库；提供后会优先使用 defs 中的 maxStack 和 tags
 * @returns 完整初始化的物品对象
 */
export function createItemRaw(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  stackCount: number;
  tags?: Set<Tag>;
  maxStack?: number;
  defs?: DefDatabase;
}): Item {
  const def = params.defs?.items.get(params.defId);
  const tags = new Set<Tag>(params.tags ?? (def ? new Set(def.tags) : new Set(['haulable', 'resource'])));
  tags.add(PHYSICAL_OCCUPANT_TAG);
  return {
    id: nextObjectId(),
    kind: ObjectKind.Item,
    defId: params.defId,
    mapId: params.mapId,
    cell: { x: params.cell.x, y: params.cell.y },
    tags,
    destroyed: false,
    stackCount: params.stackCount,
    maxStack: params.maxStack ?? def?.maxStack ?? 100,
  };
}
