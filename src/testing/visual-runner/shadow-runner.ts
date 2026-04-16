/**
 * @file shadow-runner.ts
 * @description Shadow Headless Runner — 在可视模式运行时同步执行一个无头镜像，
 *              并在 checkpoint 时对比两边的 simulation snapshot 检测分歧
 * @dependencies checkpoint-snapshot — 快照类型
 * @part-of testing/visual-runner — 可视运行层
 */

import type { CheckpointSnapshot, PawnSnapshot } from '../scenario-harness/checkpoint-snapshot';

/** 分歧级别 */
export type DivergenceLevel = 'warning' | 'error';

/** 单个分歧记录 */
export interface DivergenceRecord {
  /** 分歧级别 */
  level: DivergenceLevel;
  /** 分歧字段路径 */
  field: string;
  /** visual runner 的值 */
  visualValue: unknown;
  /** headless runner 的值 */
  headlessValue: unknown;
  /** 分歧发生时的 tick */
  tick: number;
}

/** diff 对比选项 */
export interface DiffOptions {
  /** 跳过 tick 比较（visual 模式下 tick 差异是预期行为） */
  skipTick?: boolean;
}

/**
 * 对比两个 checkpoint 快照，返回首次分歧（如果有）
 *
 * @param visual - 可视 runner 的快照
 * @param headless - 无头 runner 的快照
 * @param options - 对比选项
 * @returns 首次分歧记录，或 null 表示无分歧
 */
export function diffCheckpointSnapshots(
  visual: CheckpointSnapshot,
  headless: CheckpointSnapshot,
  options?: DiffOptions,
): DivergenceRecord | null {
  // 比较 tick（可选跳过 — visual 模式下 Phaser 帧驱动与精确步进的 tick 天然不同）
  if (!options?.skipTick && visual.tick !== headless.tick) {
    return {
      level: 'error',
      field: 'tick',
      visualValue: visual.tick,
      headlessValue: headless.tick,
      tick: Math.max(visual.tick, headless.tick),
    };
  }

  // 比较 pawns
  const pawnDiff = diffPawns(visual.pawns, headless.pawns, visual.tick);
  if (pawnDiff) return pawnDiff;

  // 比较 items 数量
  if (visual.items.length !== headless.items.length) {
    return {
      level: 'error',
      field: 'items.length',
      visualValue: visual.items.length,
      headlessValue: headless.items.length,
      tick: visual.tick,
    };
  }

  // 比较 designations 数量
  if (visual.designations.length !== headless.designations.length) {
    return {
      level: 'warning',
      field: 'designations.length',
      visualValue: visual.designations.length,
      headlessValue: headless.designations.length,
      tick: visual.tick,
    };
  }

  // 比较 blueprints 数量
  if (visual.blueprints.length !== headless.blueprints.length) {
    return {
      level: 'warning',
      field: 'blueprints.length',
      visualValue: visual.blueprints.length,
      headlessValue: headless.blueprints.length,
      tick: visual.tick,
    };
  }

  // 比较 buildings 数量
  if (visual.buildings.length !== headless.buildings.length) {
    return {
      level: 'error',
      field: 'buildings.length',
      visualValue: visual.buildings.length,
      headlessValue: headless.buildings.length,
      tick: visual.tick,
    };
  }

  return null;
}

/**
 * 对比 pawn 列表
 */
function diffPawns(
  visualPawns: PawnSnapshot[],
  headlessPawns: PawnSnapshot[],
  tick: number,
): DivergenceRecord | null {
  if (visualPawns.length !== headlessPawns.length) {
    return {
      level: 'error',
      field: 'pawns.length',
      visualValue: visualPawns.length,
      headlessValue: headlessPawns.length,
      tick,
    };
  }

  for (let i = 0; i < visualPawns.length; i++) {
    const vp = visualPawns[i];
    const hp = headlessPawns.find(p => p.id === vp.id);
    if (!hp) {
      // 按 name 降级匹配 — 若两个 harness 的 ID 计数器未对齐，仍可按 name 找到对应 pawn
      const hpByName = headlessPawns.find(p => p.name === vp.name);
      if (!hpByName) {
        return {
          level: 'error',
          field: `pawns[${vp.id}]`,
          visualValue: vp.id,
          headlessValue: null,
          tick,
        };
      }
      // ID 不同但 name 匹配 — 仅作为 warning（ID 偏移不影响业务正确性）
      return {
        level: 'warning',
        field: `pawns[${vp.name}].id`,
        visualValue: vp.id,
        headlessValue: hpByName.id,
        tick,
      };
    }

    // 比较 job
    if (vp.jobDefId !== hp.jobDefId) {
      return {
        level: 'error',
        field: `pawns[${vp.id}].jobDefId`,
        visualValue: vp.jobDefId,
        headlessValue: hp.jobDefId,
        tick,
      };
    }

    // 比较位置
    if (vp.cell.x !== hp.cell.x || vp.cell.y !== hp.cell.y) {
      return {
        level: 'warning',
        field: `pawns[${vp.id}].cell`,
        visualValue: `(${vp.cell.x},${vp.cell.y})`,
        headlessValue: `(${hp.cell.x},${hp.cell.y})`,
        tick,
      };
    }
  }

  return null;
}
