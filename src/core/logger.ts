/**
 * @file logger.ts
 * @description 游戏日志系统 - 提供分频道、分级别的日志记录功能。
 *              支持 debug/info/warn/error 四个级别，支持按频道（ai/job/command 等）过滤，
 *              日志条目带有 Tick 时间戳，超过上限时自动裁剪旧记录。
 * @dependencies types.ts (LogChannel, ObjectId)
 * @part-of 核心引擎层 (core)
 */

import { LogChannel, ObjectId } from './types';

/** 单条日志记录 */
interface LogEntry {
  /** 日志产生时的 Tick 编号 */
  tick: number;
  /** 日志所属频道（ai、job、command 等） */
  channel: LogChannel;
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 关联的游戏对象 ID（可选） */
  objectId?: ObjectId;
  /** 产生日志的系统 ID（可选） */
  systemId?: string;
  /** 日志消息文本 */
  message: string;
  /** 附加数据（可选） */
  data?: Record<string, unknown>;
}

/** 游戏日志管理器 - 单例模式，负责收集、过滤和查询日志 */
class GameLogger {
  // ── 日志存储 ──
  /** 日志条目数组 */
  private entries: LogEntry[] = [];
  /** 最大存储条目数，超出后自动裁剪 */
  private maxEntries = 5000;

  // ── 过滤配置 ──
  /** 已启用的日志频道集合 */
  private enabledChannels: Set<LogChannel> = new Set([
    'ai', 'job', 'command', 'construction', 'path', 'general', 'event', 'save',
  ]);
  /** 最低日志级别，低于此级别的日志将被忽略 */
  private minLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  // ── 运行时状态 ──
  /** 当前 Tick 编号，用于给新日志打时间戳 */
  private currentTick: number = 0;

  /** 日志级别优先级映射，数值越大优先级越高 */
  private levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };

  /**
   * 设置当前 Tick 编号
   * @param tick - 当前游戏 Tick
   */
  setTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * 设置最低日志级别
   * @param level - 低于此级别的日志将被忽略
   */
  setMinLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.minLevel = level;
  }

  /**
   * 判断指定频道和级别的日志是否应该被记录
   * @param channel - 日志频道
   * @param level - 日志级别
   * @returns 频道已启用且级别不低于最低级别时返回 true
   */
  private shouldLog(channel: LogChannel, level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    return this.enabledChannels.has(channel) && this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  /**
   * 添加一条日志记录（内部方法）
   * @param entry - 日志条目，经过频道和级别过滤后存入，超出上限时自动裁剪至 80%
   */
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

  /** 记录 debug 级别日志 */
  debug(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'debug', message, data, objectId });
  }

  /** 记录 info 级别日志 */
  info(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'info', message, data, objectId });
  }

  /** 记录 warn 级别日志 */
  warn(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'warn', message, data, objectId });
  }

  /** 记录 error 级别日志 */
  error(channel: LogChannel, message: string, data?: Record<string, unknown>, objectId?: ObjectId): void {
    this.add({ tick: this.currentTick, channel, level: 'error', message, data, objectId });
  }

  /**
   * 查询日志条目
   * @param filter - 可选过滤条件：频道、对象ID、级别、返回数量
   * @returns 符合条件的日志条目数组
   */
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

  /** 清空所有日志条目 */
  clear(): void {
    this.entries = [];
  }
}

// 全局单例
export const log = new GameLogger();
