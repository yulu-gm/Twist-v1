/**
 * @file building.factory.ts
 * @description 建筑工厂函数，根据定义数据库创建建筑对象实例
 * @dependencies core/types（ObjectKind, Rotation, nextObjectId, CellCoord, DefId, MapId）,
 *               world/def-database, building.types
 * @part-of 建筑系统（building）
 */

import { ObjectKind, Rotation, nextObjectId } from '../../core/types';
import type { CellCoord, DefId, MapId } from '../../core/types';
import type { DefDatabase } from '../../world/def-database';
import type { Building } from './building.types';
import { PHYSICAL_OCCUPANT_TAG } from '../../world/occupancy';

/**
 * 创建建筑实例
 * 根据建筑定义（DefDatabase）初始化建筑的生命值、标签、占地面积，
 * 并按需挂载电力、仓储、交互等可选组件
 *
 * @param params.defId - 建筑定义ID，从定义数据库中查找具体配置
 * @param params.cell - 建筑左上角所在的格子坐标
 * @param params.mapId - 建筑所在的地图ID
 * @param params.rotation - 建筑朝向（可选，默认朝北）
 * @param params.defs - 定义数据库实例，用于查找建筑属性
 * @returns 完整初始化的 Building 对象
 */
export function createBuilding(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  rotation?: Rotation;
  defs: DefDatabase;
}): Building {
  // 从定义数据库获取建筑配置，设置默认值
  const { defId, cell, mapId, defs } = params;
  const rotation = params.rotation ?? Rotation.North;
  const def = defs.buildings.get(defId);

  // 初始化生命值和标签
  const maxHp = def?.maxHp ?? 100;
  const tags = new Set<string>(def?.tags ?? []);
  tags.add('selectable');
  tags.add(PHYSICAL_OCCUPANT_TAG);
  if (def?.blocksMovement) tags.add('impassable');

  // 构建基础建筑对象
  const building: Building = {
    id: nextObjectId(),
    kind: ObjectKind.Building,
    defId,
    mapId,
    cell: { x: cell.x, y: cell.y },
    footprint: def?.size ?? { width: 1, height: 1 },
    tags,
    destroyed: false,
    rotation,
    hpCurrent: maxHp,
    hpMax: maxHp,
    category: def?.category,
  };

  if (def?.furnitureType) {
    building.furniture = {
      usageType: def.furnitureType,
    };
  }

  // 若定义了耗电量，挂载电力组件
  // Attach optional power component
  if (def?.powerConsumption !== undefined) {
    building.power = {
      consumption: def.powerConsumption,
      production: 0,
      connected: false,
    };
  }

  // 若定义了仓储配置，挂载仓库抽象库存组件
  // Attach optional warehouse storage component
  if (def?.storageConfig) {
    building.storage = {
      mode: def.storageConfig.mode,
      capacityMax: def.storageConfig.capacityMax,
      storedCount: 0,
      inventory: {},
    };
  }

  // 若定义了交互格偏移量，挂载交互组件（计算绝对交互位置）
  // Attach interaction component if building has an interaction cell
  if (def?.interactionCellOffset) {
    building.interaction = {
      interactionCell: {
        x: cell.x + def.interactionCellOffset.x,
        y: cell.y + def.interactionCellOffset.y,
      },
    };
  }

  if (def?.bedConfig) {
    building.bed = {
      role: 'public',
      autoAssignable: def.bedConfig.autoAssignable,
      restRateMultiplier: def.bedConfig.restRateMultiplier,
      moodBonus: def.bedConfig.moodBonus,
    };
  }

  return building;
}
