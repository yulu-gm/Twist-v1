/**
 * @file toil-handler.types.ts
 * @description Toil handler 的公共类型定义：执行上下文（ToilContext）和 handler 函数签名
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import type { Pawn } from '../../pawn/pawn.types';
import type { Toil, Job } from '../ai.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';

/** Toil 执行上下文 — 每个 handler 接收的统一参数结构 */
export interface ToilContext {
  pawn: Pawn;
  toil: Toil;
  job: Job;
  map: GameMap;
  world: World;
}

/** Toil handler 函数签名 */
export type ToilHandler = (ctx: ToilContext) => void;
