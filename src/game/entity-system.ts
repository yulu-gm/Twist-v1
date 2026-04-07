/** entity-system：实体目录、原型类型、生命周期与一致性规则（与 Phaser 无关）。 */

import type { NeedKind, PawnState } from "./pawn-state";
import { coordKey, gridCoordFromKey, type GridCoord } from "./world-grid";

export type EntityId = string;

/** 物资所在容器：地图格、小人携带、存储区等。 */
export type MaterialContainerKind = "map" | "pawn" | "zone";

export type MaterialEntity = Readonly<{
  kind: "material";
  id: EntityId;
  materialKind: string;
  cell: GridCoord;
  containerKind: MaterialContainerKind;
  containerId?: EntityId;
  pickupAllowed: boolean;
  pickupMarked?: boolean;
  reservedByPawnId?: EntityId;
  quantity: number;
}>;

export type PawnDisplayProfile = Readonly<{
  epithet: string;
  bio: string;
  notes: string;
  mockTags: readonly string[];
}>;

export type PawnEntity = Readonly<{
  kind: "pawn";
  id: EntityId;
  cell: GridCoord;
  behaviorState: string;
  currentTargetId?: EntityId;
  carriedMaterialId?: EntityId;
  saturation: number;
  energy: number;
  bedAssignmentId?: EntityId;
  displayProfile?: PawnDisplayProfile;
}>;

export type TreeEntity = Readonly<{
  kind: "tree";
  id: EntityId;
  cell: GridCoord;
  lumberMarked: boolean;
  occupied: boolean;
}>;

export type RockEntity = Readonly<{
  kind: "rock";
  id: EntityId;
  cell: GridCoord;
  miningMarked: boolean;
  occupied: boolean;
}>;

export type BlueprintEntity = Readonly<{
  kind: "blueprint";
  id: EntityId;
  blueprintType: string;
  cellKeys: readonly string[];
  buildProgress: number;
  buildStatus: string;
  linkedWorkId?: EntityId;
}>;

export type BuildingEntity = Readonly<{
  kind: "building";
  id: EntityId;
  buildingType: string;
  cellKeys: readonly string[];
  capabilities: readonly string[];
  ownerInfo?: string;
  reservedByPawnId?: EntityId;
}>;

export type ZoneEntity = Readonly<{
  kind: "zone";
  id: EntityId;
  zoneType: string;
  cellKeys: readonly string[];
  name: string;
  acceptedMaterialRules: readonly string[];
}>;

/** 存储区（堆放区）在 `ZoneEntity.zoneType` 上的唯一约定值，与 PT009/015 及 UI「存储区」一致。 */
export const ZONE_TYPE_STORAGE = "storage" as const;

export type AnyGameEntity =
  | MaterialEntity
  | PawnEntity
  | TreeEntity
  | RockEntity
  | BlueprintEntity
  | BuildingEntity
  | ZoneEntity;

const SEED_GROUND_STACKS: ReadonlyArray<
  Readonly<{ cell: GridCoord; materialKind: string; quantity: number }>
> = [
  { cell: { col: 1, row: 0 }, materialKind: "木柴", quantity: 3 },
  { cell: { col: 3, row: 1 }, materialKind: "石块", quantity: 12 },
  { cell: { col: 0, row: 2 }, materialKind: "浆果", quantity: 5 },
  { cell: { col: 2, row: 2 }, materialKind: "绳结", quantity: 1 },
  { cell: { col: 4, row: 0 }, materialKind: "铁矿", quantity: 7 },
  { cell: { col: 5, row: 2 }, materialKind: "草药", quantity: 2 },
  { cell: { col: 0, row: 1 }, materialKind: "兽皮", quantity: 4 }
];

const SPAWN_WOOD_FROM_TREE = 10;
const SPAWN_STONE_FROM_ROCK = 10;
const MATERIAL_KIND_WOOD = "木柴";
const MATERIAL_KIND_STONE = "石块";

