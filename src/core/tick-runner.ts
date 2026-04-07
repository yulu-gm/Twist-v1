import { TickPhase } from './types';

export interface SystemRegistration {
  id: string;
  phase: TickPhase;
  frequency: number; // every N ticks
  execute: (world: any, mapId?: string) => void;
}

function shouldRunThisTick(system: SystemRegistration, tick: number): boolean {
  return tick % system.frequency === 0;
}

export class TickRunner {
  private systems: SystemRegistration[] = [];
  private phaseGroups: Map<TickPhase, SystemRegistration[]> = new Map();

  constructor() {
    // Initialize all phases
    for (const phase of Object.values(TickPhase).filter(v => typeof v === 'number') as TickPhase[]) {
      this.phaseGroups.set(phase, []);
    }
  }

  register(system: SystemRegistration): void {
    this.systems.push(system);
    this.phaseGroups.get(system.phase)!.push(system);
  }

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

  getSystems(): SystemRegistration[] {
    return [...this.systems];
  }
}
