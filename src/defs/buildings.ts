/**
 * @file buildings.ts
 * @description 建筑定义数据——定义游戏中所有建筑类型的属性。
 *              包括结构建筑（木墙、石墙、木门）、家具（木床、桌子）和区域标记（仓储区）。
 *              每种建筑定义了尺寸、耐久、建造成本、通行阻挡等属性。
 * @dependencies world/def-database（BuildingDef 接口）
 * @part-of defs 模块——游戏静态数据定义
 */

import { BuildingDef } from '../world/def-database';

export const BUILDING_DEFS: BuildingDef[] = [
  /** 木墙——基础结构，阻挡移动和光线，需要5个木材建造 */
  {
    defId: 'wall_wood',
    label: 'Wood Wall',
    description: 'A simple wooden wall.',
    size: { width: 1, height: 1 },
    maxHp: 150,
    workToBuild: 100,
    costList: [{ defId: 'wood', count: 5 }],
    tags: ['structure', 'wall', 'impassable'],
    blocksMovement: true,
    blocksLight: true,
    passable: false,
    color: 0x8B6914,
  },
  /** 石墙——高耐久结构，阻挡移动和光线，需要5个石砖建造 */
  {
    defId: 'wall_stone',
    label: 'Stone Wall',
    description: 'A sturdy stone wall.',
    size: { width: 1, height: 1 },
    maxHp: 300,
    workToBuild: 200,
    costList: [{ defId: 'stone_block', count: 5 }],
    tags: ['structure', 'wall', 'impassable'],
    blocksMovement: true,
    blocksLight: true,
    passable: false,
    color: 0x777777,
  },
  /** 木门——可通行的结构，殖民者可以开关，阻挡光线但不阻挡移动 */
  {
    defId: 'door_wood',
    label: 'Wood Door',
    description: 'A wooden door. Colonists can open and close it.',
    size: { width: 1, height: 1 },
    maxHp: 100,
    workToBuild: 80,
    costList: [{ defId: 'wood', count: 3 }],
    tags: ['structure', 'door'],
    blocksMovement: false,
    blocksLight: true,
    passable: true,
    color: 0x6B4226,
  },
  /** 木床——家具，供殖民者睡觉，占1x2格，有交互偏移格 */
  {
    defId: 'bed_wood',
    label: 'Wood Bed',
    description: 'A simple bed for sleeping.',
    size: { width: 1, height: 2 },
    maxHp: 100,
    workToBuild: 120,
    costList: [{ defId: 'wood', count: 8 }],
    tags: ['furniture', 'bed'],
    category: 'furniture',
    furnitureType: 'bed',
    bedConfig: {
      autoAssignable: true,
      restRateMultiplier: 1.25,
      moodBonus: 5,
    },
    blocksMovement: false,
    blocksLight: false,
    passable: false,
    interactionCellOffset: { x: 0, y: 2 },
    color: 0xCD853F,
  },
  /** 桌子——家具，用于进食，占2x1格 */
  {
    defId: 'table',
    label: 'Table',
    description: 'A table for eating.',
    size: { width: 2, height: 1 },
    maxHp: 100,
    workToBuild: 80,
    costList: [{ defId: 'wood', count: 6 }],
    tags: ['furniture', 'table'],
    blocksMovement: false,
    blocksLight: false,
    passable: false,
    color: 0xA0522D,
  },
  /** 仓库——可建造的家具型仓储设施，挂载抽象库存容器，是正式存储的唯一来源 */
  {
    defId: 'warehouse_shed',
    label: 'Warehouse',
    description: 'A dedicated warehouse for abstract item storage.',
    size: { width: 2, height: 2 },
    maxHp: 180,
    workToBuild: 180,
    costList: [{ defId: 'wood', count: 20 }],
    tags: ['furniture', 'storage'],
    category: 'furniture',
    furnitureType: 'storage',
    storageConfig: {
      mode: 'all-haulable',
      capacityMax: 160,
    },
    blocksMovement: false,
    blocksLight: false,
    passable: false,
    interactionCellOffset: { x: 1, y: 2 },
    color: 0x8a6a3a,
  },
];
