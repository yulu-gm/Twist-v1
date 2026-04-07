import {
  ObjectKind,
  nextObjectId,
  ScheduleActivity,
} from '../../core/types';
import type {
  CellCoord,
  MapId,
  FactionId,
  ScheduleEntry,
  SkillId,
  SkillLevel,
} from '../../core/types';
import type { SeededRandom } from '../../core/seeded-random';
import type { Pawn } from './pawn.types';

/** Default 24-hour schedule: sleep 0-5, anything 6-21, joy 22-23. */
function defaultSchedule(): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  for (let h = 0; h < 24; h++) {
    let activity: ScheduleActivity;
    if (h < 6) {
      activity = ScheduleActivity.Sleep;
    } else if (h >= 22) {
      activity = ScheduleActivity.Joy;
    } else {
      activity = ScheduleActivity.Anything;
    }
    entries.push({ hour: h, activity });
  }
  return entries;
}

/** Baseline skills every pawn starts with. */
function defaultSkills(): Record<SkillId, SkillLevel> {
  const base: Record<SkillId, SkillLevel> = {};
  const defaultIds: SkillId[] = ['mining', 'construction', 'growing', 'hauling'];
  for (const id of defaultIds) {
    base[id] = { level: 0, xp: 0 };
  }
  return base;
}

export function createPawn(params: {
  name: string;
  cell: CellCoord;
  mapId: MapId;
  factionId: FactionId;
  rng: SeededRandom;
}): Pawn {
  const { name, cell, mapId, factionId } = params;

  return {
    id: nextObjectId(),
    kind: ObjectKind.Pawn,
    defId: 'pawn',
    mapId,
    cell: { x: cell.x, y: cell.y },
    tags: new Set(['selectable', 'pawn']),
    destroyed: false,

    name,
    factionId,
    drafted: false,

    movement: {
      path: null,
      pathIndex: 0,
      moveProgress: 0,
      speed: 1,
    },

    needs: {
      food: 100,
      rest: 100,
      joy: 100,
      mood: 50,
    },

    health: {
      hp: 100,
      maxHp: 100,
      injuries: [],
    },

    skills: defaultSkills(),

    inventory: {
      carrying: null,
      carryCapacity: 75,
    },

    ai: {
      currentJob: null,
      currentToilIndex: 0,
      toilState: {},
      idleTicks: 0,
    },

    schedule: {
      entries: defaultSchedule(),
    },
  };
}
