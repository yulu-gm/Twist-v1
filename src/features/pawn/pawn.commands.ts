/**
 * @file pawn.commands.ts
 * @description Pawn feature currently exposes no direct player control commands.
 * @dependencies core/command-bus
 * @part-of features/pawn 棋子功能模块
 */

import type { CommandHandler } from '../../core/command-bus';

export const pawnCommandHandlers: CommandHandler[] = [];
