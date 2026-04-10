import {
  ObjectId, ObjectKind, nextObjectId,
} from '../../core/types';
import { log } from '../../core/logger';
import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';
import { hasPhysicalOccupantsInFootprint } from '../../world/occupancy';
import type { Blueprint } from './blueprint.types';
import type { ConstructionSite } from './construction-site.types';

export type PromoteBlueprintFailureReason =
  | 'blueprint_missing'
  | 'materials_missing'
  | 'occupied'
  | 'building_def_missing';

export interface PromoteBlueprintResult {
  promoted: boolean;
  siteId?: ObjectId;
  site?: ConstructionSite;
  reason?: PromoteBlueprintFailureReason;
}

export interface ConstructionOccupancyOptions {
  ignoreIds?: Iterable<ObjectId>;
}

export function areBlueprintMaterialsDelivered(blueprint: Blueprint): boolean {
  for (let i = 0; i < blueprint.materialsRequired.length; i++) {
    const required = blueprint.materialsRequired[i];
    const delivered = blueprint.materialsDelivered[i];
    if (!delivered || delivered.count < required.count) {
      return false;
    }
  }

  return true;
}

export function hasConstructionOccupants(
  map: GameMap,
  target: Pick<Blueprint | ConstructionSite, 'id' | 'cell' | 'footprint'>,
  options: ConstructionOccupancyOptions = {},
): boolean {
  const ignoreIds = new Set(options.ignoreIds ?? []);
  ignoreIds.add(target.id);
  return hasPhysicalOccupantsInFootprint(
    map,
    target.cell,
    target.footprint,
    { ignoreIds },
  );
}

export function findConstructionSiteAtCell(
  map: GameMap,
  cell: { x: number; y: number },
  targetDefId?: string,
): ConstructionSite | undefined {
  return map.objects
    .allOfKind(ObjectKind.ConstructionSite)
    .find(site => !site.destroyed
      && site.cell.x === cell.x
      && site.cell.y === cell.y
      && (!targetDefId || site.targetDefId === targetDefId));
}

export function tryPromoteBlueprintToConstructionSite(
  world: World,
  map: GameMap,
  blueprintId: ObjectId,
  options: ConstructionOccupancyOptions = {},
): PromoteBlueprintResult {
  const blueprint = map.objects.getAs(blueprintId, ObjectKind.Blueprint);
  if (!blueprint || blueprint.destroyed) {
    return { promoted: false, reason: 'blueprint_missing' };
  }

  if (!areBlueprintMaterialsDelivered(blueprint)) {
    return { promoted: false, reason: 'materials_missing' };
  }

  if (hasConstructionOccupants(map, blueprint, options)) {
    return { promoted: false, reason: 'occupied' };
  }

  const buildingDef = world.defs.buildings.get(blueprint.targetDefId);
  if (!buildingDef) {
    log.error('construction', `Building def ${blueprint.targetDefId} not found for blueprint ${blueprint.id}`);
    return { promoted: false, reason: 'building_def_missing' };
  }

  const site: ConstructionSite = {
    id: nextObjectId(),
    kind: ObjectKind.ConstructionSite,
    defId: `site_${blueprint.targetDefId}`,
    mapId: blueprint.mapId,
    cell: { x: blueprint.cell.x, y: blueprint.cell.y },
    footprint: blueprint.footprint,
    tags: new Set(['construction_site', 'construction']),
    destroyed: false,
    targetDefId: blueprint.targetDefId,
    rotation: blueprint.rotation,
    buildProgress: 0,
    totalWorkAmount: buildingDef.workToBuild ?? 100,
    workDone: 0,
  };

  map.objects.remove(blueprint.id);
  map.objects.add(site);

  log.info('construction', `Blueprint ${blueprint.id} converted to construction site ${site.id}`);
  world.eventBuffer.push({
    type: 'construction_site_created',
    tick: world.tick,
    data: {
      siteId: site.id,
      targetDefId: blueprint.targetDefId,
      cell: site.cell,
    },
  });

  return {
    promoted: true,
    siteId: site.id,
    site,
  };
}
