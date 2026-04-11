/**
 * @file work-evaluator.types.ts
 * @description 工作评估器接口 — 定义统一的评估器契约和共享上下文类型
 * @dependencies world — GameMap, World；pawn — Pawn 类型；work-types — WorkEvaluation
 * @part-of AI 子系统（features/ai）
 */

import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';
import type { Pawn } from '../pawn/pawn.types';
import type { WorkEvaluation } from './work-types';

/**
 * 工作评估器接口 — 每个评估器负责一个工作类别
 *
 * 每个评估器回答相同的问题：
 * 1. 这个类别当前是否有有效选项？
 * 2. 如果没有，原因是什么？
 * 3. 如果有，它的分数是多少？
 * 4. 如果它被选中，应该如何创建真实的 Job？
 */
export interface WorkEvaluator {
  /** 工作类别标识（如 'eat'、'sleep'、'haul_to_stockpile'） */
  kind: string;
  /** 面向用户的类别显示名 */
  label: string;
  /** 类别优先级（越高越先被考虑） */
  priority: number;
  /** 评估指定 pawn 在指定地图上该类别的工作可用性 */
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation;
}
