import { ObjectKind, ToilType, ToilState, JobState } from '../../core/types';
import type { CellCoord, ObjectId, JobId } from '../../core/types';
import type { CommandHandler, Command, ValidationResult, ExecutionResult } from '../../core/command-bus';
import type { World } from '../../world/world';
import type { Pawn, Job, Toil } from './pawn.types';

// ── Helpers ──

function getPawn(world: World, pawnId: ObjectId): Pawn | undefined {
  for (const [, map] of world.maps) {
    const obj = map.objects.get(pawnId);
    if (obj && obj.kind === ObjectKind.Pawn) return obj as Pawn;
  }
  return undefined;
}

let _nextJobId = 1;
function nextJobId(): JobId {
  return `job_${_nextJobId++}`;
}

// ── draft_pawn ──

export const draftPawnHandler: CommandHandler = {
  type: 'draft_pawn',

  validate(world: World, cmd: Command): ValidationResult {
    const pawnId = cmd.payload.pawnId as ObjectId | undefined;
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };
    const pawn = getPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };
    if (pawn.drafted) return { valid: false, reason: `Pawn ${pawnId} is already drafted` };
    return { valid: true };
  },

  execute(world: World, cmd: Command): ExecutionResult {
    const pawnId = cmd.payload.pawnId as ObjectId;
    const pawn = getPawn(world, pawnId)!;
    pawn.drafted = true;

    // Cancel current job when drafted
    if (pawn.ai.currentJob) {
      pawn.ai.currentJob.state = JobState.Interrupted;
      pawn.ai.currentJob = null;
      pawn.ai.currentToilIndex = 0;
      pawn.ai.toilState = {};
    }

    return {
      events: [{
        type: 'pawn_drafted',
        tick: world.tick,
        data: { pawnId },
      }],
    };
  },
};

// ── undraft_pawn ──

export const undraftPawnHandler: CommandHandler = {
  type: 'undraft_pawn',

  validate(world: World, cmd: Command): ValidationResult {
    const pawnId = cmd.payload.pawnId as ObjectId | undefined;
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };
    const pawn = getPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };
    if (!pawn.drafted) return { valid: false, reason: `Pawn ${pawnId} is not drafted` };
    return { valid: true };
  },

  execute(world: World, cmd: Command): ExecutionResult {
    const pawnId = cmd.payload.pawnId as ObjectId;
    const pawn = getPawn(world, pawnId)!;
    pawn.drafted = false;

    return {
      events: [{
        type: 'pawn_undrafted',
        tick: world.tick,
        data: { pawnId },
      }],
    };
  },
};

// ── force_job (creates a goto job) ──

export const forceJobHandler: CommandHandler = {
  type: 'force_job',

  validate(world: World, cmd: Command): ValidationResult {
    const pawnId = cmd.payload.pawnId as ObjectId | undefined;
    const targetCell = cmd.payload.targetCell as CellCoord | undefined;
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };
    if (!targetCell) return { valid: false, reason: 'Missing targetCell' };
    const pawn = getPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };
    return { valid: true };
  },

  execute(world: World, cmd: Command): ExecutionResult {
    const pawnId = cmd.payload.pawnId as ObjectId;
    const targetCell = cmd.payload.targetCell as CellCoord;
    const pawn = getPawn(world, pawnId)!;

    const gotoToil: Toil = {
      type: ToilType.GoTo,
      targetCell,
      state: ToilState.NotStarted,
      localData: {},
    };

    const job: Job = {
      id: nextJobId(),
      defId: 'goto',
      pawnId,
      targetCell,
      toils: [gotoToil],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Starting,
    };

    // Replace any current job
    if (pawn.ai.currentJob) {
      pawn.ai.currentJob.state = JobState.Interrupted;
    }

    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = 0;
    pawn.ai.toilState = {};

    return {
      events: [{
        type: 'job_forced',
        tick: world.tick,
        data: { pawnId, jobId: job.id, targetCell },
      }],
    };
  },
};

// ── Export all command handlers ──
export const pawnCommandHandlers: CommandHandler[] = [
  draftPawnHandler,
  undraftPawnHandler,
  forceJobHandler,
];
