/**
 * @file plants.ts
 * @description 植物定义数据——定义游戏中所有植物类型的属性。
 *              包括树木（橡树、松树）、灌木（浆果丛）、作物（水稻）和野草（高草）。
 *              每种植物定义了生长周期、收获产出、生长阶段数等属性。
 * @dependencies world/def-database（PlantDef 接口）
 * @part-of defs 模块——游戏静态数据定义
 */

import { PlantDef } from '../world/def-database';

export const PLANT_DEFS: PlantDef[] = [
  /** 橡树——大型树木，30天成熟，砍伐可获得25个木材，4个生长阶段 */
  {
    defId: 'tree_oak',
    label: '橡树',
    description: '坚实的橡树。',
    growthDays: 30,
    harvestYield: { defId: 'wood', count: 25 },
    tags: ['plant', 'tree', 'cuttable'],
    color: 0x228B22,
    growthStages: 4,
  },
  /** 松树——高大针叶树，25天成熟，砍伐可获得20个木材，4个生长阶段 */
  {
    defId: 'tree_pine',
    label: '松树',
    description: '高耸的松树。',
    growthDays: 25,
    harvestYield: { defId: 'wood', count: 20 },
    tags: ['plant', 'tree', 'cuttable'],
    color: 0x006400,
    growthStages: 4,
  },
  /** 浆果丛——野生灌木，8天成熟，收获可获得8个浆果，3个生长阶段 */
  {
    defId: 'bush_berry',
    label: '浆果丛',
    description: '结有可食浆果的灌木。',
    growthDays: 8,
    harvestYield: { defId: 'berries', count: 8 },
    tags: ['plant', 'harvestable'],
    color: 0x32CD32,
    growthStages: 3,
  },
  /** 水稻——人工种植作物，6天成熟，收获可获得6个稻米，3个生长阶段 */
  {
    defId: 'crop_rice',
    label: '水稻',
    description: '人工种植的水稻。',
    growthDays: 6,
    harvestYield: { defId: 'rice', count: 6 },
    tags: ['plant', 'crop', 'harvestable'],
    color: 0x9ACD32,
    growthStages: 3,
  },
  /** 高草——野生草本植物，5天成熟，无收获产出，2个生长阶段 */
  {
    defId: 'grass_tall',
    label: '高草',
    description: '野生草本。',
    growthDays: 5,
    tags: ['plant', 'grass'],
    color: 0x7CFC00,
    growthStages: 2,
  },
];
