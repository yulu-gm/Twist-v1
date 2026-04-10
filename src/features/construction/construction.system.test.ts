import { describe, expect, it } from 'vitest';
import './occupancy.test.mock';
import { ObjectKind } from '../../core/types';
import { createConstructionTestWorld, createBlueprint, createConstructionSite } from './construction.test-utils';
import { constructionProgressSystem } from './construction.system';

describe('constructionProgressSystem', () => {
  it('does not auto-promote a fully delivered blueprint during tick processing', () => {
    const { world, map } = createConstructionTestWorld();
    const blueprint = createBlueprint(map, {
      materialsDelivered: [{ defId: 'wood', count: 5 }],
    });

    constructionProgressSystem.execute(world);

    expect(map.objects.getAs(blueprint.id, ObjectKind.Blueprint)).toBeDefined();
    expect(map.objects.allOfKind(ObjectKind.ConstructionSite)).toHaveLength(0);
  });

  it('keeps a completed construction site in place when the footprint is physically occupied', () => {
    const { world, map, pawn } = createConstructionTestWorld();
    const site = createConstructionSite(map, {
      targetDefId: 'table',
      footprint: { width: 2, height: 1 },
      totalWorkAmount: 80,
      workDone: 80,
      buildProgress: 1,
      cell: { x: 6, y: 6 },
    });

    pawn.cell = { x: 7, y: 6 };
    pawn.tags.add('physical_occupant');
    map.spatial.onObjectMoved(pawn.id, { x: 2, y: 2 }, pawn.cell, pawn.footprint);

    constructionProgressSystem.execute(world);

    expect(map.objects.getAs(site.id, ObjectKind.ConstructionSite)).toBeDefined();
    expect(map.objects.allOfKind(ObjectKind.Building)).toHaveLength(0);
  });
});
