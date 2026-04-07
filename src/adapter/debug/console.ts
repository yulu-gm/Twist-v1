import type { World } from '../../world/world';
import type { GameMap } from '../../world/game-map';
import { inspector } from '../../core/inspector';
import { log } from '../../core/logger';
import { ObjectKind } from '../../core/types';

/**
 * Debug console — provides a global API for inspecting and manipulating the game
 * from the browser's developer console.
 */
export function installDebugConsole(world: World, map: GameMap): void {
  const debugApi = {
    /** Inspect an object by ID */
    inspect(id: string) {
      return inspector.inspectObject(id);
    },

    /** Inspect a cell */
    cell(x: number, y: number) {
      return inspector.inspectCell(map.id, { x, y });
    },

    /** List all pawns */
    pawns() {
      return map.objects.allOfKind(ObjectKind.Pawn);
    },

    /** Inspect a pawn's current job */
    job(pawnId: string) {
      return inspector.inspectPawnJob(pawnId);
    },

    /** Get AI log for a pawn */
    aiLog(pawnId: string, count = 20) {
      return inspector.inspectAILog(pawnId, count);
    },

    /** List all reservations */
    reservations() {
      return map.reservations.getAll();
    },

    /** List all zones */
    zones() {
      return map.zones.getAll();
    },

    /** List all rooms */
    rooms() {
      return map.rooms.rooms;
    },

    /** Get world tick */
    tick() {
      return world.tick;
    },

    /** Get world state summary */
    status() {
      return {
        tick: world.tick,
        speed: world.speed,
        clock: world.clock,
        objects: map.objects.size,
        pawns: map.objects.allOfKind(ObjectKind.Pawn).length,
        buildings: map.objects.allOfKind(ObjectKind.Building).length,
        items: map.objects.allOfKind(ObjectKind.Item).length,
        plants: map.objects.allOfKind(ObjectKind.Plant).length,
        designations: map.objects.allOfKind(ObjectKind.Designation).length,
        blueprints: map.objects.allOfKind(ObjectKind.Blueprint).length,
        constructionSites: map.objects.allOfKind(ObjectKind.ConstructionSite).length,
        reservations: map.reservations.getAll().length,
      };
    },

    /** Push a command to the queue */
    cmd(type: string, payload: Record<string, unknown> = {}) {
      world.commandQueue.push({ type, payload });
      return `Queued: ${type}`;
    },

    /** Spawn an item */
    spawn(defId: string, x: number, y: number, count = 1) {
      return this.cmd('debug_spawn', { defId, cell: { x, y }, count });
    },

    /** Destroy an object */
    destroy(objectId: string) {
      return this.cmd('debug_destroy', { objectId });
    },

    /** Advance ticks */
    advance(count: number) {
      return this.cmd('debug_advance_ticks', { count });
    },

    /** Get recent log entries */
    logs(count = 30) {
      return log.getEntries({ count });
    },

    /** Get the world object (full access) */
    world() {
      return world;
    },

    /** Get the map object */
    map() {
      return map;
    },
  };

  // Expose on window
  (window as any).opus = debugApi;

  console.log(
    '%c[Opus World] Debug console installed. Type opus.status() to get started.',
    'color: #4fc3f7; font-weight: bold',
  );
  console.log(
    'Available: opus.inspect(id), opus.cell(x,y), opus.pawns(), opus.job(id), ' +
    'opus.spawn(def,x,y), opus.destroy(id), opus.advance(n), opus.status(), opus.logs()',
  );
}
