/**
 * @file command-bus.ts
 * @description 命令总线系统，处理玩家操作指令的验证与执行，遵循命令模式（Command Pattern）
 * @dependencies event-bus.ts (GameEvent)
 * @part-of core 核心模块 — 所有玩家操作（建造、指派、拆除等）通过此总线分发
 */

import { GameEvent } from './event-bus';

// ── 命令相关接口 ──

/** 命令对象 — 描述玩家的一次操作意图 */
export interface Command {
  type: string;                        // 命令类型标识（如 "place_building"）
  payload: Record<string, unknown>;    // 命令携带的数据
}

/** 命令验证结果 — 合法或不合法（附原因） */
export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/** 命令执行结果 — 包含执行后产生的事件列表 */
export type ExecutionResult = {
  events: GameEvent[];
};

/** 命令处理器接口 — 每种命令类型对应一个处理器 */
export interface CommandHandler {
  type: string;                                                  // 处理的命令类型
  validate(world: any, cmd: Command): ValidationResult;          // 验证命令是否合法
  execute(world: any, cmd: Command): ExecutionResult;            // 执行命令并返回产生的事件
}

/** 已执行的命令记录（用于日志和撤销） */
export interface ExecutedCommand {
  tick: number;       // 执行时的 tick 数
  command: Command;   // 执行的命令对象
}

/**
 * 命令总线 — 注册命令处理器，验证并执行命令队列
 */
export class CommandBus {
  // ── 内部数据 ──
  private handlers: Map<string, CommandHandler> = new Map();  // 命令类型 -> 处理器的映射

  /**
   * 注册单个命令处理器
   * @param handler - 命令处理器实例
   */
  register(handler: CommandHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * 批量注册命令处理器
   * @param handlers - 命令处理器数组
   */
  registerAll(handlers: CommandHandler[]): void {
    for (const h of handlers) {
      this.register(h);
    }
  }

  /**
   * 按类型获取对应的命令处理器
   * @param type - 命令类型标识
   * @returns 对应的处理器，若未注册则返回 undefined
   */
  getHandler(type: string): CommandHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * 处理命令队列：依次验证并执行队列中的所有命令
   * - 无处理器或验证失败的命令会产生 command_rejected 事件
   * - 执行成功的命令会记入命令日志，产生的事件推入事件缓冲区
   * - 处理完毕后清空命令队列
   * @param world - 游戏世界状态（需含 commandQueue, eventBuffer, commandLog, tick）
   */
  processQueue(world: any): void {
    const queue = world.commandQueue as Command[];
    const eventBuffer = world.eventBuffer as GameEvent[];
    const commandLog = world.commandLog as ExecutedCommand[];

    for (const cmd of queue) {
      const handler = this.handlers.get(cmd.type);
      if (!handler) {
        eventBuffer.push({
          type: 'command_rejected',
          tick: world.tick,
          data: { commandType: cmd.type, reason: `No handler for command type: ${cmd.type}` },
        });
        continue;
      }

      const validation = handler.validate(world, cmd);
      if (!validation.valid) {
        eventBuffer.push({
          type: 'command_rejected',
          tick: world.tick,
          data: { commandType: cmd.type, reason: validation.reason },
        });
        continue;
      }

      const result = handler.execute(world, cmd);
      commandLog.push({ tick: world.tick, command: cmd });
      eventBuffer.push(...result.events);
    }

    // Clear queue
    queue.length = 0;
  }
}
