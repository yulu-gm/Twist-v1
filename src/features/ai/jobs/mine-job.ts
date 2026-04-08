import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';
import { GameMap } from '../../../world/game-map';

const ADJACENT_DIRS: CellCoord[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/** Find a passable cell adjacent to the target (for mining impassable rock) */
export function findAdjacentPassable(target: CellCoord, map: GameMap): CellCoord | null {
  for (const dir of ADJACENT_DIRS) {
    const nx = target.x + dir.x;
    const ny = target.y + dir.y;
    if (map.pathGrid.isPassable(nx, ny) && map.spatial.isPassable({ x: nx, y: ny })) {
      return { x: nx, y: ny };
    }
  }
  return null;
}

let mineJobCounter = 0;

export function createMineJob(
  pawnId: ObjectId,
  targetCell: CellCoord,
  designationId: ObjectId,
  map?: GameMap,
): Job {
  mineJobCounter++;

  // Mine target is impassable rock — pawn must stand on an adjacent cell
  let gotoCell = targetCell;
  if (map) {
    const adj = findAdjacentPassable(targetCell, map);
    if (adj) gotoCell = adj;
  }

  return {
    id: `job_mine_${mineJobCounter}`,
    defId: 'job_mine',
    pawnId,
    targetId: designationId,
    targetCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell: gotoCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.Work,
        targetCell,
        targetId: designationId,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 100 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