type BuildingNeedProfile = Readonly<{
  useDurationSec: number;
  needDelta: Partial<Record<NeedKind, number>>;
}>;

type BuildingPreset = Readonly<{
  capabilities: readonly string[];
  ownerInfo?: string;
  needProfiles?: Readonly<{
    rest?: BuildingNeedProfile;
    recreation?: BuildingNeedProfile;
  }>;
}>;

const BUILDING_DEFAULTS: Readonly<Record<string, BuildingPreset>> = {
  bed: {
    capabilities: ["rest", "assignable"],
    ownerInfo: "unset",
    needProfiles: {
      rest: { useDurationSec: 3.6, needDelta: { rest: -65 } }
    }
  },
  bedRoll: {
    capabilities: ["rest"],
    ownerInfo: "unset",
    needProfiles: {
      rest: { useDurationSec: 3.6, needDelta: { rest: -65 } }
    }
  },
  horseshoe: {
    capabilities: ["recreation"],
    ownerInfo: "communal",
    needProfiles: {
      recreation: { useDurationSec: 2.8, needDelta: { recreation: -50 } }
    }
  },
  horseshoe_pin: {
    capabilities: ["recreation"],
    ownerInfo: "communal",
    needProfiles: {
      recreation: { useDurationSec: 2.9, needDelta: { recreation: -52 } }
    }
  },
  workshop: { capabilities: ["craft"], ownerInfo: "communal" },
  stockpile: { capabilities: ["storage"], ownerInfo: "communal" },
  wall: { capabilities: ["passage:block"], ownerInfo: "communal" }
};

const MATERIAL_DEFAULTS: Readonly<
  Record<
    string,
    Readonly<{
      edible?: boolean;
      useDurationSec?: number;
      needDelta?: Partial<Record<NeedKind, number>>;
    }>
  >
> = {
  浆果: { edible: true, useDurationSec: 2.4, needDelta: { hunger: -55 } },
  berry: { edible: true, useDurationSec: 2.4, needDelta: { hunger: -55 } }
};

const SEED_PAWN_DISPLAY: Readonly<Record<string, PawnDisplayProfile>> = {
  "pawn-0": {
    epithet: "冲动的美食家",
    bio: "闻到灶台味就走不动路，但总忘记带碗。",
    notes: "mock：今日心愿是吃到不糊的炖菜。",
    mockTags: ["社交型", "夜猫子"]
  },
  "pawn-1": {
    epithet: "守序补眠委员",
    bio: "认为午睡是生产力，谁吵和谁急。",
    notes: "mock：枕头编号已贴便签。",
    mockTags: ["规划型", "早起困难"]
  },
  "pawn-2": {
    epithet: "田野散心达人",
    bio: "心情不好就去圈外溜达，回来时裤脚永远有泥。",
    notes: "mock：正在收集「奇怪的石头」。",
    mockTags: ["外向", "收集癖"]
  },
  "pawn-3": {
    epithet: "沉默账本 keeper",
    bio: "话少，但记得每户借了几根火柴。",
    notes: "mock：秘密写日记，用的密码是村长生日。",
    mockTags: ["谨慎", "记性好"]
  },
  "pawn-4": {
    epithet: "即兴演奏志愿者",
    bio: "会用锅盖敲节奏，自称「打击乐自由魂」。",
    notes: "mock：下一首歌献给未完成的篱笆。",
    mockTags: ["创意", "音量大"]
  }
};

function clamp0100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function behaviorLabelFromPawn(pawn: PawnState): string {
  const g = pawn.currentGoal?.kind ?? "none";
  const a = pawn.currentAction?.kind ?? "idle";
  return `${g}/${a}`;
}

function targetRefFromPawn(pawn: PawnState): EntityId | undefined {
  return (
    pawn.currentAction?.targetId ??
    pawn.currentGoal?.workId ??
    pawn.currentGoal?.targetId ??
    pawn.reservedTargetId
  );
}

