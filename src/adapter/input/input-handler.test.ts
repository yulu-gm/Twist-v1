import { describe, expect, it } from 'vitest';
import { InputHandler } from './input-handler';
import {
  createPresentationState,
  applyToolSelection,
  ToolType,
} from '../../presentation/presentation-state';

// ── Fake infrastructure ──

function createFakeScene() {
  const listeners: Record<string, Array<(pointer: any) => void>> = {};

  return {
    __listeners: listeners,
    input: {
      on(event: string, handler: (pointer: any) => void) {
        listeners[event] ??= [];
        listeners[event].push(handler);
      },
      activePointer: { x: 0, y: 0 },
      keyboard: null,
    },
    cameras: {
      main: {
        getWorldPoint(x: number, y: number) {
          return { x, y };
        },
      },
    },
    game: {
      canvas: {
        addEventListener(_type: string, _handler: (event: Event) => void) {
          // no-op for test
        },
      },
    },
  };
}

function createFakeWorld() {
  return {
    commandQueue: [] as any[],
    defs: {
      buildings: new Map(),
      terrains: new Map(),
    },
  };
}

function createFakeMap() {
  return {
    id: 'main',
    width: 80,
    height: 80,
    spatial: {
      getAt() { return []; },
      isPassable() { return true; },
      getInRect() { return []; },
    },
    terrain: {
      get() { return 'grass'; },
      inBounds() { return true; },
    },
    zones: {
      getZoneAt() { return null; },
    },
    objects: {
      get() { return null; },
    },
  };
}

// ── Tests ──

describe('InputHandler right click back navigation', () => {
  it('pops back stack on right click when not dragging', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();

    // Push select state, then switch to build
    applyToolSelection(presentation, { tool: ToolType.Build, buildDefId: 'bed_wood' });
    expect(presentation.activeTool).toBe(ToolType.Build);
    expect(presentation.backStack).toHaveLength(1);

    new InputHandler(scene as any, createFakeWorld() as any, createFakeMap() as any, presentation);

    // Simulate right-click
    const pointerdownHandler = scene.__listeners['pointerdown'][0];
    pointerdownHandler({
      button: 2,
      rightButtonDown: () => true,
      leftButtonDown: () => false,
      x: 0,
      y: 0,
    });

    expect(presentation.activeTool).toBe(ToolType.Select);
    expect(presentation.backStack).toHaveLength(0);
  });

  it('cancels drag without popping back stack when right clicking mid-drag', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();

    applyToolSelection(presentation, { tool: ToolType.Build, buildDefId: 'bed_wood' });

    const handler = new InputHandler(scene as any, createFakeWorld() as any, createFakeMap() as any, presentation);

    // Simulate starting a left-click drag
    (handler as any).dragState = {
      startScreenPos: { x: 32, y: 32 },
      startCell: { x: 1, y: 1 },
      active: true,
    };
    presentation.dragRect = {
      startCell: { x: 1, y: 1 },
      endCell: { x: 3, y: 3 },
    };

    // Right-click during drag
    const pointerdownHandler = scene.__listeners['pointerdown'][0];
    pointerdownHandler({
      button: 2,
      rightButtonDown: () => true,
      leftButtonDown: () => false,
      x: 64,
      y: 64,
    });

    // Drag should be cancelled
    expect((handler as any).dragState).toBeNull();
    expect(presentation.dragRect).toBeNull();
    // But tool should stay as build (not popped)
    expect(presentation.activeTool).toBe(ToolType.Build);
    expect(presentation.backStack).toHaveLength(1);
  });

  it('does nothing when right clicking with empty back stack and no drag', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();

    new InputHandler(scene as any, createFakeWorld() as any, createFakeMap() as any, presentation);

    const pointerdownHandler = scene.__listeners['pointerdown'][0];
    pointerdownHandler({
      button: 2,
      rightButtonDown: () => true,
      leftButtonDown: () => false,
      x: 0,
      y: 0,
    });

    // Should not crash, stays in select mode
    expect(presentation.activeTool).toBe(ToolType.Select);
    expect(presentation.backStack).toHaveLength(0);
  });
});
