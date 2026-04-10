import { describe, expect, it } from 'vitest';
import { ZoneType, cellKey } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from '../building/building.factory';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { jobSelectionSystem } from './job-selector';

function addStockpileAt(map: ReturnType<typeof createGameMap>, coord: { x: number; y: number }) {
  map.zones.add({
    id: 'zone_stockpile',
    zoneType: ZoneType.Stockpile,
    cells: new Set([cellKey(coord)]),
    config: {
      stockpile: {
        allowAllHaulable: true,
        allowedDefIds: new Set(),
      },
    },
  });
}

function addStockpileCells(map: ReturnType<typeof createGameMap>, coords: Array<{ x: number; y: number }>) {
  map.zones.add({
    id: 'zone_stockpile_multi',
    zoneType: ZoneType.Stockpile,
    cells: new Set(coords.map(cell => cellKey(cell))),
    config: {
      stockpile: {
        allowAllHaulable: true,
        allowedDefIds: new Set(),
      },
    },
  });
}

describe('job selector reachability', () => {
  it('does not assign haul jobs for unreachable items', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    const item = createItem({
      defId: 'wood',
      cell: { x: 4, y: 4 },
      mapId: map.id,
      stackCount: 10,
      defs,
    });
    map.objects.add(item);

    for (const cell of [
      { x: 4, y: 3 },
      { x: 4, y: 5 },
      { x: 3, y: 4 },
      { x: 5, y: 4 },
    ]) {
      map.objects.add(createBuilding({
        defId: 'wall_wood',
        cell,
        mapId: map.id,
        defs,
      }));
    }

    map.pathGrid.rebuildFrom(map, defs);
    addStockpileAt(map, { x: 8, y: 1 });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob).toBeNull();
  });

  it('assigns haul jobs to a reachable stockpile cell when the nearest one is blocked', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    const item = createItem({
      defId: 'wood',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 10,
      defs,
    });
    map.objects.add(item);

    addStockpileCells(map, [
      { x: 4, y: 1 },
      { x: 8, y: 1 },
    ]);

    for (const cell of [
      { x: 3, y: 1 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 5, y: 1 },
    ]) {
      map.objects.add(createBuilding({
        defId: 'wall_wood',
        cell,
        mapId: map.id,
        defs,
      }));
    }

    map.pathGrid.rebuildFrom(map, defs);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_haul');
    expect(pawn.ai.currentJob?.toils[2]?.targetCell).toEqual({ x: 8, y: 1 });
  });
});
