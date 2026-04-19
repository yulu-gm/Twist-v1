import { describe, expect, it } from 'vitest';
import {
  ToolType,
  createPresentationState,
  applyToolSelection,
  applyObjectSelection,
  popBackNavigation,
  enterCommandMenuBranch,
  popCommandMenuLevel,
  resetCommandMenuPath,
} from './presentation-state';

describe('presentation-state back navigation', () => {
  it('pushes previous select state when entering build mode', () => {
    const p = createPresentationState();
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'bed_wood' });
    expect(p.backStack).toHaveLength(1);
    expect(p.backStack[0].activeTool).toBe(ToolType.Select);
    expect(p.activeTool).toBe(ToolType.Build);
    expect(p.activeBuildDefId).toBe('bed_wood');
  });

  it('pushes selection entry only when selection changes from empty to non-empty', () => {
    const p = createPresentationState();
    applyObjectSelection(p, ['pawn_1']);
    applyObjectSelection(p, ['pawn_2']);
    expect(p.backStack).toHaveLength(1);
    expect(Array.from(p.selectedObjectIds)).toEqual(['pawn_2']);
  });

  it('restores previous stable state and clears transient previews on pop', () => {
    const p = createPresentationState();
    applyObjectSelection(p, ['pawn_1']);
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'bed_wood' });
    p.hoveredCell = { x: 4, y: 5 };
    p.placementPreview = { defId: 'bed_wood', cell: { x: 4, y: 5 }, footprint: { width: 1, height: 2 }, rotation: 0, valid: true };
    p.dragRect = { startCell: { x: 4, y: 5 }, endCell: { x: 6, y: 7 } };

    const popped = popBackNavigation(p);
    expect(popped).toBe(true);
    expect(p.activeTool).toBe(ToolType.Select);
    expect(Array.from(p.selectedObjectIds)).toEqual(['pawn_1']);
    expect(p.placementPreview).toBeNull();
    expect(p.designationPreview).toBeNull();
    expect(p.zonePreview).toBeNull();
    expect(p.dragRect).toBeNull();
  });

  it('pushes current selection when switching from selected select mode into build mode', () => {
    const p = createPresentationState();
    applyObjectSelection(p, ['pawn_1']);
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'wall_wood' });
    expect(p.backStack).toHaveLength(2);

    const restored = popBackNavigation(p);
    expect(restored).toBe(true);
    expect(p.activeTool).toBe(ToolType.Select);
    expect(Array.from(p.selectedObjectIds)).toEqual(['pawn_1']);
  });

  it('does not push when setting the same tool and submode', () => {
    const p = createPresentationState();
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'wall_wood' });
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'wall_wood' });
    expect(p.backStack).toHaveLength(1);
  });

  it('pushes when changing submode within same tool', () => {
    const p = createPresentationState();
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'wall_wood' });
    applyToolSelection(p, { tool: ToolType.Build, buildDefId: 'bed_wood' });
    expect(p.backStack).toHaveLength(2);
  });

  it('returns false and clears transient when popping empty stack', () => {
    const p = createPresentationState();
    p.hoveredCell = { x: 1, y: 2 };
    const result = popBackNavigation(p);
    expect(result).toBe(false);
    expect(p.hoveredCell).toBeNull();
  });
});

describe('presentation-state command menu path', () => {
  it('initializes commandMenuPath as empty array', () => {
    const p = createPresentationState();
    expect(p.commandMenuPath).toEqual([]);
  });

  it('pushes and pops command menu path levels independently from tool backStack', () => {
    const p = createPresentationState();

    enterCommandMenuBranch(p, 'build');
    enterCommandMenuBranch(p, 'furniture');
    expect(p.commandMenuPath).toEqual(['build', 'furniture']);

    expect(popCommandMenuLevel(p)).toBe(true);
    expect(p.commandMenuPath).toEqual(['build']);
    expect(popCommandMenuLevel(p)).toBe(true);
    expect(p.commandMenuPath).toEqual([]);
    expect(popCommandMenuLevel(p)).toBe(false);
  });

  it('resets command menu path without touching active tool fields', () => {
    const p = createPresentationState();
    p.activeTool = ToolType.Build;
    p.activeBuildDefId = 'wall_wood';
    enterCommandMenuBranch(p, 'build');
    enterCommandMenuBranch(p, 'structure');

    resetCommandMenuPath(p);

    expect(p.commandMenuPath).toEqual([]);
    expect(p.activeTool).toBe(ToolType.Build);
    expect(p.activeBuildDefId).toBe('wall_wood');
  });
});
