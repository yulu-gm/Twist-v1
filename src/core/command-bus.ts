import { GameEvent } from './event-bus';

// ── Command ──
export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export type ExecutionResult = {
  events: GameEvent[];
};

export interface CommandHandler {
  type: string;
  validate(world: any, cmd: Command): ValidationResult;
  execute(world: any, cmd: Command): ExecutionResult;
}

export interface ExecutedCommand {
  tick: number;
  command: Command;
}

export class CommandBus {
  private handlers: Map<string, CommandHandler> = new Map();

  register(handler: CommandHandler): void {
    this.handlers.set(handler.type, handler);
  }

  registerAll(handlers: CommandHandler[]): void {
    for (const h of handlers) {
      this.register(h);
    }
  }

  getHandler(type: string): CommandHandler | undefined {
    return this.handlers.get(type);
  }

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
