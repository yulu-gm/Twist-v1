import { beforeEach, describe, expect, it } from 'vitest';
import { ObjectKind } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createPawn } from '../pawn/pawn.factory';
import { createBuilding } from '../building/building.factory';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { loadGameHandler, saveGameHandler } from './save.commands';

function createWorldWithPawn() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 42 });
  const map = createGameMap({ id: 'main', width: 12, height: 12 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'Saver',
    cell: { x: 4, y: 4 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  map.objects.add(pawn);

  return { defs, world, map, pawn };
}

describe('save/load chronotype compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('backfills missing chronotype and schedule when loading an older save payload', () => {
    const { defs, world } = createWorldWithPawn();
    saveGameHandler.execute(world, { type: 'save_game', payload: {} } as any);

    const raw = localStorage.getItem('opus_world_save');
    expect(raw).not.toBeNull();

    const saveData = JSON.parse(raw!);
    delete saveData.maps[0].objects[0].chronotype;
    delete saveData.maps[0].objects[0].schedule;
    localStorage.setItem('opus_world_save', JSON.stringify(saveData));

    const loadedWorld = createWorld({ defs, seed: 7 });
    loadGameHandler.execute(loadedWorld, { type: 'load_game', payload: {} } as any);

    const loadedMap = loadedWorld.maps.get('main');
    expect(loadedMap).toBeDefined();

    const [loadedPawn] = loadedMap!.objects.allOfKind(ObjectKind.Pawn);
    expect(loadedPawn).toBeDefined();
    expect(loadedPawn.chronotype.sleepStartHour).toBe(22);
    expect(loadedPawn.chronotype.sleepEndHour).toBe(30);
    expect(loadedPawn.schedule.entries).toHaveLength(24);
    expect(loadedPawn.schedule.entries.filter(entry => entry.activity === 'sleep')).toHaveLength(8);
  });

  it('persists warehouse inventory across save and load', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 42 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const warehouse = createBuilding({
      defId: 'warehouse_shed',
      cell: { x: 3, y: 3 },
      mapId: map.id,
      defs,
    });

    warehouse.storage!.inventory = { wood: 12, stone_block: 4 };
    warehouse.storage!.storedCount = 16;
    map.objects.add(warehouse);

    saveGameHandler.execute(world, { type: 'save_game', payload: {} } as any);

    const loadedWorld = createWorld({ defs, seed: 7 });
    loadGameHandler.execute(loadedWorld, { type: 'load_game', payload: {} } as any);

    const loadedMap = loadedWorld.maps.get('main')!;
    const loadedWarehouse = loadedMap.objects.getAs(warehouse.id, ObjectKind.Building)!;

    expect(loadedWarehouse.storage).toEqual({
      mode: 'all-haulable',
      capacityMax: 160,
      storedCount: 16,
      inventory: { wood: 12, stone_block: 4 },
    });
  });
});
