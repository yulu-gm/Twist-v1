import { TickPhase, ObjectKind, cellKey, CellCoordKey } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import type { GameMap, Room } from '../../world/game-map';

function rebuildRooms(world: World): void {
  for (const [, map] of world.maps) {
    if (!map.rooms.dirty) continue;

    const width = map.width;
    const height = map.height;
    const visited = new Array(width * height).fill(false);
    const rooms: Room[] = [];
    let roomId = 0;

    // Build wall set — cells occupied by impassable objects
    const wallCells = new Set<string>();
    const buildings = map.objects.allOfKind(ObjectKind.Building);
    for (const b of buildings) {
      if (b.tags.has('wall') || b.tags.has('impassable')) {
        const fp = b.footprint ?? { width: 1, height: 1 };
        for (let dy = 0; dy < fp.height; dy++) {
          for (let dx = 0; dx < fp.width; dx++) {
            wallCells.add(cellKey({ x: b.cell.x + dx, y: b.cell.y + dy }));
          }
        }
      }
    }

    // Also check terrain passability
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrain = map.terrain.get(x, y);
        const tDef = world.defs.terrains.get(terrain);
        if (tDef && !tDef.passable) {
          wallCells.add(cellKey({ x, y }));
        }
      }
    }

    // Flood fill
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx]) continue;
        const key = cellKey({ x, y });
        if (wallCells.has(key)) {
          visited[idx] = true;
          continue;
        }

        // BFS flood fill
        const cells = new Set<CellCoordKey>();
        const queue: [number, number][] = [[x, y]];
        let touchesBoundary = false;
        visited[idx] = true;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          cells.add(cellKey({ x: cx, y: cy }));

          if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
            touchesBoundary = true;
          }

          const neighbors = [
            [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
              touchesBoundary = true;
              continue;
            }
            const ni = ny * width + nx;
            if (visited[ni]) continue;
            const nkey = cellKey({ x: nx, y: ny });
            if (wallCells.has(nkey)) continue;
            visited[ni] = true;
            queue.push([nx, ny]);
          }
        }

        rooms.push({
          id: `room_${roomId++}`,
          cells,
          isOutdoor: touchesBoundary,
          temperature: 20,
          impressiveness: 0,
        });
      }
    }

    map.rooms.rooms = rooms;
    map.rooms.dirty = false;
  }
}

export const roomRebuildSystem: SystemRegistration = {
  id: 'room_rebuild',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 1,
  execute: rebuildRooms,
};