export class EntityRegistry {
  private seq = 0;
  private materials = new Map<EntityId, MaterialEntity>();
  private pawns = new Map<EntityId, PawnEntity>();
  private trees = new Map<EntityId, TreeEntity>();
  private rocks = new Map<EntityId, RockEntity>();
  private blueprints = new Map<EntityId, BlueprintEntity>();
  private buildings = new Map<EntityId, BuildingEntity>();
  private zones = new Map<EntityId, ZoneEntity>();
  private groundMaterialByCellKey = new Map<string, EntityId>();
  private pawnDisplayById = new Map<EntityId, PawnDisplayProfile>();

  public allocId(prefix: string): EntityId {
    return `${prefix}-${this.seq++}`;
  }

  public setPawnDisplayProfile(pawnId: EntityId, profile: PawnDisplayProfile): void {
    this.pawnDisplayById.set(pawnId, profile);
  }

  public registerMaterial(entity: MaterialEntity): void {
    if (entity.containerKind === "map" || entity.containerKind === "zone") {
      const key = coordKey(entity.cell);
      EntityConsistencyRules.assertSingleGroundMaterialPerCell(
        key,
        this.groundMaterialByCellKey.get(key),
        entity.id
      );
      this.groundMaterialByCellKey.set(key, entity.id);
    }
    this.materials.set(entity.id, entity);
  }

  public removeMaterial(id: EntityId): void {
    const entity = this.materials.get(id);
    if (!entity) return;
    if (entity.containerKind === "map" || entity.containerKind === "zone") {
      const key = coordKey(entity.cell);
      if (this.groundMaterialByCellKey.get(key) === id) {
        this.groundMaterialByCellKey.delete(key);
      }
    }
    this.materials.delete(id);
  }

  public updateMaterial(next: MaterialEntity): void {
    const old = this.materials.get(next.id);
    if (!old) {
      throw new Error(`entity-system: updateMaterial unknown material ${next.id}`);
    }
    if (old.containerKind === "map" || old.containerKind === "zone") {
      const key = coordKey(old.cell);
      if (this.groundMaterialByCellKey.get(key) === old.id) {
        this.groundMaterialByCellKey.delete(key);
      }
    }
    this.materials.set(next.id, next);
    if (next.containerKind === "map" || next.containerKind === "zone") {
      const key = coordKey(next.cell);
      EntityConsistencyRules.assertSingleGroundMaterialPerCell(
        key,
        this.groundMaterialByCellKey.get(key),
        next.id
      );
      this.groundMaterialByCellKey.set(key, next.id);
    }
  }

  public getMaterial(id: EntityId): MaterialEntity | undefined {
    return this.materials.get(id);
  }

  public getPawn(id: EntityId): PawnEntity | undefined {
    return this.pawns.get(id);
  }

  public listMaterialsOnGround(): MaterialEntity[] {
    return [...this.materials.values()].filter((m) => m.containerKind === "map");
  }

  public groundMaterialAtCell(cell: GridCoord): MaterialEntity | undefined {
    const id = this.groundMaterialByCellKey.get(coordKey(cell));
    return id ? this.materials.get(id) : undefined;
  }

  public syncPawnsFromStates(states: readonly PawnState[]): void {
    for (const p of states) {
      const prev = this.pawns.get(p.id);
      const displayProfile = this.pawnDisplayById.get(p.id);
      const next: PawnEntity = {
        kind: "pawn",
        id: p.id,
        cell: p.logicalCell,
        behaviorState: behaviorLabelFromPawn(p),
        currentTargetId: targetRefFromPawn(p),
        carriedMaterialId: prev?.carriedMaterialId,
        saturation: clamp0100(100 - p.needs.hunger),
        energy: clamp0100(100 - p.needs.rest),
        bedAssignmentId: prev?.bedAssignmentId,
        displayProfile
      };
      this.pawns.set(p.id, next);
    }
  }

  public updatePawn(pawn: PawnEntity): void {
    this.pawns.set(pawn.id, pawn);
  }

