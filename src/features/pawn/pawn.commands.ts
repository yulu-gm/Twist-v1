/**
 * @file pawn.commands.ts
 * @description 棋子相关的命令处理器，包括征召、取消征召和强制工作命令
 * @dependencies core/types, core/command-bus, world/world, pawn.types
 * @part-of features/pawn 棋子功能模块
 */

import { ObjectKind, ToilType, ToilState, JobState } from '../../core/types';
import type { CellCoord, ObjectId, JobId } from '../../core/types';
import type { CommandHandler, Command, ValidationResult, ExecutionResult } from '../../core/command-bus';
import type { World } from '../../world/world';
import type { Pawn, Job, Toil } from './pawn.types';

// ── 辅助函数 ──

/**
 * 在所有地图中查找指定ID的棋子
 * @param world - 世界对象
 * @param pawnId - 棋子ID
 * @returns 找到的棋子对象，未找到则返回 undefined
 */
function getPawn(world: World, pawnId: ObjectId): Pawn | undefined {
  for (const [, map] of world.maps) {
    const obj = map.objects.get(pawnId);
    if (obj && obj.kind === ObjectKind.Pawn) return obj as Pawn;
  }
  return undefined;
}

/** 工作ID自增计数器 */
let _nextJobId = 1;
/** 生成下一个唯一的工作ID */
function nextJobId(): JobId {
  return `job_${_nextJobId++}`;
}

// ── draft_pawn（征召棋子命令） ──

/**
 * 征召棋子命令处理器
 * 将棋子设为征召状态，由玩家直接控制移动；征召时会中断当前工作
 */
export const draftPawnHandler: CommandHandler = {
  type: 'draft_pawn',

  /** 验证：检查 pawnId 是否存在且棋子未被征召 */
  validate(world: World, cmd: Command): ValidationResult {
    const pawnId = cmd.payload.pawnId as ObjectId | undefined;
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };
    const pawn = getPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };
    if (pawn.drafted) return { valid: false, reason: `Pawn ${pawnId} is already drafted` };
    return { valid: true };
  },

  /** 执行：将棋子设为征召状态，中断当前工作，发出 pawn_drafted 事件 */
  execute(world: World, cmd: Command): ExecutionResult {
    const pawnId = cmd.payload.pawnId as ObjectId;
    const pawn = getPawn(world, pawnId)!;
    pawn.drafted = true;

    // 征召时取消当前工作
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

// ── undraft_pawn（取消征召命令） ──

/**
 * 取消征召命令处理器
 * 将棋子恢复为自主 AI 控制状态
 */
export const undraftPawnHandler: CommandHandler = {
  type: 'undraft_pawn',

  /** 验证：检查 pawnId 是否存在且棋子已被征召 */
  validate(world: World, cmd: Command): ValidationResult {
    const pawnId = cmd.payload.pawnId as ObjectId | undefined;
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };
    const pawn = getPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };
    if (!pawn.drafted) return { valid: false, reason: `Pawn ${pawnId} is not drafted` };
    return { valid: true };
  },

  /** 执行：取消征召状态，发出 pawn_undrafted 事件 */
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

// ── force_job（强制工作命令：创建一个前往目标的 goto 工作） ──

/**
 * 强制工作命令处理器
 * 创建一个 GoTo 类型的工作，让棋子移动到指定格子；会中断当前正在进行的工作
 */
export const forceJobHandler: CommandHandler = {
  type: 'force_job',

  /** 验证：检查 pawnId 和 targetCell 是否存在 */
  validate(world: World, cmd: Command): ValidationResult {
    const pawnId = cmd.payload.pawnId as ObjectId | undefined;
    const targetCell = cmd.payload.targetCell as CellCoord | undefined;
    if (!pawnId) return { valid: false, reason: 'Missing pawnId' };
    if (!targetCell) return { valid: false, reason: 'Missing targetCell' };
    const pawn = getPawn(world, pawnId);
    if (!pawn) return { valid: false, reason: `Pawn ${pawnId} not found` };
    return { valid: true };
  },

  /** 执行：创建 GoTo 工作并指派给棋子，中断旧工作，发出 job_forced 事件 */
  execute(world: World, cmd: Command): ExecutionResult {
    const pawnId = cmd.payload.pawnId as ObjectId;
    const targetCell = cmd.payload.targetCell as CellCoord;
    const pawn = getPawn(world, pawnId)!;

    /** 构建一个 GoTo 劳作步骤 */
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

    // 替换当前工作（如有）
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

// ── 导出所有棋子命令处理器 ──
export const pawnCommandHandlers: CommandHandler[] = [
  draftPawnHandler,
  undraftPawnHandler,
  forceJobHandler,
];
