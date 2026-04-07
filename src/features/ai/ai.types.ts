import {
  ObjectId, DefId, CellCoord, JobId, ToilType, ToilState, JobState,
} from '../../core/types';

// ── Toil ──
export interface Toil {
  type: ToilType;
  targetId?: ObjectId;
  targetCell?: CellCoord;
  state: ToilState;
  localData: Record<string, unknown>;
}

// ── Job ──
export interface Job {
  id: JobId;
  defId: DefId;
  pawnId: ObjectId;
  targetId?: ObjectId;
  targetCell?: CellCoord;
  toils: Toil[];
  currentToilIndex: number;
  reservations: string[];
  state: JobState;
}

// ── Utility scoring ──
export interface JobCandidate {
  job: Job;
  score: number;
}

export interface WorkEntry {
  type: string;
  targetId?: ObjectId;
  targetCell?: CellCoord;
  priority: number;
}

// Re-export enums for convenience
export { JobState, ToilState, ToilType } from '../../core/types';