  public removePawn(id: EntityId): void {
    this.pawns.delete(id);
  }

  public registerTree(entity: TreeEntity): void {
    this.trees.set(entity.id, entity);
  }

  public registerRock(entity: RockEntity): void {
    this.rocks.set(entity.id, entity);
  }

  public registerBlueprint(entity: BlueprintEntity): void {
    this.blueprints.set(entity.id, entity);
  }

  public registerBuilding(entity: BuildingEntity): void {
    this.buildings.set(entity.id, entity);
  }

  public updateBuilding(next: BuildingEntity): void {
    if (!this.buildings.has(next.id)) {
      throw new Error(`entity-system: updateBuilding unknown building ${next.id}`);
    }
    this.buildings.set(next.id, next);
  }

  public registerZone(entity: ZoneEntity): void {
    this.zones.set(entity.id, entity);
  }

  public getTree(id: EntityId): TreeEntity | undefined {
    return this.trees.get(id);
  }

  public getRock(id: EntityId): RockEntity | undefined {
    return this.rocks.get(id);
  }

  public listEntitiesByKind<K extends AnyGameEntity["kind"]>(
    kind: K
  ): Extract<AnyGameEntity, { kind: K }>[] {
    const map =
      kind === "material"
        ? this.materials
        : kind === "pawn"
          ? this.pawns
          : kind === "tree"
            ? this.trees
            : kind === "rock"
              ? this.rocks
              : kind === "blueprint"
                ? this.blueprints
                : kind === "building"
                  ? this.buildings
                  : this.zones;
    return [...map.values()] as Extract<AnyGameEntity, { kind: K }>[];
  }

  public findGroundMaterialNear(cell: GridCoord): MaterialEntity | undefined {
    return this.groundMaterialAtCell(cell);
  }

  public getEntity(id: EntityId): AnyGameEntity | undefined {
    return (
      this.materials.get(id) ??
      this.pawns.get(id) ??
      this.trees.get(id) ??
      this.rocks.get(id) ??
      this.blueprints.get(id) ??
      this.buildings.get(id) ??
      this.zones.get(id)
    );
  }

  public listEntitiesAtCell(cell: GridCoord): AnyGameEntity[] {
    const key = coordKey(cell);
    const out: AnyGameEntity[] = [];
    for (const m of this.materials.values()) {
      if (
        (m.containerKind === "map" || m.containerKind === "zone") &&
        coordKey(m.cell) === key
      ) {
        out.push(m);
      }
    }
    for (const p of this.pawns.values()) {
      if (coordKey(p.cell) === key) out.push(p);
    }
    for (const t of this.trees.values()) {
      if (coordKey(t.cell) === key) out.push(t);
    }
    for (const r of this.rocks.values()) {
      if (coordKey(r.cell) === key) out.push(r);
    }
    for (const b of this.blueprints.values()) {
      if (b.cellKeys.includes(key)) out.push(b);
    }
    for (const b of this.buildings.values()) {
      if (b.cellKeys.includes(key)) out.push(b);
    }
    for (const z of this.zones.values()) {
      if (z.cellKeys.includes(key)) out.push(z);
    }
    return out;
  }

  public removeTree(id: EntityId): void {
    this.trees.delete(id);
  }

  public removeRock(id: EntityId): void {
    this.rocks.delete(id);
  }

  public removeBlueprint(id: EntityId): void {
    this.blueprints.delete(id);
  }

  public removeBuilding(id: EntityId): void {
    this.buildings.delete(id);
  }

  public removeZone(id: EntityId): void {
    this.zones.delete(id);
  }
}

export function groundMaterialMatchesEatNeed(m: MaterialEntity): boolean {
  return m.containerKind === "map" && MATERIAL_DEFAULTS[m.materialKind]?.edible === true;
}

export function primaryCellOfBuildingEntity(b: BuildingEntity): GridCoord | undefined {
  const keys = [...b.cellKeys].sort();
  const k = keys[0];
  return k ? gridCoordFromKey(k) : undefined;
}

