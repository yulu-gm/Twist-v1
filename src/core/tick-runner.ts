/**
 * @file tick-runner.ts
 * @description Tick 调度器 - 管理游戏主循环中系统的注册与按阶段执行。
 *              每个 Tick 按固定的阶段顺序（命令处理 -> 工作生成 -> AI决策 -> 预约 -> 执行 -> 世界更新 -> 清理 -> 事件派发）依次运行已注册的系统。
 * @dependencies types.ts (TickPhase 枚举)
 * @part-of 核心引擎层 (core)
 */

import { TickPhase } from './types';

/** 系统注册信息 - 描述一个可被 TickRunner 调度的系统 */
export interface SystemRegistration {
  /** 系统唯一标识符，用于调试和日志追踪 */
  id: string;
  /** 该系统所属的 Tick 阶段，决定其在每个 Tick 中的执行顺序 */
  phase: TickPhase;
  /** 执行频率：每隔 N 个 Tick 执行一次（1 表示每 Tick 都执行） */
  frequency: number; // every N ticks
  /** 系统的执行函数，接收世界状态和可选的地图 ID */
  execute: (world: any, mapId?: string) => void;
}

/**
 * 判断系统是否应在当前 Tick 执行
 * @param system - 系统注册信息
 * @param tick - 当前 Tick 编号
 * @returns 如果当前 Tick 是该系统频率的整数倍则返回 true
 */
function shouldRunThisTick(system: SystemRegistration, tick: number): boolean {
  return tick % system.frequency === 0;
}

/** Tick 调度器 - 负责注册系统并在每个 Tick 中按阶段顺序执行它们 */
export class TickRunner {
  // ── 系统存储 ──
  /** 所有已注册系统的列表 */
  private systems: SystemRegistration[] = [];
  /** 按阶段分组的系统映射表，用于按顺序执行 */
  private phaseGroups: Map<TickPhase, SystemRegistration[]> = new Map();

  constructor() {
    // Initialize all phases
    for (const phase of Object.values(TickPhase).filter(v => typeof v === 'number') as TickPhase[]) {
      this.phaseGroups.set(phase, []);
    }
  }

  /**
   * 注册单个系统到调度器
   * @param system - 要注册的系统，将被加入总列表和对应阶段分组
   */
  register(system: SystemRegistration): void {
    this.systems.push(system);
    this.phaseGroups.get(system.phase)!.push(system);
  }

  /**
   * 批量注册多个系统
   * @param systems - 要注册的系统数组
   */
  registerAll(systems: SystemRegistration[]): void {
    for (const s of systems) {
      this.register(s);
    }
  }

  /** Execute one full tick across all phases */
  executeTick(world: any): void {
    const tick: number = world.tick;

    // Iterate phases in order (enum values are 0,1,2,...)
    const phaseOrder = [
      TickPhase.COMMAND_PROCESSING,
      TickPhase.WORK_GENERATION,
      TickPhase.AI_DECISION,
      TickPhase.RESERVATION,
      TickPhase.EXECUTION,
      TickPhase.WORLD_UPDATE,
      TickPhase.CLEANUP,
      TickPhase.EVENT_DISPATCH,
    ];

    for (const phase of phaseOrder) {
      const group = this.phaseGroups.get(phase);
      if (!group) continue;
      for (const system of group) {
        if (shouldRunThisTick(system, tick)) {
          system.execute(world);
        }
      }
    }
  }

  /**
   * 获取所有已注册系统的副本
   * @returns 系统注册信息的浅拷贝数组
   */
  getSystems(): SystemRegistration[] {
    return [...this.systems];
  }
}
