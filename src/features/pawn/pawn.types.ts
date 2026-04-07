import type {
  ObjectId,
  ObjectKind,
  CellCoord,
  MapObjectBase,
  DefId,
  FactionId,
  Injury,
  ScheduleEntry,
  SkillId,
  SkillLevel,
  ToilType,
  ToilState,
  JobState,
  JobId,
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

// ── Pawn ──
export interface Pawn extends MapObjectBase {
  kind: ObjectKind.Pawn;
  name: string;
  factionId: FactionId;
  drafted: boolean;
  movement: {
    path: CellCoord[] | null;
    pathIndex: number;
    moveProgress: number;
    speed: number;
  };
  needs: {
    food: number;
    rest: number;
    joy: number;
    mood: number;
  };
  health: {
    hp: number;
    maxHp: number;
    injuries: Injury[];
  };
  skills: Record<SkillId, SkillLevel>;
  inventory: {
    carrying: ObjectId | null;
    carryCapacity: number;
  };
  ai: {
    currentJob: Job | null;
    currentToilIndex: number;
    toilState: Record<string, unknown>;
    idleTicks: number;
  };
  schedule: {
    entries: ScheduleEntry[];
  };
}
