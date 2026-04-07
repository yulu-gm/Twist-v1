import { CellCoord } from '../../core/types';

export interface PathOptions {
  maxSearchNodes?: number;
  avoidDanger?: boolean;
  canOpenDoors?: boolean;
}

export interface PathResult {
  found: boolean;
  path: CellCoord[];
  cost: number;
}
