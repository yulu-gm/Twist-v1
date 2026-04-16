/**
 * @file def-database.ts
 * @description 定义数据库——存储所有游戏定义（Def）的核心注册表。
 *              包含建筑、物品、植物、地形、工作、配方六大类定义接口，
 *              以及统一的 DefDatabase 类用于注册和查询定义。
 * @dependencies core/types（DefId, Footprint, MaterialReq, Tag, CellCoord, StoragePriority）
 * @part-of world 模块——游戏世界数据层
 */

import {
  DefId, Footprint, MaterialReq, Tag, CellCoord, StoragePriority
} from '../core/types';

// ── 建筑定义 ──
export interface BuildingDef {
  /** 建筑的唯一标识符 */
  defId: DefId;
  /** 显示名称 */
  label: string;
  /** 描述文本 */
  description: string;
  /** 占地尺寸（宽×高，以格子为单位） */
  size: Footprint;
  /** 最大生命值 */
  maxHp: number;
  /** 建造所需工作量 */
  workToBuild: number;
  /** 建造材料需求列表 */
  costList: MaterialReq[];
  /** 标签列表（如 structure, wall, furniture 等） */
  tags: Tag[];
  /** 是否阻挡移动 */
  blocksMovement: boolean;
  /** 是否阻挡光线 */
  blocksLight: boolean;
  /** 是否可通行（门可通行但墙不可） */
  passable: boolean;
  /** 交互格子偏移量（相对于建筑原点，可选） */
  interactionCellOffset?: CellCoord;
  /** 耗电量（可选） */
  powerConsumption?: number;
  /** 存储配置（如仓库区域允许存放的物品和优先级，可选） */
  storageConfig?: {
    allowedDefIds: DefId[];
    priority: StoragePriority;
  };
  category?: 'structure' | 'furniture';
  furnitureType?: 'bed' | 'table' | 'chair' | 'storage';
  bedConfig?: {
    autoAssignable: boolean;
    restRateMultiplier: number;
    moodBonus: number;
  };
  /** 渲染颜色（十六进制色值） */
  color: number;
}

// ── 物品定义 ──
export interface ItemDef {
  /** 物品的唯一标识符 */
  defId: DefId;
  /** 显示名称 */
  label: string;
  /** 描述文本 */
  description: string;
  /** 最大堆叠数量 */
  maxStack: number;
  /** 标签列表（如 haulable, resource, food 等） */
  tags: Tag[];
  /** 渲染颜色 */
  color: number;
  /** 营养值（可食用物品才有，可选） */
  nutritionValue?: number;
}

// ── 植物定义 ──
export interface PlantDef {
  /** 植物的唯一标识符 */
  defId: DefId;
  /** 显示名称 */
  label: string;
  /** 描述文本 */
  description: string;
  /** 完全生长所需的游戏天数 */
  growthDays: number;
  /** 收获产出（产出物品ID和数量，可选） */
  harvestYield?: { defId: DefId; count: number };
  /** 标签列表（如 plant, tree, crop 等） */
  tags: Tag[];
  /** 渲染颜色 */
  color: number;
  /** 视觉生长阶段数 */
  growthStages: number;
}

// ── 地形定义 ──
export interface TerrainDef {
  /** 地形的唯一标识符 */
  defId: DefId;
  /** 显示名称 */
  label: string;
  /** 是否可通行 */
  passable: boolean;
  /** 移动消耗（1=正常速度，越大越慢） */
  moveCost: number;
  /** 肥沃度（0=贫瘠，1=正常） */
  fertility: number;
  /** 渲染颜色 */
  color: number;
  /** 是否可开采 */
  mineable: boolean;
  /** 开采产出（产出物品ID和数量，可选） */
  mineYield?: { defId: DefId; count: number };
}

// ── 工作定义 ──
export interface JobDef {
  /** 工作的唯一标识符 */
  defId: DefId;
  /** 显示名称 */
  label: string;
  /** 工作汇报字符串模板，如 "hauling {target}" */
  reportString: string;
  /** 工作类型分类，如 "construction", "mining", "hauling" 等 */
  workType: string;
}

// ── 定义数据库 ──
/**
 * DefDatabase 是游戏所有定义（Def）的中心注册表。
 * 按类别（建筑、物品、植物、地形、工作、配方）分别存储，
 * 提供注册和按ID查询的方法。
 */
export class DefDatabase {
  /** 建筑定义映射表 */
  readonly buildings: Map<DefId, BuildingDef> = new Map();
  /** 物品定义映射表 */
  readonly items: Map<DefId, ItemDef> = new Map();
  /** 植物定义映射表 */
  readonly plants: Map<DefId, PlantDef> = new Map();
  /** 地形定义映射表 */
  readonly terrains: Map<DefId, TerrainDef> = new Map();
  /** 工作定义映射表 */
  readonly jobs: Map<DefId, JobDef> = new Map();

  /** 注册一个建筑定义 */
  registerBuilding(def: BuildingDef): void { this.buildings.set(def.defId, def); }
  /** 注册一个物品定义 */
  registerItem(def: ItemDef): void { this.items.set(def.defId, def); }
  /** 注册一个植物定义 */
  registerPlant(def: PlantDef): void { this.plants.set(def.defId, def); }
  /** 注册一个地形定义 */
  registerTerrain(def: TerrainDef): void { this.terrains.set(def.defId, def); }
  /** 注册一个工作定义 */
  registerJob(def: JobDef): void { this.jobs.set(def.defId, def); }
}
