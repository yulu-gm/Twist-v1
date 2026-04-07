import { LogChannel, ObjectId } from './types';

export interface LogEntry {
  tick: number;
  channel: LogChannel;
  level: 'debug' | 'info' | 'warn' | 'error';
  objectId?: ObjectId;
  systemId?: string;
  message: string;
  data?: Record<string, unknown>;
}

class GameLogger {
  private entries: LogEntry[] = [];
  private maxEntries = 5000;
  private enabledChannels: Set<LogChannel> = new Set([
    'ai', 'job', 'command', 'construction', 'path', 'general', 'event', 'save',
  ]);
  private minLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private currentTick: number = 0;

  private levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };

  setTick(tick: number): void {
    this.currentTick = tick;
  }

  setMinLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.minLevel = level;
  }

  private shouldLog(channel: LogChannel, level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    return this.enabledChannels.has(channel) && this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private add(entry: LogEntry): void {
    if (!this.shouldLog(entry.channel, entry.level)) return;
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-Math.floor(this.maxEntries * 0.8));
    }

    // Also console log for development
    const prefix = `[T${entry.tick}][${entry.channel}]`;
    if (entry.level === 'error') {
      console.error(prefix, entry.message, entry.data ?? '');
    } else if (entry.level === 'warn') {
      console.warn(prefix, entry.message, entry.data ?? '');
    }
  }

  debug(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'debug', message, data, objectId });
  }

  info(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'info', message, data, objectId });
  }

  warn(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'warn', message, data, objectId });
  }

  error(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'error', message, data, objectId });
  }

  getEntries(filter?: { channel?: LogChannel; objectId?: ObjectId; level?: string; count?: number }): LogEntry[] {
    let result = this.entries;
    if (filter?.channel) {
      result = result.filter(e => e.channel === filter.channel);
    }
    if (filter?.objectId) {
      result = result.filter(e => e.objectId === filter.objectId);
    }
    if (filter?.level) {
      result = result.filter(e => e.level === filter.level);
    }
    if (filter?.count) {
      result = result.slice(-filter.count);
    }
    return result;
  }

  clear(): void {
    this.entries = [];
  }
}

// Singleton
export const log = new GameLogger();
