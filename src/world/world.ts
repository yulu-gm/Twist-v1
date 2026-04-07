import {
  SimSpeed, MapId, FactionId,
} from '../core/types';
import { SeededRandom } from '../core/seeded-random';
import { SimulationClock, createClock } from '../core/clock';
import { CommandBus, Command, ExecutedCommand } from '../core/command-bus';
import { EventBus, GameEvent } from '../core/event-bus';
import { TickRunner } from '../core/tick-runner';
import { DefDatabase } from './def-database';
import { GameMap } from './game-map';

// ── Faction ──
export interface Faction {
  id: FactionId;
  name: string;
  isPlayer: boolean;
  hostile: boolean;
}

// ── Story State ──
export interface StoryState {
  threatLevel: number;
  daysSinceLastRaid: number;
  totalWealth: number;
}

// ── World ──
export interface World {
  tick: number;
  clock: SimulationClock;
  rng: SeededRandom;
  speed: SimSpeed;
  defs: DefDatabase;
  maps: Map<MapId, GameMap>;
  factions: Map<FactionId, Faction>;
  storyState: StoryState;
  commandQueue: Command[];
  eventBuffer: GameEvent[];
  commandLog: ExecutedCommand[];
  commandBus: CommandBus;
  eventBus: EventBus;
  tickRunner: TickRunner;
}

export function createWorld(config: {
  defs: DefDatabase;
  seed: number;
}): World {
  return {
    tick: 0,
    clock: createClock(),
    rng: new SeededRandom(config.seed),
    speed: SimSpeed.Normal,
    defs: config.defs,
    maps: new Map(),
    factions: new Map(),
    storyState: {
      threatLevel: 0,
      daysSinceLastRaid: 0,
      totalWealth: 0,
    },
    commandQueue: [],
    eventBuffer: [],
    commandLog: [],
    commandBus: new CommandBus(),
    eventBus: new EventBus(),
    tickRunner: new TickRunner(),
  };
}
