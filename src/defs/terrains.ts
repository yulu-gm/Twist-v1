/**
 * @file terrains.ts
 * @description 地形定义数据——定义游戏中所有地形类型的属性。
 *              包括自然地形（草地、泥土、沙地、岩石、水）和人造地板（木地板、石地板）。
 *              每种地形定义了通行性、移动消耗、肥沃度、是否可开采等属性。
 * @dependencies world/def-database（TerrainDef 接口）
 * @part-of defs 模块——游戏静态数据定义
 */

import { TerrainDef } from '../world/def-database';

export const TERRAIN_DEFS: TerrainDef[] = [
  /** 草地——最常见的自然地形，可通行，肥沃度正常 */
  {
    defId: 'grass',
    label: 'Grass',
    passable: true,
    moveCost: 1,
    fertility: 1,
    color: 0x4a7c3f,
    mineable: false,
  },
  /** 泥土——自然地形，可通行，肥沃度略低 */
  {
    defId: 'dirt',
    label: 'Dirt',
    passable: true,
    moveCost: 1,
    fertility: 0.7,
    color: 0x8b7355,
    mineable: false,
  },
  /** 沙地——自然地形，可通行但移动较慢，几乎无肥沃度 */
  {
    defId: 'sand',
    label: 'Sand',
    passable: true,
    moveCost: 1.5,
    fertility: 0.1,
    color: 0xc2b280,
    mineable: false,
  },
  /** 岩石——不可通行的自然地形，可开采获得石块 */
  {
    defId: 'rock',
    label: 'Rock',
    passable: false,
    moveCost: 999,
    fertility: 0,
    color: 0x666666,
    mineable: true,
    mineYield: { defId: 'stone_chunk', count: 2 },
  },
  /** 水——不可通行的自然地形，无法开采 */
  {
    defId: 'water',
    label: 'Water',
    passable: false,
    moveCost: 999,
    fertility: 0,
    color: 0x3366aa,
    mineable: false,
  },
  /** 木地板——人造地形，移动速度快，无肥沃度 */
  {
    defId: 'floor_wood',
    label: 'Wood Floor',
    passable: true,
    moveCost: 0.8,
    fertility: 0,
    color: 0xa0825a,
    mineable: false,
  },
  /** 石地板——人造地形，移动速度快，无肥沃度 */
  {
    defId: 'floor_stone',
    label: 'Stone Floor',
    passable: true,
    moveCost: 0.8,
    fertility: 0,
    color: 0x999999,
    mineable: false,
  },
];
