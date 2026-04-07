import {
  MapId,
  ZoneId,
  CellCoordKey,
  cellKey,
  CellCoord,
} from '../../core/types';
import {
  CommandHandler,
  Command,
  ValidationResult,
  ExecutionResult,
} from '../../core/command-bus';
import { World } from '../../world/world';
import { Zone } from '../../world/game-map';

let _nextZoneId = 1;
function nextZoneId(): ZoneId {
  return `zone_${_nextZoneId++}`;
}

// ── zone_set_cells ──

export const zoneSetCellsHandler: CommandHandler = {
  type: 'zone_set_cells',

  validate(world: any, cmd: Command): ValidationResult {
    const { mapId, cells } = cmd.payload as {
      mapId: MapId;
      cells: CellCoord[];
    };
    const map = (world as World).maps.get(mapId);
    if (!map) return { valid: false, reason: `Map ${mapId} not found` };

    if (!cells || cells.length === 0) {
      return { valid: false, reason: 'No cells provided for zone' };
    }

    // Bounds check
    for (const cell of cells) {
      if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) {
        return { valid: false, reason: `Cell (${cell.x},${cell.y}) out of bounds` };
      }
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const { mapId, zoneId, zoneType, cells, config } = cmd.payload as {
      mapId: MapId;
      zoneId?: ZoneId;
      zoneType: string;
      cells: CellCoord[];
      config?: Record<string, unknown>;
    };
    const map = w.maps.get(mapId)!;

    const cellKeys: Set<CellCoordKey> = new Set(cells.map(c => cellKey(c)));

    if (zoneId) {
      // Extend existing zone
      const existing = map.zones.get(zoneId);
      if (existing) {
        for (const key of cellKeys) {
          existing.cells.add(key);
        }
        return {
          events: [{
            type: 'zone_updated',
            tick: w.tick,
            data: { zoneId, cellsAdded: cells.length },
          }],
        };
      }
    }

    // Create new zone
    const id = zoneId ?? nextZoneId();
    const zone: Zone = {
      id,
      zoneType: zoneType,
      cells: cellKeys,
      config: config ?? {},
    };
    map.zones.add(zone);

    return {
      events: [{
        type: 'zone_created',
        tick: w.tick,
        data: { zoneId: id, zoneType, cellCount: cells.length },
      }],
    };
  },
};

// ── zone_delete ──

export const zoneDeleteHandler: CommandHandler = {
  type: 'zone_delete',

  validate(world: any, cmd: Command): ValidationResult {
    const { mapId, zoneId } = cmd.payload as {
      mapId: MapId;
      zoneId: ZoneId;
    };
    const map = (world as World).maps.get(mapId);
    if (!map) return { valid: false, reason: `Map ${mapId} not found` };

    const zone = map.zones.get(zoneId);
    if (!zone) return { valid: false, reason: `Zone ${zoneId} not found` };

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const { mapId, zoneId } = cmd.payload as {
      mapId: MapId;
      zoneId: ZoneId;
    };
    const map = w.maps.get(mapId)!;
    map.zones.remove(zoneId);

    return {
      events: [{
        type: 'zone_deleted',
        tick: w.tick,
        data: { zoneId },
      }],
    };
  },
};

/** All zone command handlers for batch registration. */
export const zoneCommandHandlers: CommandHandler[] = [
  zoneSetCellsHandler,
  zoneDeleteHandler,
];