export function gridCellForEntityTarget(registry: EntityRegistry, targetId: EntityId): GridCoord | undefined {
  const ent = registry.getEntity(targetId);
  if (!ent) return undefined;
  if (ent.kind === "material" && ent.containerKind === "map") return ent.cell;
  if (ent.kind === "building") return primaryCellOfBuildingEntity(ent);
  return undefined;
}

export function needInteractionSpecForTarget(
  registry: EntityRegistry,
  targetId: EntityId,
  goalKind: "eat" | "sleep" | "recreate"
): Readonly<{
  cell: GridCoord;
  useDurationSec: number;
  needDelta: Partial<Record<NeedKind, number>>;
}> | undefined {
  const ent = registry.getEntity(targetId);
  if (!ent) return undefined;
  if (goalKind === "eat" && ent.kind === "material" && ent.containerKind === "map") {
    const d = MATERIAL_DEFAULTS[ent.materialKind];
    if (!d?.edible) return undefined;
    return {
      cell: ent.cell,
      useDurationSec: d.useDurationSec ?? 2.4,
      needDelta: d.needDelta ?? {}
    };
  }
  if (ent.kind !== "building") return undefined;
  const preset = BUILDING_DEFAULTS[ent.buildingType];
  const prof =
    goalKind === "sleep"
      ? preset?.needProfiles?.rest
      : goalKind === "recreate"
        ? preset?.needProfiles?.recreation
        : undefined;
  if (!prof) return undefined;
  const cell = primaryCellOfBuildingEntity(ent);
  if (!cell) return undefined;
  if (goalKind === "sleep" && !ent.capabilities.includes("rest")) return undefined;
  if (goalKind === "recreate" && !ent.capabilities.includes("recreation")) return undefined;
  return {
    cell,
    useDurationSec: prof.useDurationSec,
    needDelta: prof.needDelta
  };
}

export function createSeededEntityRegistry(): EntityRegistry {
  const registry = new EntityRegistry();
  for (const stack of SEED_GROUND_STACKS) {
    registry.registerMaterial({
      kind: "material",
      id: registry.allocId("mat"),
      materialKind: stack.materialKind,
      cell: stack.cell,
      containerKind: "map",
      pickupAllowed: true,
      quantity: stack.quantity
    });
  }
  for (const [pawnId, profile] of Object.entries(SEED_PAWN_DISPLAY)) {
    registry.setPawnDisplayProfile(pawnId, profile);
  }
  const bed = BUILDING_DEFAULTS.bed;
  registry.registerBuilding({
    kind: "building",
    id: "seed-bed-1",
    buildingType: "bed",
    cellKeys: [coordKey({ col: 9, row: 7 })],
    capabilities: bed.capabilities,
    ownerInfo: bed.ownerInfo
  });
  registry.registerBuilding({
    kind: "building",
    id: "seed-bed-2",
    buildingType: "bed",
    cellKeys: [coordKey({ col: 10, row: 7 })],
    capabilities: bed.capabilities,
    ownerInfo: bed.ownerInfo
  });
  const rec = BUILDING_DEFAULTS.horseshoe_pin;
  registry.registerBuilding({
    kind: "building",
    id: "seed-rec-1",
    buildingType: "horseshoe_pin",
    cellKeys: [coordKey({ col: 14, row: 6 })],
    capabilities: rec.capabilities,
    ownerInfo: rec.ownerInfo
  });
  registry.registerBuilding({
    kind: "building",
    id: "seed-rec-2",
    buildingType: "horseshoe_pin",
    cellKeys: [coordKey({ col: 15, row: 6 })],
    capabilities: rec.capabilities,
    ownerInfo: rec.ownerInfo
  });
  registry.registerZone({
    kind: "zone",
    id: "seed-stockpile-1",
    zoneType: ZONE_TYPE_STORAGE,
    cellKeys: [coordKey({ col: 18, row: 0 }), coordKey({ col: 19, row: 0 })],
    name: "存储区",
    acceptedMaterialRules: ["*"]
  });
  return registry;
}

