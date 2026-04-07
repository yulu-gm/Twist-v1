import { ObjectId, CellCoord, ObjectKind } from './types';
import { log } from './logger';

/**
 * Inspector — debug query interface for examining world state.
 */
export class Inspector {
  private world: any;

  setWorld(world: any): void {
    this.world = world;
  }

  inspectObject(id: ObjectId): any | undefined {
    if (!this.world) return undefined;
    for (const [, map] of this.world.maps) {
      const obj = map.objects.get(id);
      if (obj) return obj;
    }
    return undefined;
  }

  inspectCell(mapId: string, cell: CellCoord): any[] {
    if (!this.world) return [];
    const map = this.world.maps.get(mapId);
    if (!map) return [];
    const ids = map.spatial.getAt(cell);
    return ids.map((id: ObjectId) => map.objects.get(id)).filter(Boolean);
  }

  inspectReservations(mapId: string): any[] {
    if (!this.world) return [];
    const map = this.world.maps.get(mapId);
    if (!map) return [];
    return map.reservations.getAll();
  }

  inspectPawnJob(pawnId: ObjectId): any | null {
    const obj = this.inspectObject(pawnId);
    if (!obj || obj.kind !== ObjectKind.Pawn) return null;
    return (obj as any).ai?.currentJob ?? null;
  }

  inspectAILog(pawnId: ObjectId, count: number): any[] {
    return log.getEntries({ channel: 'ai', objectId: pawnId, count });
  }
}

export const inspector = new Inspector();
