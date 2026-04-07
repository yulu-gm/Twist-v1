import {
  ObjectKind, DefId, CellCoord, Rotation, nextObjectId, MapId, MaterialReq,
} from '../../core/types';
import { CommandHandler, Command } from '../../core/command-bus';
import { GameEvent } from '../../core/event-bus';
import { World } from '../../world/world';
import { log } from '../../core/logger';
import { Blueprint } from './blueprint.types';

// ── place_blueprint ──

export const placeBlueprintHandler: CommandHandler = {
  type: 'place_blueprint',

  validate(world: World, cmd: Command) {
    const { defId, cell } = cmd.payload as {
      defId: DefId;
      cell: CellCoord;
      mapId?: MapId;
    };

    const mapId = (cmd.payload.mapId as string) ?? world.maps.keys().next().value;
    const map = world.maps.get(mapId);
    if (!map) {
      return { valid: false, reason: `Map ${mapId} not found` };
    }

    const buildingDef = world.defs.buildings.get(defId);
    if (!buildingDef) {
      return { valid: false, reason: `Building def ${defId} not found` };
    }

    // Check that the target cells are passable (not blocked by existing impassable objects)
    const c = cell as CellCoord;
    const size = buildingDef.size;
    for (let dy = 0; dy < size.height; dy++) {
      for (let dx = 0; dx < size.width; dx++) {
        const checkCell = { x: c.x + dx, y: c.y + dy };
        if (!map.terrain.inBounds(checkCell.x, checkCell.y)) {
          return { valid: false, reason: `Cell (${checkCell.x},${checkCell.y}) out of bounds` };
        }
      }
    }

    return { valid: true };
  },

  execute(world: World, cmd: Command) {
    const { defId, cell, rotation } = cmd.payload as {
      defId: DefId;
      cell: CellCoord;
      mapId?: MapId;
      rotation?: Rotation;
    };

    const mapId = (cmd.payload.mapId as string) ?? world.maps.keys().next().value;
    const map = world.maps.get(mapId)!;
    const buildingDef = world.defs.buildings.get(defId)!;

    const materialsRequired: MaterialReq[] = buildingDef.costList.map(cost => ({
      defId: cost.defId,
      count: cost.count,
    }));

    const materialsDelivered: MaterialReq[] = buildingDef.costList.map(cost => ({
      defId: cost.defId,
      count: 0,
    }));

    const blueprint: Blueprint = {
      id: nextObjectId(),
      kind: ObjectKind.Blueprint,
      defId: `blueprint_${defId}`,
      mapId: mapId as string,
      cell: { x: (cell as CellCoord).x, y: (cell as CellCoord).y },
      footprint: buildingDef.size,
      tags: new Set(['blueprint', 'construction']),
      destroyed: false,
      targetDefId: defId,
      rotation: rotation ?? Rotation.North,
      materialsRequired,
      materialsDelivered,
    };

    map.objects.add(blueprint);

    log.info('construction', `Blueprint placed for ${defId} at (${blueprint.cell.x},${blueprint.cell.y})`, {
      blueprintId: blueprint.id,
    });

    const events: GameEvent[] = [
      {
        type: 'blueprint_placed',
        tick: world.tick,
        data: {
          blueprintId: blueprint.id,
          defId,
          cell: blueprint.cell,
          mapId,
        },
      },
    ];

    return { events };
  },
};

// ── cancel_construction ──

export const cancelConstructionHandler: CommandHandler = {
  type: 'cancel_construction',

  validate(world: World, cmd: Command) {
    const { targetId } = cmd.payload as {
      targetId: string;
      mapId?: MapId;
    };

    const mapId = (cmd.payload.mapId as string) ?? world.maps.keys().next().value;
    const map = world.maps.get(mapId);
    if (!map) {
      return { valid: false, reason: `Map ${mapId} not found` };
    }

    const obj = map.objects.get(targetId);
    if (!obj) {
      return { valid: false, reason: `Object ${targetId} not found` };
    }

    if (obj.kind !== ObjectKind.Blueprint && obj.kind !== ObjectKind.ConstructionSite) {
      return { valid: false, reason: `Object ${targetId} is not a blueprint or construction site` };
    }

    return { valid: true };
  },

  execute(world: World, cmd: Command) {
    const { targetId } = cmd.payload as {
      targetId: string;
      mapId?: MapId;
    };

    const mapId = (cmd.payload.mapId as string) ?? world.maps.keys().next().value;
    const map = world.maps.get(mapId)!;
    const obj = map.objects.get(targetId)!;
    const events: GameEvent[] = [];

    // If it's a blueprint with delivered materials, drop them as items
    if (obj.kind === ObjectKind.Blueprint) {
      const bp = obj as Blueprint;
      for (const mat of bp.materialsDelivered) {
        if (mat.count > 0) {
          const item = {
            id: nextObjectId(),
            kind: ObjectKind.Item,
            defId: mat.defId,
            mapId: mapId as string,
            cell: { x: bp.cell.x, y: bp.cell.y },
            tags: new Set(['haulable', 'resource']),
            destroyed: false,
            stackCount: mat.count,
            maxStack: 100,
          };
          map.objects.add(item as any);

          events.push({
            type: 'item_dropped',
            tick: world.tick,
            data: { itemId: item.id, defId: mat.defId, count: mat.count, cell: bp.cell },
          });
        }
      }
    }

    // If it's a construction site, refund materials proportionally
    if (obj.kind === ObjectKind.ConstructionSite) {
      const site = obj as any;
      const buildingDef = world.defs.buildings.get(site.targetDefId);
      if (buildingDef) {
        const refundRatio = Math.max(0, 1 - (site.buildProgress ?? 0));
        for (const cost of buildingDef.costList) {
          const refundCount = Math.floor(cost.count * refundRatio);
          if (refundCount > 0) {
            const item = {
              id: nextObjectId(),
              kind: ObjectKind.Item,
              defId: cost.defId,
              mapId: mapId as string,
              cell: { x: site.cell.x, y: site.cell.y },
              tags: new Set(['haulable', 'resource']),
              destroyed: false,
              stackCount: refundCount,
              maxStack: 100,
            };
            map.objects.add(item as any);
          }
        }
      }
    }

    // Release any reservations on this target object
    const res = map.reservations.getReservation(targetId);
    if (res) {
      map.reservations.release(res.id);
    }

    // Interrupt any pawns whose current job targets this object
    const pawns = map.objects.allOfKind(ObjectKind.Pawn);
    for (const pawn of pawns) {
      const p = pawn as any;
      if (p.ai?.currentJob?.targetId === targetId) {
        // Interrupt pawn: release their reservations and reset AI
        if (p.ai.currentJob.reservations) {
          for (const resId of p.ai.currentJob.reservations) {
            map.reservations.release(resId);
          }
        }
        map.reservations.releaseAllByPawn(p.id);
        p.ai.currentJob = null;
        p.ai.currentToilIndex = 0;
        p.ai.toilState = {};
        p.movement.path = [];
        p.movement.pathIndex = 0;

        world.eventBuffer.push({
          type: 'job_interrupted',
          tick: world.tick,
          data: { pawnId: p.id, reason: 'construction_cancelled' },
        });
      }
    }

    // Remove the object
    map.objects.remove(targetId);

    log.info('construction', `Construction cancelled: ${targetId}`);

    events.push({
      type: 'construction_cancelled',
      tick: world.tick,
      data: { targetId, mapId },
    });

    return { events };
  },
};

export const constructionCommandHandlers: CommandHandler[] = [
  placeBlueprintHandler,
  cancelConstructionHandler,
];
