import { MapId, CellCoord, CellCoordKey, TerrainDefId, ObjectId, ZoneId, ObjectKind } from '../core/types';
import { Grid } from '../core/grid';
import { ObjectPool } from '../core/object-pool';
import { SpatialIndex } from '../core/spatial-index';
import type { MapObjectBase } from '../core/types';
import type { DefDatabase } from './def-database';

// ── Zone ──
export interface Zone {
  id: ZoneId;
  zoneType: string;
  cells: Set<CellCoordKey>;
  config: Record<string, unknown>;
}

// ── ZoneManager ──
export class ZoneManager {
  private zones: Map<ZoneId, Zone> = new Map();

  add(zone: Zone): void {
    this.zones.set(zone.id, zone);
  }

  remove(id: ZoneId): void {
    this.zones.delete(id);
  }

  get(id: ZoneId): Zone | undefined {
    return this.zones.get(id);
  }

  getAll(): Zone[] {
    return Array.from(this.zones.values());
  }

  getZoneAt(key: CellCoordKey): Zone | undefined {
    for (const zone of this.zones.values()) {
      if (zone.cells.has(key)) return zone;
    }
    return undefined;
  }
}

// ── Room ──
export interface Room {
  id: string;
  cells: Set<CellCoordKey>;
  isOutdoor: boolean;
  temperature: number;
  impressiveness: number;
}

// ── RoomGraph ──
export class RoomGraph {
  rooms: Room[] = [];
  dirty = true;

  markDirty(): void { this.dirty = true; }

  rebuild(_map: GameMap): void {
    // Simplified room detection — will be implemented in room system
    this.dirty = false;
  }
}

// ── ReservationTable ──
export interface Reservation {
  id: string;
  claimantId: ObjectId;
  targetId: ObjectId;
  jobId: string;
  targetCell?: CellCoord;
  expiresAtTick: number;
}

export class ReservationTable {
  private reservations: Map<string, Reservation> = new Map();
  private byTarget: Map<ObjectId, string> = new Map();
  private nextId = 1;

  tryReserve(req: {
    claimantId: ObjectId;
    targetId: ObjectId;
    jobId: string;
    currentTick: number;
    maxTick?: number;
  }): string | null {
    if (this.byTarget.has(req.targetId)) return null;

    const id = `res_${this.nextId++}`;
    const reservation: Reservation = {
      id,
      claimantId: req.claimantId,
      targetId: req.targetId,
      jobId: req.jobId,
      expiresAtTick: req.currentTick + (req.maxTick ?? 5000),
    };
    this.reservations.set(id, reservation);
    this.byTarget.set(req.targetId, id);
    return id;
  }

  release(id: string): void {
    const res = this.reservations.get(id);
    if (res) {
      this.byTarget.delete(res.targetId);
      this.reservations.delete(id);
    }
  }

  isReserved(targetId: ObjectId): boolean {
    return this.byTarget.has(targetId);
  }

  getReservation(targetId: ObjectId): Reservation | null {
    const id = this.byTarget.get(targetId);
    if (!id) return null;
    return this.reservations.get(id) ?? null;
  }

  getAllByPawn(pawnId: ObjectId): Reservation[] {
    return Array.from(this.reservations.values()).filter(r => r.claimantId === pawnId);
  }

  getAll(): Reservation[] {
    return Array.from(this.reservations.values());
  }

  cleanupExpired(currentTick: number): void {
    for (const [id, res] of this.reservations) {
      if (currentTick >= res.expiresAtTick) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }

  releaseAllByPawn(pawnId: ObjectId): void {
    for (const [id, res] of this.reservations) {
      if (res.claimantId === pawnId) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }

  releaseAllForJob(jobId: string): void {
    for (const [id, res] of this.reservations) {
      if (res.jobId === jobId) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }
}

// ── PathGrid ──
export class PathGrid {
  private passable: Grid<boolean>;

  constructor(width: number, height: number) {
    this.passable = new Grid(width, height, true);
  }

  isPassable(x: number, y: number): boolean {
    return this.passable.inBounds(x, y) && this.passable.get(x, y);
  }

  setPassable(x: number, y: number, value: boolean): void {
    if (this.passable.inBounds(x, y)) {
      this.passable.set(x, y, value);
    }
  }

  get width(): number { return this.passable.width; }
  get height(): number { return this.passable.height; }

  rebuildFrom(map: GameMap, defs?: DefDatabase): void {
    const terrain = map.terrain;
    terrain.forEach((x, y, defId) => {
      if (defs) {
        const tDef = defs.terrains.get(defId);
        this.passable.set(x, y, tDef ? tDef.passable : true);
      } else {
        // Fallback: known impassable terrain types
        const impassable = defId === 'rock' || defId === 'water';
        this.passable.set(x, y, !impassable);
      }
    });
    // Mark cells occupied by movement-blocking buildings
    map.objects.allOfKind(ObjectKind.Building).forEach((obj: MapObjectBase) => {
      if (defs) {
        const bDef = defs.buildings.get(obj.defId);
        if (bDef && bDef.blocksMovement) {
          const fp = obj.footprint ?? { width: 1, height: 1 };
          for (let dy = 0; dy < fp.height; dy++) {
            for (let dx = 0; dx < fp.width; dx++) {
              this.setPassable(obj.cell.x + dx, obj.cell.y + dy, false);
            }
          }
        }
      } else if (obj.tags.has('impassable')) {
        const fp = obj.footprint ?? { width: 1, height: 1 };
        for (let dy = 0; dy < fp.height; dy++) {
          for (let dx = 0; dx < fp.width; dx++) {
            this.setPassable(obj.cell.x + dx, obj.cell.y + dy, false);
          }
        }
      }
    });
  }
}

// ── GameMap ──
export interface GameMap {
  id: MapId;
  width: number;
  height: number;
  terrain: Grid<TerrainDefId>;
  objects: ObjectPool;
  spatial: SpatialIndex;
  zones: ZoneManager;
  rooms: RoomGraph;
  reservations: ReservationTable;
  pathGrid: PathGrid;
  temperature: Grid<number>;
  beauty: Grid<number>;
}

export function createGameMap(config: { id: MapId; width: number; height: number }): GameMap {
  const { id, width, height } = config;

  const spatial = new SpatialIndex(width, height);
  const objects = new ObjectPool({
    onAdd: (obj) => {
      spatial.onObjectAdded(obj.id, obj.cell, obj.footprint, obj.tags.has('impassable'));
    },
    onRemove: (obj) => {
      spatial.onObjectRemoved(obj.id, obj.cell, obj.footprint);
    },
  });

  return {
    id,
    width,
    height,
    terrain: new Grid<TerrainDefId>(width, height, 'grass'),
    objects,
    spatial,
    zones: new ZoneManager(),
    rooms: new RoomGraph(),
    reservations: new ReservationTable(),
    pathGrid: new PathGrid(width, height),
    temperature: new Grid<number>(width, height, 20),
    beauty: new Grid<number>(width, height, 0),
  };
}
