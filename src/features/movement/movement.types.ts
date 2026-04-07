import { CellCoord } from '../../core/types';

/** Default movement speed — fraction of a cell per tick */
export const MOVE_SPEED_DEFAULT = 0.1;

/** Movement sub-object shape (lives inside Pawn) */
export interface MovementState {
  path: CellCoord[];
  pathIndex: number;
  moveProgress: number;
  speed: number;
}

export function createDefaultMovement(): MovementState {
  return {
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    speed: MOVE_SPEED_DEFAULT,
  };
}
