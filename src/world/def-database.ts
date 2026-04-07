import {
  DefId, Footprint, MaterialReq, Tag, CellCoord, StoragePriority
} from '../core/types';

// ── Def categories ──
export type DefCategory = 'buildings' | 'items' | 'plants' | 'terrains' | 'jobs' | 'recipes';

// ── Building Def ──
export interface BuildingDef {
  defId: DefId;
  label: string;
  description: string;
  size: Footprint;
  maxHp: number;
  workToBuild: number;
  costList: MaterialReq[];
  tags: Tag[];
  blocksMovement: boolean;
  blocksLight: boolean;
  passable: boolean;
  interactionCellOffset?: CellCoord;
  powerConsumption?: number;
  storageConfig?: {
    allowedDefIds: DefId[];
    priority: StoragePriority;
  };
  color: number; // render color for rectangle
}

// ── Item Def ──
export interface ItemDef {
  defId: DefId;
  label: string;
  description: string;
  maxStack: number;
  tags: Tag[];
  color: number;
  nutritionValue?: number; // if edible
}

// ── Plant Def ──
export interface PlantDef {
  defId: DefId;
  label: string;
  description: string;
  growthDays: number;   // in-game days to fully grow
  harvestYield?: { defId: DefId; count: number };
  tags: Tag[];
  color: number;
  growthStages: number; // number of visual stages
}

// ── Terrain Def ──
export interface TerrainDef {
  defId: DefId;
  label: string;
  passable: boolean;
  moveCost: number;       // 1 = normal, higher = slower
  fertility: number;      // 0 = barren, 1 = normal
  color: number;
  mineable: boolean;
  mineYield?: { defId: DefId; count: number };
}

// ── Job Def ──
export interface JobDef {
  defId: DefId;
  label: string;
  reportString: string;  // e.g. "hauling {target}"
  workType: string;       // "construction", "mining", "hauling", etc.
}

// ── Recipe Def ──
export interface RecipeDef {
  defId: DefId;
  label: string;
  workAmount: number;
  ingredients: MaterialReq[];
  products: MaterialReq[];
  workstationDefId: DefId;
}

// ── Unified Def type ──
export type AnyDef = BuildingDef | ItemDef | PlantDef | TerrainDef | JobDef | RecipeDef;

// ── DefDatabase ──
export class DefDatabase {
  readonly buildings: Map<DefId, BuildingDef> = new Map();
  readonly items: Map<DefId, ItemDef> = new Map();
  readonly plants: Map<DefId, PlantDef> = new Map();
  readonly terrains: Map<DefId, TerrainDef> = new Map();
  readonly jobs: Map<DefId, JobDef> = new Map();
  readonly recipes: Map<DefId, RecipeDef> = new Map();

  registerBuilding(def: BuildingDef): void { this.buildings.set(def.defId, def); }
  registerItem(def: ItemDef): void { this.items.set(def.defId, def); }
  registerPlant(def: PlantDef): void { this.plants.set(def.defId, def); }
  registerTerrain(def: TerrainDef): void { this.terrains.set(def.defId, def); }
  registerJob(def: JobDef): void { this.jobs.set(def.defId, def); }
  registerRecipe(def: RecipeDef): void { this.recipes.set(def.defId, def); }

  get<T extends AnyDef>(category: DefCategory, id: DefId): T | undefined {
    const map = this[category] as Map<DefId, AnyDef>;
    return map.get(id) as T | undefined;
  }
}
