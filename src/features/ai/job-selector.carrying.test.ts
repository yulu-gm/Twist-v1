import { describe, expect, it } from 'vitest';
import '../construction/occupancy.test.mock';
import { ObjectKind } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from '../building/building.factory';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { createBlueprint } from '../construction/construction.test-utils';
import { jobSelectionSystem } from './job-selector';

function createCarryingSelectionWorld() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'main', width: 16, height: 16 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'Alice',
    cell: { x: 2, y: 2 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  map.objects.add(pawn);

  return { defs, world, map, pawn };
}

/**
 * 在地图上添加一座空仓库 — 替代旧的 stockpile zone，用于测试携带物入库路径
 */
function addWarehouseAt(
  map: ReturnType<typeof createGameMap>,
  defs: ReturnType<typeof buildDefDatabase>,
  coord: { x: number; y: number },
) {
  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell: coord,
    mapId: map.id,
    defs,
  });
  map.objects.add(warehouse);
  return warehouse;
}

describe('job selection while carrying surplus materials', () => {
  it('still assigns an unblocked construct job instead of immediately resolving carried surplus', () => {
    const { defs, world, map, pawn } = createCarryingSelectionWorld();
    pawn.inventory.carrying = { defId: 'wood', count: 2 };
    pawn.needs.food = 5;

    const meal = createItem({
      defId: 'meal_simple',
      cell: { x: 3, y: 2 },
      mapId: map.id,
      stackCount: 1,
      defs,
    });
    map.objects.add(meal);

    const blueprint = createBlueprint(map, {
      id: 'bp_construct_ready',
      cell: { x: 6, y: 6 },
      materialsRequired: [{ defId: 'wood', count: 5 }],
      materialsDelivered: [{ defId: 'wood', count: 5 }],
    });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_construct');
    expect(pawn.ai.currentJob?.targetId).toBe(blueprint.id);
  });

  it('chooses a no-pickup carry-resolution job when only pickup-based work is otherwise available', () => {
    const { defs, world, map, pawn } = createCarryingSelectionWorld();
    pawn.inventory.carrying = { defId: 'wood', count: 2 };
    pawn.needs.food = 5;

    const meal = createItem({
      defId: 'meal_simple',
      cell: { x: 3, y: 2 },
      mapId: map.id,
      stackCount: 1,
      defs,
    });
    map.objects.add(meal);
    const warehouse = addWarehouseAt(map, defs, { x: 5, y: 2 });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob).not.toBeNull();
    expect(pawn.ai.currentJob?.toils.some(toil => toil.type === 'pickup')).toBe(false);
    expect(pawn.ai.currentJob?.defId).toBe('job_store_carried_materials');
    // 入库目标 cell 应该是仓库的 interactionCell
    expect(pawn.ai.currentJob?.targetCell).toEqual(warehouse.interaction!.interactionCell);
    expect(map.objects.allOfKind(ObjectKind.Item)).toHaveLength(1);
  });
});