function pawnCarryByPawnId(registry: EntityRegistry): Map<EntityId, EntityId> {
  const m = new Map<EntityId, EntityId>();
  for (const p of registry.listEntitiesByKind("pawn")) {
    if (p.carriedMaterialId !== undefined) m.set(p.id, p.carriedMaterialId);
  }
  return m;
}

export const EntityLifecycle = {
  fellingCompleteSpawnWood(registry: EntityRegistry, treeId: EntityId, at: GridCoord): void {
    const tree = registry.getTree(treeId);
    if (!tree || coordKey(tree.cell) !== coordKey(at)) {
      throw new Error(`entity-system: fellingCompleteSpawnWood invalid tree ${treeId} or cell`);
    }
    registry.removeTree(treeId);
    const existing = registry.groundMaterialAtCell(at);
    if (existing) {
      if (existing.materialKind !== MATERIAL_KIND_WOOD) {
        throw new Error(
          `entity-system: cell ${coordKey(at)} has ground material ${existing.id} (${existing.materialKind}), cannot spawn ${MATERIAL_KIND_WOOD}`
        );
      }
      registry.updateMaterial({
        ...existing,
        quantity: existing.quantity + SPAWN_WOOD_FROM_TREE
      });
      return;
    }
    registry.registerMaterial({
      kind: "material",
      id: registry.allocId("mat"),
      materialKind: MATERIAL_KIND_WOOD,
      cell: at,
      containerKind: "map",
      pickupAllowed: true,
      quantity: SPAWN_WOOD_FROM_TREE
    });
  },

  miningCompleteSpawnStone(registry: EntityRegistry, rockId: EntityId, at: GridCoord): void {
    const rock = registry.getRock(rockId);
    if (!rock || coordKey(rock.cell) !== coordKey(at)) {
      throw new Error(`entity-system: miningCompleteSpawnStone invalid rock ${rockId} or cell`);
    }
    registry.removeRock(rockId);
    const existing = registry.groundMaterialAtCell(at);
    if (existing) {
      if (existing.materialKind !== MATERIAL_KIND_STONE) {
        throw new Error(
          `entity-system: cell ${coordKey(at)} has ground material ${existing.id} (${existing.materialKind}), cannot spawn ${MATERIAL_KIND_STONE}`
        );
      }
      registry.updateMaterial({
        ...existing,
        quantity: existing.quantity + SPAWN_STONE_FROM_ROCK
      });
      return;
    }
    registry.registerMaterial({
      kind: "material",
      id: registry.allocId("mat"),
      materialKind: MATERIAL_KIND_STONE,
      cell: at,
      containerKind: "map",
      pickupAllowed: true,
      quantity: SPAWN_STONE_FROM_ROCK
    });
  },

  blueprintCompleteSpawnBuilding(registry: EntityRegistry, blueprintId: EntityId): void {
    const ent = registry.getEntity(blueprintId);
    if (!ent || ent.kind !== "blueprint") {
      throw new Error(`entity-system: blueprintCompleteSpawnBuilding missing blueprint ${blueprintId}`);
    }
    const cellKeys = [...ent.cellKeys];
    const buildingType = ent.blueprintType;
    registry.removeBlueprint(blueprintId);
    const preset = BUILDING_DEFAULTS[buildingType] ?? { capabilities: ["interact"] as const };
    registry.registerBuilding({
      kind: "building",
      id: registry.allocId("bld"),
      buildingType,
      cellKeys,
      capabilities: preset.capabilities,
      ownerInfo: preset.ownerInfo
    });
  },

  pawnPickupMaterial(registry: EntityRegistry, pawnId: EntityId, materialId: EntityId): void {
    const mat = registry.getMaterial(materialId);
    const pawn = registry.getPawn(pawnId);
    if (!mat || !pawn) {
      throw new Error(`entity-system: pawnPickupMaterial missing pawn ${pawnId} or material ${materialId}`);
    }
    if (mat.containerKind !== "map" && mat.containerKind !== "zone") {
      throw new Error(
        `entity-system: material ${materialId} containerKind ${mat.containerKind} cannot be picked up from surface`
      );
    }
    EntityConsistencyRules.assertMaterialNotDoublyLocated(mat, pawnCarryByPawnId(registry));
    if (pawn.carriedMaterialId !== undefined && pawn.carriedMaterialId !== materialId) {
      throw new Error(
        `entity-system: pawn ${pawnId} already carries ${pawn.carriedMaterialId}`
      );
    }
    registry.updateMaterial({
      ...mat,
      cell: pawn.cell,
      containerKind: "pawn",
      containerId: pawnId
    });
    registry.updatePawn({
      ...pawn,
      carriedMaterialId: materialId
    });
  },

  pawnDropMaterial(
    registry: EntityRegistry,
    pawnId: EntityId,
    materialId: EntityId,
    at: GridCoord,
    storageZoneId?: EntityId
  ): void {
    const mat = registry.getMaterial(materialId);
    const pawn = registry.getPawn(pawnId);
    if (!mat || !pawn) {
      throw new Error(`entity-system: pawnDropMaterial missing pawn ${pawnId} or material ${materialId}`);
    }
    if (mat.containerKind !== "pawn" || mat.containerId !== pawnId) {
      throw new Error(`entity-system: material ${materialId} is not carried by pawn ${pawnId}`);
    }
    if (pawn.carriedMaterialId !== undefined && pawn.carriedMaterialId !== materialId) {
      throw new Error(`entity-system: pawn ${pawnId} carry mismatch`);
    }
    let zoneId: EntityId | undefined;
    if (storageZoneId !== undefined) {
      const z = registry.getEntity(storageZoneId);
      if (
        !z ||
        z.kind !== "zone" ||
        z.zoneType !== ZONE_TYPE_STORAGE ||
        !z.cellKeys.includes(coordKey(at))
      ) {
        throw new Error(
          `entity-system: pawnDropMaterial storage zone ${storageZoneId} invalid for cell ${coordKey(at)}`
        );
      }
      zoneId = storageZoneId;
    }
    const containerKind: MaterialContainerKind = zoneId !== undefined ? "zone" : "map";
    const existing = registry.groundMaterialAtCell(at);
    if (existing && existing.id !== materialId) {
      if (existing.materialKind !== mat.materialKind) {
        throw new Error(
          `entity-system: cell ${coordKey(at)} has ground material ${existing.id} (${existing.materialKind}), cannot drop ${mat.materialKind}`
        );
      }
      registry.updateMaterial({
        ...existing,
        quantity: existing.quantity + mat.quantity,
        containerKind,
        containerId: zoneId
      });
      registry.removeMaterial(materialId);
    } else {
      registry.updateMaterial({
        ...mat,
        cell: at,
        containerKind,
        containerId: zoneId
      });
    }
    registry.updatePawn({
      ...pawn,
      carriedMaterialId: undefined
    });
  }
};

/** 实体关系一致性（占位：与地图占用对齐时在实现层补全）。 */
export const EntityConsistencyRules = {
  assertSingleGroundMaterialPerCell(
    cellKey: string,
    existingId: EntityId | undefined,
    nextId: EntityId
  ): void {
    if (existingId !== undefined && existingId !== nextId) {
      throw new Error(
        `entity-system: cell ${cellKey} already has ground material ${existingId}`
      );
    }
  },

  assertMaterialNotDoublyLocated(
    material: MaterialEntity,
    pawnCarryMap: ReadonlyMap<EntityId, EntityId>
  ): void {
    if (material.containerKind !== "map" && material.containerKind !== "zone") return;
    for (const [pid, mid] of pawnCarryMap) {
      if (mid === material.id) {
        throw new Error(
          `entity-system: material ${material.id} on map but pawn ${pid} lists it as carried`
        );
      }
    }
  }
};
