import {
  ObjectKind, TickPhase, cellEquals,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';

/** Pawn shape (duck-typed subset) used by this system */
interface MovablePawn {
  id: string;
  kind: ObjectKind;
  cell: { x: number; y: number };
  movement: {
    path: { x: number; y: number }[];
    pathIndex: number;
    moveProgress: number;
    speed: number;
  };
}

export const movementSystem: SystemRegistration = {
  id: 'movement',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(map);
    }
  },
};

function processMap(map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn) as unknown as MovablePawn[];

  for (const pawn of pawns) {
    const mv = pawn.movement;
    if (!mv.path || mv.path.length === 0) continue;

    // If pathIndex has gone past the path, clear and skip
    if (mv.pathIndex >= mv.path.length) {
      mv.path = [];
      mv.pathIndex = 0;
      mv.moveProgress = 0;
      continue;
    }

    const targetCell = mv.path[mv.pathIndex];

    // If already at target cell, advance index
    if (cellEquals(pawn.cell, targetCell)) {
      mv.pathIndex++;
      mv.moveProgress = 0;

      // Check if path complete
      if (mv.pathIndex >= mv.path.length) {
        mv.path = [];
        mv.pathIndex = 0;
        mv.moveProgress = 0;
        log.debug('path', `Pawn ${pawn.id} finished path`, undefined, pawn.id);
      }
      continue;
    }

    // Advance movement progress
    mv.moveProgress += mv.speed;

    if (mv.moveProgress >= 1) {
      // Check target cell is still passable
      if (!map.spatial.isPassable(targetCell) && !cellEquals(targetCell, pawn.cell)) {
        // Path blocked — clear path, let AI re-plan
        log.debug('path', `Pawn ${pawn.id} path blocked at (${targetCell.x},${targetCell.y})`, undefined, pawn.id);
        mv.path = [];
        mv.pathIndex = 0;
        mv.moveProgress = 0;
        continue;
      }

      const prevCell = { x: pawn.cell.x, y: pawn.cell.y };

      // Move to next cell
      pawn.cell = { x: targetCell.x, y: targetCell.y };
      map.spatial.onObjectMoved(pawn.id, prevCell, pawn.cell);

      mv.moveProgress = 0;
      mv.pathIndex++;

      // Check if path complete
      if (mv.pathIndex >= mv.path.length) {
        mv.path = [];
        mv.pathIndex = 0;
        mv.moveProgress = 0;
        log.debug('path', `Pawn ${pawn.id} finished path`, undefined, pawn.id);
      }
    }
  }
}
