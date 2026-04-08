import { CommandHandler, Command } from '../../core/command-bus';
import { GameEvent } from '../../core/event-bus';
import { CURRENT_SAVE_VERSION, applyMigrations } from '../../core/serialization';
import { currentIdCounter, resetIdCounter, MapId, Tag, ObjectKind } from '../../core/types';
import { World, Faction } from '../../world/world';
import { createGameMap, Zone } from '../../world/game-map';
import { Grid } from '../../core/grid';
import { SaveData, MapSaveData } from './save.types';

const SAVE_KEY = 'opus_world_save';

// ── Serialization helpers ──

/**
 * Convert a MapObjectBase (with Set<Tag> tags, etc.) to a plain object
 * with Sets as arrays for JSON serialization. Handles nested objects.
 */
function serializeObject(obj: any): any {
  const serialized: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value instanceof Set) {
      serialized[key] = Array.from(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested plain objects to catch nested Sets
      serialized[key] = serializeObject(value);
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

/**
 * Convert a serialized object (with tags as string[]) back to a
 * MapObjectBase with tags as Set<Tag>.
 * Also handles nested Set fields like building.storage.allowedDefIds.
 */
function deserializeObject(data: any): any {
  const obj: any = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (key === 'tags' && Array.isArray(value)) {
      obj[key] = new Set<Tag>(value);
    } else if (key === 'cells' && Array.isArray(value)) {
      obj[key] = new Set(value);
    } else if (key === 'storage' && value && typeof value === 'object') {
      obj[key] = {
        ...value,
        allowedDefIds: Array.isArray(value.allowedDefIds)
          ? new Set(value.allowedDefIds)
          : value.allowedDefIds,
      };
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

/**
 * Serialize a Zone (with Set<CellCoordKey> cells) to a plain object.
 */
function serializeZone(zone: Zone): any {
  return {
    id: zone.id,
    zoneType: zone.zoneType,
    cells: Array.from(zone.cells),
    config: zone.config,
  };
}

/**
 * Deserialize a Zone back from a plain object.
 */
function deserializeZone(data: any): Zone {
  return {
    id: data.id,
    zoneType: data.zoneType,
    cells: new Set(data.cells),
    config: data.config,
  };
}

// ── save_game handler ──

export const saveGameHandler: CommandHandler = {
  type: 'save_game',

  validate(_world: any, _cmd: Command) {
    return { valid: true };
  },

  execute(world: World, _cmd: Command) {
    const mapSaves: MapSaveData[] = [];

    for (const [, map] of world.maps) {
      const objects = map.objects.all().map(serializeObject);
      const zones = map.zones.getAll().map(serializeZone);
      const reservations = map.reservations.getAll();

      mapSaves.push({
        id: map.id,
        width: map.width,
        height: map.height,
        terrain: map.terrain.toFlatArray(),
        objects,
        zones,
        reservations,
      });
    }

    const factions: SaveData['factions'] = [];
    for (const [, faction] of world.factions) {
      factions.push({
        id: faction.id,
        name: faction.name,
        isPlayer: faction.isPlayer,
        hostile: faction.hostile,
      });
    }

    const saveData: SaveData = {
      version: CURRENT_SAVE_VERSION,
      tick: world.tick,
      clockState: {
        totalTicks: world.clock.totalTicks,
        hour: world.clock.hour,
        day: world.clock.day,
        season: world.clock.season,
        year: world.clock.year,
      },
      rngState: world.rng.getState(),
      speed: world.speed,
      maps: mapSaves,
      factions,
      storyState: {
        threatLevel: world.storyState.threatLevel,
        daysSinceLastRaid: world.storyState.daysSinceLastRaid,
        totalWealth: world.storyState.totalWealth,
      },
      nextObjectId: currentIdCounter(),
    };

    const json = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY, json);

    const events: GameEvent[] = [
      {
        type: 'game_saved',
        tick: world.tick,
        data: {},
      },
    ];

    return { events };
  },
};

// ── load_game handler ──

export const loadGameHandler: CommandHandler = {
  type: 'load_game',

  validate(_world: any, _cmd: Command) {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { valid: false, reason: 'No save data found in localStorage' };
    }
    return { valid: true };
  },

  execute(world: World, _cmd: Command) {
    const raw = localStorage.getItem(SAVE_KEY)!;
    let savedData: SaveData = JSON.parse(raw);

    // Apply any version migrations
    savedData = applyMigrations(savedData) as SaveData;

    // Restore top-level world state
    world.tick = savedData.tick;
    world.clock.totalTicks = savedData.clockState.totalTicks;
    world.clock.hour = savedData.clockState.hour;
    world.clock.day = savedData.clockState.day;
    world.clock.season = savedData.clockState.season;
    world.clock.year = savedData.clockState.year;
    world.rng.setState(savedData.rngState);
    world.speed = savedData.speed;
    resetIdCounter(savedData.nextObjectId);

    // Restore story state
    world.storyState.threatLevel = savedData.storyState.threatLevel;
    world.storyState.daysSinceLastRaid = savedData.storyState.daysSinceLastRaid;
    world.storyState.totalWealth = savedData.storyState.totalWealth;

    // Restore factions
    world.factions.clear();
    for (const f of savedData.factions) {
      const faction: Faction = {
        id: f.id,
        name: f.name,
        isPlayer: f.isPlayer,
        hostile: f.hostile,
      };
      world.factions.set(f.id, faction);
    }

    // Restore maps
    world.maps.clear();
    for (const mapData of savedData.maps) {
      const map = createGameMap({
        id: mapData.id,
        width: mapData.width,
        height: mapData.height,
      });

      // Rebuild terrain from flat array
      const terrainGrid = Grid.fromFlatArray(mapData.width, mapData.height, mapData.terrain);
      terrainGrid.forEach((x, y, value) => {
        map.terrain.set(x, y, value);
      });

      // Recreate objects (restore Set<Tag> from string[])
      for (const objData of mapData.objects) {
        const obj = deserializeObject(objData);
        map.objects.add(obj);
      }

      // Recreate zones
      for (const zoneData of mapData.zones) {
        const zone = deserializeZone(zoneData);
        map.zones.add(zone);
      }

      // Recreate reservations
      for (const resData of mapData.reservations) {
        // Directly add reservation via tryReserve is not ideal since it
        // has its own ID generation. We re-create by inserting manually.
        // The ReservationTable doesn't expose a raw add, so we use tryReserve
        // and accept that reservation IDs may differ. The important state
        // (claimant, target, job, expiry) is preserved.
        map.reservations.tryReserve({
          claimantId: resData.claimantId,
          targetId: resData.targetId,
          jobId: resData.jobId,
          currentTick: world.tick,
          maxTick: resData.expiresAtTick - world.tick,
        });
      }

      world.maps.set(mapData.id as MapId, map);

      // Rebuild pathGrid from terrain + buildings
      map.pathGrid.rebuildFrom(map, world.defs);

      // Clear active pawn jobs — they may not deserialize correctly
      const pawns = map.objects.allOfKind(ObjectKind.Pawn);
      for (const pawn of pawns) {
        const p = pawn as any;
        if (p.ai) {
          p.ai.currentJob = null;
          p.ai.currentToilIndex = 0;
          p.ai.toilState = {};
          p.ai.idleTicks = 0;
        }
        if (p.movement) {
          p.movement.path = [];
          p.movement.pathIndex = 0;
          p.movement.moveProgress = 0;
        }
        if (p.inventory) {
          p.inventory.carrying = null;
        }
      }
    }

    // Clear command queue and event buffer
    world.commandQueue.length = 0;
    world.eventBuffer.length = 0;

    const events: GameEvent[] = [
      {
        type: 'game_loaded',
        tick: world.tick,
        data: {},
      },
    ];

    return { events };
  },
};

export const saveCommandHandlers: CommandHandler[] = [
  saveGameHandler,
  loadGameHandler,
];
