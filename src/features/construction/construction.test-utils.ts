import { ObjectKind, Rotation } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import type { Blueprint } from './blueprint.types';
import type { ConstructionSite } from './construction-site.types';

export function createConstructionTestWorld() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'main', width: 16, height: 16 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'Alice',
    cell: { x: 2, y: 2 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  map.objects.add(pawn);

  return { defs, world, map, pawn };
}

export function createAdditionalPawn(
  world: ReturnType<typeof createConstructionTestWorld>['world'],
  map: ReturnType<typeof createConstructionTestWorld>['map'],
  name: string,
  cell: { x: number; y: number },
) {
  const pawn = createPawn({
    name,
    cell,
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  map.objects.add(pawn);
  return pawn;
}

export function createBlueprint(
  map: ReturnType<typeof createConstructionTestWorld>['map'],
  overrides: Partial<Blueprint> = {},
): Blueprint {
  const blueprint: Blueprint = {
    id: overrides.id ?? 'bp_1',
    kind: ObjectKind.Blueprint,
    defId: overrides.defId ?? 'blueprint_wall_wood',
    mapId: map.id,
    cell: overrides.cell ?? { x: 6, y: 6 },
    footprint: overrides.footprint ?? { width: 1, height: 1 },
    tags: overrides.tags ?? new Set(['blueprint', 'construction']),
    destroyed: overrides.destroyed ?? false,
    targetDefId: overrides.targetDefId ?? 'wall_wood',
    rotation: overrides.rotation ?? Rotation.North,
    materialsRequired: overrides.materialsRequired ?? [{ defId: 'wood', count: 5 }],
    materialsDelivered: overrides.materialsDelivered ?? [{ defId: 'wood', count: 0 }],
  };
  map.objects.add(blueprint);
  return blueprint;
}

export function createConstructionSite(
  map: ReturnType<typeof createConstructionTestWorld>['map'],
  overrides: Partial<ConstructionSite> = {},
): ConstructionSite {
  const site: ConstructionSite = {
    id: overrides.id ?? 'site_1',
    kind: ObjectKind.ConstructionSite,
    defId: overrides.defId ?? 'site_wall_wood',
    mapId: map.id,
    cell: overrides.cell ?? { x: 6, y: 6 },
    footprint: overrides.footprint ?? { width: 1, height: 1 },
    tags: overrides.tags ?? new Set(['construction_site', 'construction']),
    destroyed: overrides.destroyed ?? false,
    targetDefId: overrides.targetDefId ?? 'wall_wood',
    rotation: overrides.rotation ?? Rotation.North,
    buildProgress: overrides.buildProgress ?? 0,
    totalWorkAmount: overrides.totalWorkAmount ?? 100,
    workDone: overrides.workDone ?? 0,
  };
  map.objects.add(site);
  return site;
}
