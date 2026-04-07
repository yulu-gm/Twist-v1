import {
  ObjectKind, TickPhase, nextObjectId,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { Blueprint } from './blueprint.types';
import { ConstructionSite } from './construction-site.types';
import { Building } from '../building/building.types';

export const constructionProgressSystem: SystemRegistration = {
  id: 'constructionProgress',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processBlueprints(world, map);
      processConstructionSites(world, map);
    }
  },
};

/** When all materials are delivered to a Blueprint, convert it to a ConstructionSite */
function processBlueprints(world: World, map: GameMap): void {
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint) as unknown as Blueprint[];

  for (const bp of blueprints) {
    if (bp.destroyed) continue;

    // Check if all materials delivered
    let allDelivered = true;
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const required = bp.materialsRequired[i];
      const delivered = bp.materialsDelivered[i];
      if (!delivered || delivered.count < required.count) {
        allDelivered = false;
        break;
      }
    }

    if (!allDelivered) continue;

    // Look up building def for work amount
    const buildingDef = world.defs.buildings.get(bp.targetDefId);
    const totalWork = buildingDef?.workToBuild ?? 100;

    // Create ConstructionSite
    const site: ConstructionSite = {
      id: nextObjectId(),
      kind: ObjectKind.ConstructionSite,
      defId: `site_${bp.targetDefId}`,
      mapId: bp.mapId,
      cell: { x: bp.cell.x, y: bp.cell.y },
      footprint: bp.footprint,
      tags: new Set(['construction_site', 'construction']),
      destroyed: false,
      targetDefId: bp.targetDefId,
      rotation: bp.rotation,
      buildProgress: 0,
      totalWorkAmount: totalWork,
      workDone: 0,
    };

    // Remove blueprint, add construction site
    map.objects.remove(bp.id);
    map.objects.add(site);

    log.info('construction', `Blueprint ${bp.id} converted to construction site ${site.id}`);

    world.eventBuffer.push({
      type: 'construction_site_created',
      tick: world.tick,
      data: {
        siteId: site.id,
        targetDefId: bp.targetDefId,
        cell: site.cell,
      },
    });
  }
}

/** When a ConstructionSite reaches full progress, convert it to the target Building */
function processConstructionSites(world: World, map: GameMap): void {
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite) as unknown as ConstructionSite[];

  for (const site of sites) {
    if (site.destroyed) continue;
    if (site.buildProgress < 1.0) continue;

    // Look up building def
    const buildingDef = world.defs.buildings.get(site.targetDefId);
    if (!buildingDef) {
      log.error('construction', `Building def ${site.targetDefId} not found for site ${site.id}`);
      continue;
    }

    // Create Building object
    const building: Building = {
      id: nextObjectId(),
      kind: ObjectKind.Building,
      defId: site.targetDefId,
      mapId: site.mapId,
      cell: { x: site.cell.x, y: site.cell.y },
      footprint: buildingDef.size,
      tags: new Set(buildingDef.tags),
      destroyed: false,
      hpCurrent: buildingDef.maxHp,
      hpMax: buildingDef.maxHp,
      rotation: site.rotation,
    };

    // Attach interaction component if building has an interaction cell offset
    if (buildingDef.interactionCellOffset) {
      building.interaction = {
        interactionCell: {
          x: site.cell.x + buildingDef.interactionCellOffset.x,
          y: site.cell.y + buildingDef.interactionCellOffset.y,
        },
      };
    }

    // Remove site, add building
    map.objects.remove(site.id);
    map.objects.add(building);

    // Update pathGrid if building blocks movement
    if (buildingDef.blocksMovement) {
      const fp = buildingDef.size;
      for (let dy = 0; dy < fp.height; dy++) {
        for (let dx = 0; dx < fp.width; dx++) {
          map.pathGrid.setPassable(site.cell.x + dx, site.cell.y + dy, false);
        }
      }
    }

    // Mark rooms dirty — new wall/door may form new rooms
    map.rooms.markDirty();

    log.info('construction', `Construction complete: ${site.targetDefId} at (${site.cell.x},${site.cell.y})`, {
      buildingId: building.id,
    });

    world.eventBuffer.push({
      type: 'construction_completed',
      tick: world.tick,
      data: {
        buildingId: building.id,
        defId: site.targetDefId,
        cell: site.cell,
      },
    });
  }
}
