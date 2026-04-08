/**
 * @file map-object.ts
 * @description 地图对象联合类型定义 - 将所有可出现在地图上的游戏对象类型汇总为一个联合类型 MapObject。
 *              包含：Pawn（角色）、Building（建筑）、Item（物品）、Plant（植物）、
 *              Fire（火焰）、Corpse（尸体）、Blueprint（蓝图）、ConstructionSite（建造工地）、
 *              Designation（指派标记）。
 * @dependencies 各 feature 模块的类型定义（pawn、building、item、plant、fire、corpse、construction、designation）
 * @part-of 核心引擎层 (core)
 */

import type { Pawn } from '../features/pawn/pawn.types';
import type { Building } from '../features/building/building.types';
import type { Item } from '../features/item/item.types';
import type { Plant } from '../features/plant/plant.types';
import type { Fire } from '../features/fire/fire.types';
import type { Corpse } from '../features/corpse/corpse.types';
import type { Blueprint } from '../features/construction/blueprint.types';
import type { ConstructionSite } from '../features/construction/construction-site.types';
import type { Designation } from '../features/designation/designation.types';

/**
 * 地图对象联合类型 - 所有可存在于地图上的游戏实体的类型并集。
 * 用于需要处理任意地图对象的泛化场景（如对象池、空间索引、序列化等）。
 */
export type MapObject =
  | Pawn
  | Building
  | Item
  | Plant
  | Fire
  | Corpse
  | Blueprint
  | ConstructionSite
  | Designation;
