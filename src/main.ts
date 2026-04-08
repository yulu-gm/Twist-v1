import { createWorld } from './world/world';
import { createGameMap, GameMap } from './world/game-map';
import { buildDefDatabase } from './defs/index';
import { SimSpeed, TickPhase, ObjectKind } from './core/types';
import { log } from './core/logger';
import { inspector } from './core/inspector';
import { bootstrapPhaser } from './adapter/bootstrap';
import { SystemRegistration } from './core/tick-runner';

// Import feature modules
import { createPawn } from './features/pawn/pawn.factory';
import { createItem } from './features/item/item.factory';
import { createPlant } from './features/plant/plant.factory';
import { needDecayRegistration } from './features/pawn/pawn.systems';
import { movementSystem } from './features/movement/movement.system';
import { toilExecutorSystem } from './features/ai/toil-executor';
import { jobSelectionSystem } from './features/ai/job-selector';
import { growPlantsSystem } from './features/plant/plant.system';
import { fireSystem } from './features/fire/fire.system';
import { constructionProgressSystem } from './features/construction/construction.system';
import { constructionCommandHandlers } from './features/construction/construction.commands';
import { designationCommandHandlers } from './features/designation/designation.commands';
import { workGenerationSystem } from './features/designation/designation.system';
import { pawnCommandHandlers } from './features/pawn/pawn.commands';
import { zoneCommandHandlers } from './features/zone/zone.commands';
import { saveCommandHandlers } from './features/save/save.commands';
import { corpseDecaySystem } from './features/corpse/corpse.system';
import { roomRebuildSystem } from './features/room/room.system';
import { buildingTickSystem } from './features/building/building.systems';
import type { World } from './world/world';

function generateTerrain(map: GameMap, world: World): void {
  const rng = world.rng;

  map.terrain.forEach((x, y) => {
    const noise = rng.next();

    if (noise < 0.05) {
      map.terrain.set(x, y, 'water');
    } else if (noise < 0.12) {
      map.terrain.set(x, y, 'rock');
    } else if (noise < 0.25) {
      map.terrain.set(x, y, 'dirt');
    } else if (noise < 0.30) {
      map.terrain.set(x, y, 'sand');
    } else {
      map.terrain.set(x, y, 'grass');
    }
  });
}

function spawnInitialVegetation(map: GameMap, world: World): void {
  const rng = world.rng;

  map.terrain.forEach((x, y, defId) => {
    if (defId !== 'grass') return;

    if (rng.chance(0.08)) {
      const treeDef = rng.chance(0.5) ? 'tree_oak' : 'tree_pine';
      const plant = createPlant({
        defId: treeDef,
        cell: { x, y },
        mapId: map.id,
        growthProgress: rng.nextFloat(0.3, 1.0),
        defs: world.defs,
      });
      map.objects.add(plant);
    } else if (rng.chance(0.03)) {
      const plant = createPlant({
        defId: 'bush_berry',
        cell: { x, y },
        mapId: map.id,
        growthProgress: rng.nextFloat(0.5, 1.0),
        defs: world.defs,
      });
      map.objects.add(plant);
    }
  });
}

function spawnInitialPawns(map: GameMap, world: World): void {
  const rng = world.rng;
  const centerX = Math.floor(map.width / 2);
  const centerY = Math.floor(map.height / 2);

  const names = ['Alice', 'Bob', 'Charlie'];

  for (const name of names) {
    let px = centerX + rng.nextInt(-3, 3);
    let py = centerY + rng.nextInt(-3, 3);

    const terrain = map.terrain.get(px, py);
    const tDef = world.defs.terrains.get(terrain);
    if (!tDef?.passable) {
      px = centerX;
      py = centerY;
    }

    const pawn = createPawn({
      name,
      cell: { x: px, y: py },
      mapId: map.id,
      factionId: 'player',
      rng,
    });
    map.objects.add(pawn);
  }

  // Spawn starting resources
  for (let i = 0; i < 5; i++) {
    const item = createItem({
      defId: 'wood',
      cell: { x: centerX + rng.nextInt(-2, 2), y: centerY + rng.nextInt(-2, 2) },
      mapId: map.id,
      stackCount: rng.nextInt(10, 25),
      defs: world.defs,
    });
    map.objects.add(item);
  }

  // Spawn food
  for (let i = 0; i < 3; i++) {
    const item = createItem({
      defId: 'meal_simple',
      cell: { x: centerX + rng.nextInt(-2, 2), y: centerY + rng.nextInt(-2, 2) },
      mapId: map.id,
      stackCount: rng.nextInt(3, 8),
      defs: world.defs,
    });
    map.objects.add(item);
  }
}

