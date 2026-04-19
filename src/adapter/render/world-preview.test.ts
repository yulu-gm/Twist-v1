import { describe, expect, it } from 'vitest';
import { WorldPreview } from './world-preview';
import { Rotation } from '../../core/types';
import type { PresentationState } from '../../presentation/presentation-state';

class FakeRectangle {
  x = 0;
  y = 0;
  width: number;
  height: number;
  visible = false;
  depth = 0;
  strokeWidth = 0;
  strokeColor = 0;
  fillColor = 0;
  fillAlpha = 0;

  constructor(width: number, height: number, fillColor: number, fillAlpha: number) {
    this.width = width;
    this.height = height;
    this.fillColor = fillColor;
    this.fillAlpha = fillAlpha;
  }

  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }

  setStrokeStyle(width: number, color: number) {
    this.strokeWidth = width;
    this.strokeColor = color;
    return this;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  setFillStyle(color: number, alpha: number) {
    this.fillColor = color;
    this.fillAlpha = alpha;
    return this;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }
}

class FakeGraphics {
  setDepth() {
    return this;
  }

  clear() {
    return this;
  }

  fillStyle() {
    return this;
  }

  lineStyle() {
    return this;
  }

  fillRect() {
    return this;
  }

  strokeRect() {
    return this;
  }
}

function makePresentationState(): PresentationState {
  return {
    selectedObjectIds: new Set(),
    hoveredCell: null,
    placementPreview: null,
    designationPreview: null,
    activeOverlay: 'none' as PresentationState['activeOverlay'],
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: 'select' as PresentationState['activeTool'],
    activeDesignationType: null,
    activeZoneType: null,
    lastZoneType: 'stockpile' as PresentationState['lastZoneType'],
    activeBuildDefId: null,
    showDebugPanel: false,
    showGrid: false,
    dragRect: null,
    zonePreview: null,
    backStack: [],
    commandMenuPath: [],
  };
}

describe('WorldPreview', () => {
  it('renders multi-cell build previews using the full footprint center and size', () => {
    const rectangles: FakeRectangle[] = [];
    const scene = {
      add: {
        rectangle: (_x: number, _y: number, width: number, height: number, fillColor: number, fillAlpha: number) => {
          const rectangle = new FakeRectangle(width, height, fillColor, fillAlpha);
          rectangles.push(rectangle);
          return rectangle;
        },
        graphics: () => new FakeGraphics(),
      },
    } as any;

    const preview = new WorldPreview(scene);
    const presentation = makePresentationState();
    presentation.placementPreview = {
      defId: 'bed_wood',
      cell: { x: 10, y: 12 },
      footprint: { width: 1, height: 2 },
      rotation: Rotation.North,
      valid: true,
    };

    preview.update(presentation);

    expect(rectangles).toHaveLength(1);
    expect(rectangles[0].width).toBe(32);
    expect(rectangles[0].height).toBe(64);
    expect(rectangles[0].x).toBe(10 * 32 + 16);
    expect(rectangles[0].y).toBe(12 * 32 + 32);
    expect(rectangles[0].visible).toBe(true);
  });

  it('renders invalid build previews in red when placementPreview.valid is false', () => {
    const rectangles: FakeRectangle[] = [];
    const scene = {
      add: {
        rectangle: (_x: number, _y: number, width: number, height: number, fillColor: number, fillAlpha: number) => {
          const rectangle = new FakeRectangle(width, height, fillColor, fillAlpha);
          rectangles.push(rectangle);
          return rectangle;
        },
        graphics: () => new FakeGraphics(),
      },
    } as any;

    const preview = new WorldPreview(scene);
    const presentation = makePresentationState();
    presentation.placementPreview = {
      defId: 'bed_wood',
      cell: { x: 10, y: 12 },
      footprint: { width: 1, height: 2 },
      rotation: Rotation.North,
      valid: false,
    };

    preview.update(presentation);

    expect(rectangles).toHaveLength(1);
    expect(rectangles[0].fillColor).toBe(0xff0000);
    expect(rectangles[0].strokeColor).toBe(0xff0000);
  });
});
