/**
 * @file items.ts
 * @description 物品定义数据——定义游戏中所有物品类型的属性。
 *              包括建筑材料（木材、石块、石砖、钢铁）和食物（简单餐食、浆果、稻米）。
 *              每种物品定义了堆叠上限、标签分类、营养值等属性。
 * @dependencies world/def-database（ItemDef 接口）
 * @part-of defs 模块——游戏静态数据定义
 */

import { ItemDef } from '../world/def-database';

export const ITEM_DEFS: ItemDef[] = [
  /** 木材——基础建筑材料，可搬运，最大堆叠75 */
  {
    defId: 'wood',
    label: 'Wood',
    description: 'Raw wood logs.',
    maxStack: 75,
    tags: ['haulable', 'resource', 'material'],
    color: 0x8B4513,
  },
  /** 石块——开采岩石获得的粗加工石料，最大堆叠50 */
  {
    defId: 'stone_chunk',
    label: 'Stone Chunk',
    description: 'A rough chunk of stone.',
    maxStack: 50,
    tags: ['haulable', 'resource'],
    color: 0x808080,
  },
  /** 石砖——由石块加工而成的建筑材料，最大堆叠50 */
  {
    defId: 'stone_block',
    label: 'Stone Block',
    description: 'Cut stone blocks for building.',
    maxStack: 50,
    tags: ['haulable', 'resource', 'material'],
    color: 0x999999,
  },
  /** 钢铁——精炼金属材料，最大堆叠75 */
  {
    defId: 'steel',
    label: 'Steel',
    description: 'Refined steel.',
    maxStack: 75,
    tags: ['haulable', 'resource', 'material'],
    color: 0xB0C4DE,
  },
  /** 简单餐食——烹饪制成的食物，营养值30，最大堆叠10 */
  {
    defId: 'meal_simple',
    label: 'Simple Meal',
    description: 'A simple but nutritious meal.',
    maxStack: 10,
    tags: ['haulable', 'food'],
    color: 0xDAA520,
    nutritionValue: 30,
  },
  /** 浆果——可直接生食的野果，营养值10，最大堆叠30 */
  {
    defId: 'berries',
    label: 'Berries',
    description: 'Wild berries, edible raw.',
    maxStack: 30,
    tags: ['haulable', 'food', 'raw_food'],
    color: 0x8B0000,
    nutritionValue: 10,
  },
  /** 稻米——收获的生稻，营养值5（需烹饪），最大堆叠50 */
  {
    defId: 'rice',
    label: 'Rice',
    description: 'Harvested rice.',
    maxStack: 50,
    tags: ['haulable', 'food', 'raw_food'],
    color: 0xFFFACD,
    nutritionValue: 5,
  },
];