function buildSystems(): SystemRegistration[] {
  const systems: SystemRegistration[] = [];

  // Phase 0: Command processing
  systems.push({
    id: 'command_processor',
    phase: TickPhase.COMMAND_PROCESSING,
    frequency: 1,
    execute: (w: any) => {
      w.commandBus.processQueue(w);
    },
  });

  // Phase 1: Work generation
  systems.push(workGenerationSystem);

  // Phase 2: AI decision
  systems.push(jobSelectionSystem);

  // Phase 3: Reservation management
  systems.push({
    id: 'reservation_mgr',
    phase: TickPhase.RESERVATION,
    frequency: 1,
    execute: (w: any) => {
      for (const [, gmap] of w.maps) {
        // Release reservations for destroyed objects
        for (const res of gmap.reservations.getAll()) {
          const obj = gmap.objects.get(res.targetId);
          if (obj && obj.destroyed) {
            gmap.reservations.release(res.id);
          }
        }
      }
    },
  });

  // Phase 4: Execution
  systems.push(movementSystem);
  systems.push(toilExecutorSystem);
  systems.push(constructionProgressSystem);

  // Phase 5: World update
  systems.push(needDecayRegistration);
  systems.push(growPlantsSystem);
  systems.push(fireSystem);
  systems.push(corpseDecaySystem);
  systems.push(roomRebuildSystem);
  systems.push(buildingTickSystem);

  // Phase 6: Cleanup
  systems.push({
    id: 'cleanup',
    phase: TickPhase.CLEANUP,
    frequency: 1,
    execute: (w: any) => {
      for (const [, gmap] of w.maps) {
        const toRemove: string[] = [];
        for (const obj of gmap.objects.all()) {
          if (obj.destroyed) toRemove.push(obj.id);
        }
        for (const id of toRemove) {
          gmap.objects.remove(id);
        }
        gmap.reservations.cleanupExpired(w.tick);
      }
    },
  });

  // Phase 7: Event dispatch (events dispatched in main-scene)
  systems.push({
    id: 'event_dispatch',
    phase: TickPhase.EVENT_DISPATCH,
    frequency: 1,
    execute: () => {},
  });

  return systems;
}

function registerCommands(world: World): void {
  // Speed command
  world.commandBus.register({
    type: 'set_speed',
    validate: (_w, cmd) => {
      const speed = cmd.payload.speed as number;
      if (speed < 0 || speed > 3) return { valid: false, reason: 'Invalid speed' };
      return { valid: true };
    },
    execute: (w, cmd) => {
      w.speed = cmd.payload.speed as SimSpeed;
      return { events: [{ type: 'speed_changed', tick: w.tick, data: { speed: cmd.payload.speed } }] };
    },
  });

  // Debug spawn
  world.commandBus.register({
    type: 'debug_spawn',
    validate: () => ({ valid: true }),
    execute: (w, cmd) => {
      const { defId, cell, count } = cmd.payload as { defId: string; cell: any; count: number };
      const map = w.maps.values().next().value;
      if (!map) return { events: [] };
      const item = createItem({ defId, cell, mapId: (map as GameMap).id, stackCount: count ?? 1, defs: w.defs });
      (map as GameMap).objects.add(item);
      return { events: [{ type: 'debug_spawned', tick: w.tick, data: { defId, cell } }] };
    },
  });

  // Debug destroy
  world.commandBus.register({
    type: 'debug_destroy',
    validate: () => ({ valid: true }),
    execute: (w, cmd) => {
      const { objectId } = cmd.payload as { objectId: string };
      for (const [, map] of w.maps) {
        const obj = (map as GameMap).objects.get(objectId);
        if (obj) { obj.destroyed = true; break; }
      }
      return { events: [{ type: 'debug_destroyed', tick: w.tick, data: { objectId } }] };
    },
  });

  // Debug advance ticks
  world.commandBus.register({
    type: 'debug_advance_ticks',
    validate: (_w, cmd) => {
      const count = cmd.payload.count as number;
      if (!count || count <= 0 || count > 10000) return { valid: false, reason: 'count must be 1-10000' };
      return { valid: true };
    },
    execute: (w, cmd) => {
      const count = cmd.payload.count as number;
      for (let i = 0; i < count; i++) {
        w.tick++;
        w.tickRunner.executeTick(w);
      }
      return { events: [{ type: 'debug_ticks_advanced', tick: w.tick, data: { count } }] };
    },
  });

  // Feature commands
  world.commandBus.registerAll(constructionCommandHandlers);
  world.commandBus.registerAll(designationCommandHandlers);
  world.commandBus.registerAll(pawnCommandHandlers);
  world.commandBus.registerAll(zoneCommandHandlers);
  world.commandBus.registerAll(saveCommandHandlers);
}

async function boot(): Promise<void> {
  log.info('general', 'Booting Opus World...');

  // 1. Build def database
  const defs = buildDefDatabase();
  log.info('general', `Loaded defs: ${defs.buildings.size} buildings, ${defs.items.size} items, ${defs.plants.size} plants, ${defs.terrains.size} terrains`);

  // 2. Create world
  const world = createWorld({ defs, seed: 12345 });

  // 3. Add factions
  world.factions.set('player', { id: 'player', name: 'Colony', isPlayer: true, hostile: false });
  world.factions.set('wild', { id: 'wild', name: 'Wildlife', isPlayer: false, hostile: false });

  // 4. Create map
  const map = createGameMap({ id: 'main', width: 80, height: 80 });
  world.maps.set(map.id, map);

  // 5. Generate terrain and populate
  generateTerrain(map, world);

  // 5b. Initialize pathGrid from terrain (mark rock/water impassable)
  map.pathGrid.rebuildFrom(map, defs);

  spawnInitialVegetation(map, world);
  spawnInitialPawns(map, world);

  // 6. Register commands
  registerCommands(world);

  // 7. Register systems
  const systems = buildSystems();
  world.tickRunner.registerAll(systems);

  // 8. Setup inspector
  inspector.setWorld(world);

  log.info('general', `World created: ${map.objects.size} objects on ${map.width}x${map.height} map`);

  // 9. Launch Phaser
  bootstrapPhaser(world);
}

boot().catch(console.error);
