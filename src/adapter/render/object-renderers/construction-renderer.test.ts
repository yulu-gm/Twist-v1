import { describe, expect, it } from 'vitest';
import { ObjectKind, Rotation, type CellCoord, type Footprint, type MapObjectBase } from '../../../core/types';
import { PHYSICAL_OCCUPANT_TAG } from '../../../world/occupancy';
import type { Blueprint } from '../../../features/construction/blueprint.types';
import type { ConstructionSite } from '../../../features/construction/construction-site.types';
import { ConstructionRenderer, constructionRendererStyleTokens } from './construction-renderer';

class FakeRectangle {
  x = 0;
  y = 0;
  width: number;
  height: number;
  fillColor: number;
  fillAlpha: number;
  strokeWidth = 0;
  strokeColor = 0;
  strokeAlpha = 0;

  constructor(x: number, y: number, width: number, height: number, fillColor: number, fillAlpha: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fillColor = fillColor;
    this.fillAlpha = fillAlpha;
  }

  setStrokeStyle(width: number, color: number, alpha: number) {
    this.strokeWidth = width;
    this.strokeColor = color;
    this.strokeAlpha = alpha;
    return this;
  }

  setFillStyle(color: number, alpha: number) {
    this.fillColor = color;
    this.fillAlpha = alpha;
    return this;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

class FakeContainer {
  children: unknown[] = [];

  add(child: unknown) {
    this.children.push(child);
    return child;
  }
}

function makeScene(rectangles: FakeRectangle[]) {
  return {
    add: {
      rectangle: (x: number, y: number, width: number, height: number, fillColor: number, fillAlpha: number) => {
        const rect = new FakeRectangle(x, y, width, height, fillColor, fillAlpha);
        rectangles.push(rect);
        return rect;
      },
    },
  } as any;
}

function makeMap(objects: MapObjectBase[]) {
  const store = new Map(objects.map(obj => [obj.id, obj]));

  return {
    objects: {
      get: (id: string) => store.get(id),
    },
    spatial: {
      getInRect: (min: CellCoord, max: CellCoord) => {
        const ids: string[] = [];
        for (const obj of store.values()) {
          const footprint = obj.footprint ?? { width: 1, height: 1 };
          const overlaps = obj.cell.x <= max.x
            && obj.cell.x + footprint.width - 1 >= min.x
            && obj.cell.y <= max.y
            && obj.cell.y + footprint.height - 1 >= min.y;
          if (overlaps) {
            ids.push(obj.id);
          }
        }
        return ids;
      },
    },
  } as any;
}

function makeBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  return {
    id: overrides.id ?? 'bp_1',
    kind: ObjectKind.Blueprint,
    defId: overrides.defId ?? 'blueprint_wall_wood',
    mapId: overrides.mapId ?? 'main',
    cell: overrides.cell ?? { x: 6, y: 6 },
    footprint: overrides.footprint ?? { width: 1, height: 1 },
    tags: overrides.tags ?? new Set(['blueprint', 'construction']),
    destroyed: overrides.destroyed ?? false,
    targetDefId: overrides.targetDefId ?? 'wall_wood',
    rotation: overrides.rotation ?? Rotation.North,
    materialsRequired: overrides.materialsRequired ?? [{ defId: 'wood', count: 5 }],
    materialsDelivered: overrides.materialsDelivered ?? [{ defId: 'wood', count: 0 }],
  };
}

function makeConstructionSite(overrides: Partial<ConstructionSite> = {}): ConstructionSite {
  return {
    id: overrides.id ?? 'site_1',
    kind: ObjectKind.ConstructionSite,
    defId: overrides.defId ?? 'site_wall_wood',
    mapId: overrides.mapId ?? 'main',
    cell: overrides.cell ?? { x: 6, y: 6 },
    footprint: overrides.footprint ?? { width: 1, height: 1 },
    tags: overrides.tags ?? new Set(['construction_site', 'construction']),
    destroyed: overrides.destroyed ?? false,
    targetDefId: overrides.targetDefId ?? 'wall_wood',
    rotation: overrides.rotation ?? Rotation.North,
    buildProgress: overrides.buildProgress ?? 0.45,
    totalWorkAmount: overrides.totalWorkAmount ?? 100,
    workDone: overrides.workDone ?? 45,
  };
}

function makeOccupant(id: string, cell: CellCoord, footprint: Footprint = { width: 1, height: 1 }): MapObjectBase {
  return {
    id,
    kind: ObjectKind.Item,
    defId: 'wood',
    mapId: 'main',
    cell,
    footprint,
    tags: new Set([PHYSICAL_OCCUPANT_TAG]),
    destroyed: false,
  };
}

describe('ConstructionRenderer', () => {
  it('renders blueprints with translucent fill and a non-warning outline', () => {
    const rectangles: FakeRectangle[] = [];
    const layer = new FakeContainer();
    const blueprint = makeBlueprint();
    const renderer = new ConstructionRenderer(makeScene(rectangles), layer as any, makeMap([blueprint]));

    const sprite = renderer.createSprite(blueprint, 208, 208, 0x66aaff) as unknown as FakeRectangle;

    expect(layer.children).toHaveLength(1);
    expect(sprite.fillAlpha).toBeLessThan(1);
    expect(sprite.strokeColor).not.toBe(constructionRendererStyleTokens.warningStroke);
  });

  it('renders construction sites with translucent fill distinct from blueprint styling', () => {
    const rectangles: FakeRectangle[] = [];
    const layer = new FakeContainer();
    const site = makeConstructionSite();
    const renderer = new ConstructionRenderer(makeScene(rectangles), layer as any, makeMap([site]));

    const sprite = renderer.createSprite(site, 208, 208, 0xffaa33) as unknown as FakeRectangle;

    expect(sprite.fillAlpha).toBeLessThan(1);
    expect(sprite.fillColor).toBe(0xffaa33);
    expect(sprite.strokeColor).not.toBe(0x66aaff);
  });

  it('switches to a warning style when the construction footprint is physically occupied', () => {
    const rectangles: FakeRectangle[] = [];
    const layer = new FakeContainer();
    const blueprint = makeBlueprint();
    const occupant = makeOccupant('itm_1', { x: 6, y: 6 });
    const renderer = new ConstructionRenderer(makeScene(rectangles), layer as any, makeMap([blueprint, occupant]));

    const sprite = renderer.createSprite(blueprint, 208, 208, 0x66aaff) as unknown as FakeRectangle;
    renderer.updateSprite(sprite as any, blueprint, 0x66aaff);

    expect(sprite.strokeColor).toBe(constructionRendererStyleTokens.warningStroke);
    expect(sprite.fillColor).toBe(constructionRendererStyleTokens.warningFill);
    expect(sprite.fillAlpha).toBeLessThan(0.5);
  });
});
