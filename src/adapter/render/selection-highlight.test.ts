import { describe, expect, it } from 'vitest';
import { SelectionHighlight } from './selection-highlight';
import type { PresentationState } from '../../presentation/presentation-state';
import type { ObjectId, MapObjectBase } from '../../core/types';

// ── Fakes ──

class FakeRectangle {
  x = 0;
  y = 0;
  width: number;
  height: number;
  depth = 0;
  strokeWidth = 0;
  strokeColor = 0;
  strokeAlpha = 0;
  fillColor = 0;
  fillAlpha = 0;
  destroyed = false;

  constructor(x: number, y: number, width: number, height: number, fillColor: number, fillAlpha: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fillColor = fillColor;
    this.fillAlpha = fillAlpha;
  }

  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }

  setStrokeStyle(width: number, color: number, alpha: number) {
    this.strokeWidth = width;
    this.strokeColor = color;
    this.strokeAlpha = alpha;
    return this;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  destroy() {
    this.destroyed = true;
  }
}

function makeScene(rectangles: FakeRectangle[]) {
  return {
    add: {
      rectangle: (x: number, y: number, w: number, h: number, fillColor: number, fillAlpha: number) => {
        const rect = new FakeRectangle(x, y, w, h, fillColor, fillAlpha);
        rectangles.push(rect);
        return rect;
      },
    },
  } as any;
}

function makeMap(objects: Map<ObjectId, Partial<MapObjectBase>>) {
  return {
    objects: {
      get: (id: ObjectId) => objects.get(id) as MapObjectBase | undefined,
    },
  } as any;
}

function makePresentationState(selectedIds: ObjectId[] = []): PresentationState {
  return {
    selectedObjectIds: new Set(selectedIds),
    hoveredCell: null,
    placementPreview: null,
    designationPreview: null,
    activeOverlay: 'none' as PresentationState['activeOverlay'],
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: 'select' as PresentationState['activeTool'],
    activeDesignationType: null,
    activeZoneType: null,
    lastZoneType: 'growing' as PresentationState['lastZoneType'],
    activeBuildDefId: null,
    showDebugPanel: false,
    showGrid: false,
    dragRect: null,
    zonePreview: null,
    backStack: [],
    commandMenuPath: [],
  };
}

// ── Tests ──

describe('SelectionHighlight', () => {
  it('creates a highlight rectangle for a selected 1x1 building', () => {
    const rectangles: FakeRectangle[] = [];
    const objects = new Map<ObjectId, Partial<MapObjectBase>>([
      ['b1', { cell: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, destroyed: false }],
    ]);
    const highlight = new SelectionHighlight(makeScene(rectangles), makeMap(objects));

    highlight.update(makePresentationState(['b1']));

    expect(rectangles).toHaveLength(1);
    // 中心 = 5*32 + 16 = 176
    expect(rectangles[0].x).toBe(176);
    expect(rectangles[0].y).toBe(176);
    expect(rectangles[0].width).toBe(32);
    expect(rectangles[0].height).toBe(32);
    expect(rectangles[0].depth).toBe(5.5);
  });

  it('creates a highlight for a multi-cell building (1x2 bed)', () => {
    const rectangles: FakeRectangle[] = [];
    const objects = new Map<ObjectId, Partial<MapObjectBase>>([
      ['bed1', { cell: { x: 10, y: 12 }, footprint: { width: 1, height: 2 }, destroyed: false }],
    ]);
    const highlight = new SelectionHighlight(makeScene(rectangles), makeMap(objects));

    highlight.update(makePresentationState(['bed1']));

    expect(rectangles).toHaveLength(1);
    // 中心 x = 10*32 + 16 = 336, y = 12*32 + 32 = 416
    expect(rectangles[0].x).toBe(336);
    expect(rectangles[0].y).toBe(416);
    expect(rectangles[0].width).toBe(32);
    expect(rectangles[0].height).toBe(64);
  });

  it('removes highlight when selection is cleared', () => {
    const rectangles: FakeRectangle[] = [];
    const objects = new Map<ObjectId, Partial<MapObjectBase>>([
      ['b1', { cell: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, destroyed: false }],
    ]);
    const highlight = new SelectionHighlight(makeScene(rectangles), makeMap(objects));

    // 选中
    highlight.update(makePresentationState(['b1']));
    expect(rectangles).toHaveLength(1);
    expect(rectangles[0].destroyed).toBe(false);

    // 取消选中
    highlight.update(makePresentationState([]));
    expect(rectangles[0].destroyed).toBe(true);
  });

  it('skips destroyed objects', () => {
    const rectangles: FakeRectangle[] = [];
    const objects = new Map<ObjectId, Partial<MapObjectBase>>([
      ['b1', { cell: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, destroyed: true }],
    ]);
    const highlight = new SelectionHighlight(makeScene(rectangles), makeMap(objects));

    highlight.update(makePresentationState(['b1']));

    expect(rectangles).toHaveLength(0);
  });

  it('handles multiple selections', () => {
    const rectangles: FakeRectangle[] = [];
    const objects = new Map<ObjectId, Partial<MapObjectBase>>([
      ['b1', { cell: { x: 2, y: 3 }, footprint: { width: 1, height: 1 }, destroyed: false }],
      ['b2', { cell: { x: 8, y: 4 }, footprint: { width: 1, height: 1 }, destroyed: false }],
    ]);
    const highlight = new SelectionHighlight(makeScene(rectangles), makeMap(objects));

    highlight.update(makePresentationState(['b1', 'b2']));

    expect(rectangles).toHaveLength(2);
  });

  it('reuses existing rectangle on repeated updates', () => {
    const rectangles: FakeRectangle[] = [];
    const objects = new Map<ObjectId, Partial<MapObjectBase>>([
      ['b1', { cell: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, destroyed: false }],
    ]);
    const highlight = new SelectionHighlight(makeScene(rectangles), makeMap(objects));

    highlight.update(makePresentationState(['b1']));
    highlight.update(makePresentationState(['b1']));

    // 应该只创建一个矩形（复用）
    expect(rectangles).toHaveLength(1);
    expect(rectangles[0].destroyed).toBe(false);
  });
});
