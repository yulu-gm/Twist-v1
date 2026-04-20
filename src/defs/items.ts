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
    label: '木材',
    description: '原木。',
    maxStack: 75,
    tags: ['haulable', 'resource', 'material'],
    color: 0x8B4513,
  },
  /** 石块——开采岩石获得的粗加工石料，最大堆叠50 */
  {
    defId: 'stone_chunk',
    label: '石块',
    description: '粗加工的石料。',
    maxStack: 50,
    tags: ['haulable', 'resource'],
    color: 0x808080,
  },
  /** 石砖——由石块加工而成的建筑材料，最大堆叠50 */
  {
    defId: 'stone_block',
    label: '石砖',
    description: '可用于建筑的切割石砖。',
    maxStack: 50,
    tags: ['haulable', 'resource', 'material'],
    color: 0x999999,
  },
  /** 钢铁——精炼金属材料，最大堆叠75 */
  {
    defId: 'steel',
    label: '钢铁',
    description: '精炼后的钢铁。',
    maxStack: 75,
    tags: ['haulable', 'resource', 'material'],
    color: 0xB0C4DE,
  },
  /** 简单餐食——烹饪制成的食物，营养值30，最大堆叠10 */
  {
    defId: 'meal_simple',
    label: '简易餐食',
    description: '简单但富有营养的餐食。',
    maxStack: 10,
    tags: ['haulable', 'food'],
    color: 0xDAA520,
    nutritionValue: 30,
  },
  /** 浆果——可直接生食的野果，营养值10，最大堆叠30 */
  {
    defId: 'berries',
    label: '浆果',
    description: '可生食的野生浆果。',
    maxStack: 30,
    tags: ['haulable', 'food', 'raw_food'],
    color: 0x8B0000,
    nutritionValue: 10,
  },
  /** 稻米——收获的生稻，营养值5（需烹饪），最大堆叠50 */
  {
    defId: 'rice',
    label: '稻米',
    description: '收获的稻米。',
    maxStack: 50,
    tags: ['haulable', 'food', 'raw_food'],
    color: 0xFFFACD,
    nutritionValue: 5,
  },
];
