/**
 * @file inspector.selectors.test.ts
 * @description 统一 Object Inspector 选择器测试
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { selectObjectInspector, registerInspectorAdapters } from './inspector.selectors';
import { inspectorAdapters } from './adapters/inspector-adapters';
import type { EngineSnapshot, UiState } from '../../kernel/ui-types';

function makeUiState(overrides: Partial<UiState> = {}): UiState {
  return {
    activePanel: 'colonists',
    inspectorTab: 'overview',
    colonistSort: 'name',
    colonistSearch: '',
    buildSearch: '',
    notificationCenterOpen: false,
    pinnedColonistId: null,
    inspectorTargetId: null,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    tick: 1,
    speed: 1,
    clockDisplay: 'Day 1, 00:00',
    colonistCount: 0,
    presentation: {
      activeTool: 'select',
      activeDesignationType: null,
      activeZoneType: null,
      activeBuildDefId: null,
      hoveredCell: null,
      selectedIds: [],
      showDebugPanel: false,
      showGrid: false,
    },
    selection: { primaryId: null, selectedIds: [] },
    colonists: {},
    buildings: {},
    objects: {},
    build: {
      activeTool: 'select',
      activeDesignationType: null,
      activeZoneType: null,
      lastZoneType: 'stockpile',
      activeBuildDefId: null,
      activeModeLabel: 'Select',
    },
    feedback: { recentEvents: [] },
    debugInfo: '',
    ...overrides,
  };
}

describe('selectObjectInspector', () => {
  beforeEach(() => {
    // 默认使用全局 adapter 注册表
    registerInspectorAdapters(inspectorAdapters);
  });

  it('returns null when nothing is selected', () => {
    const result = selectObjectInspector(makeSnapshot(), makeUiState());
    expect(result).toBeNull();
  });

  it('returns generic fallback for an object with no adapter', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'item_1', selectedIds: ['item_1'] },
      objects: {
        item_1: {
          id: 'item_1',
          kind: 'item',
          label: 'Wood',
          defId: 'wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
          stackCount: 10,
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState());
    expect(vm).not.toBeNull();
    expect(vm!.mode).toBe('generic');
    expect(vm!.targetId).toBe('item_1');
    expect(vm!.title).toBe('Wood');
    if (vm!.mode === 'generic') {
      expect(vm!.fallbackNotice).toContain('尚未实现专用 Inspector');
      expect(vm!.stats.some(s => s.label === 'Kind' && s.value === 'item')).toBe(true);
    }
  });

  it('builds same-cell object stack sorted by priority', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'building_1', selectedIds: ['building_1'] },
      objects: {
        building_1: {
          id: 'building_1',
          kind: 'building',
          label: 'Wood Wall',
          defId: 'wall_wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
        } as any,
        item_1: {
          id: 'item_1',
          kind: 'item',
          label: 'Wood',
          defId: 'wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
          stackCount: 10,
        } as any,
        pawn_1: {
          id: 'pawn_1',
          kind: 'pawn',
          label: 'Alice',
          defId: 'pawn',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
          currentJobLabel: 'Idle',
          needs: { food: 100, rest: 100, joy: 100, mood: 100 },
          health: { hp: 100, maxHp: 100 },
          workDecision: null,
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState());
    expect(vm).not.toBeNull();
    // Stack should be sorted: pawn > building > item
    expect(vm!.stack.map(e => e.kind)).toEqual(['pawn', 'building', 'item']);
    // Target should still be the primaryId
    expect(vm!.targetId).toBe('building_1');
  });

  it('uses inspectorTargetId when set and in stack', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'building_1', selectedIds: ['building_1'] },
      objects: {
        building_1: {
          id: 'building_1',
          kind: 'building',
          label: 'Wood Wall',
          defId: 'wall_wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
        } as any,
        item_1: {
          id: 'item_1',
          kind: 'item',
          label: 'Wood',
          defId: 'wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
          stackCount: 10,
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState({ inspectorTargetId: 'item_1' }));
    expect(vm!.targetId).toBe('item_1');
    expect(vm!.title).toBe('Wood');
  });

  it('ignores inspectorTargetId when not in stack', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'building_1', selectedIds: ['building_1'] },
      objects: {
        building_1: {
          id: 'building_1',
          kind: 'building',
          label: 'Wood Wall',
          defId: 'wall_wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState({ inspectorTargetId: 'nonexistent' }));
    expect(vm!.targetId).toBe('building_1');
  });

  it('excludes destroyed objects from the stack', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'building_1', selectedIds: ['building_1'] },
      objects: {
        building_1: {
          id: 'building_1',
          kind: 'building',
          label: 'Wood Wall',
          defId: 'wall_wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
        } as any,
        item_dead: {
          id: 'item_dead',
          kind: 'item',
          label: 'Dead Item',
          defId: 'wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
          stackCount: 1,
          destroyed: true,
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState());
    expect(vm!.stack).toHaveLength(1);
    expect(vm!.stack[0].id).toBe('building_1');
  });

  it('uses registered adapter when available', () => {
    registerInspectorAdapters([
      {
        id: 'test_item',
        supports: (obj) => obj.kind === 'item',
        buildViewModel: (obj, ctx) => ({
          mode: 'specialized',
          targetId: ctx.targetId,
          title: obj.label,
          subtitle: 'Item',
          stack: ctx.stack,
          sections: [{ id: 'overview', title: 'Overview', rows: [{ label: 'Stack', value: '10' }] }],
          actions: [],
        }),
      },
    ]);

    const snapshot = makeSnapshot({
      selection: { primaryId: 'item_1', selectedIds: ['item_1'] },
      objects: {
        item_1: {
          id: 'item_1',
          kind: 'item',
          label: 'Wood',
          defId: 'wood',
          cell: { x: 5, y: 5 },
          footprint: { width: 1, height: 1 },
          stackCount: 10,
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState());
    expect(vm!.mode).toBe('specialized');
    if (vm!.mode === 'specialized') {
      expect(vm!.sections[0].title).toBe('Overview');
    }
  });

  it('uses the pawn adapter for pawn objects', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'pawn_1', selectedIds: ['pawn_1'] },
      objects: {
        pawn_1: {
          id: 'pawn_1',
          kind: 'pawn',
          label: 'Alice',
          defId: 'pawn',
          cell: { x: 2, y: 2 },
          footprint: { width: 1, height: 1 },
          currentJobLabel: 'Idle',
          needs: { food: 60, rest: 40, joy: 70, mood: 50 },
          health: { hp: 100, maxHp: 100 },
          workDecision: null,
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState());
    expect(vm).not.toBeNull();
    expect(vm!.mode).toBe('specialized');
    expect(vm!.title).toBe('Alice');
    if (vm!.mode === 'specialized') {
      expect(vm!.sections.some(s => s.title === 'Needs')).toBe(true);
      expect(vm!.sections.some(s => s.title === 'Overview')).toBe(true);
    }
  });

  it('uses the building adapter for buildings with bed actions', () => {
    const snapshot = makeSnapshot({
      selection: { primaryId: 'bed_1', selectedIds: ['bed_1'] },
      objects: {
        bed_1: {
          id: 'bed_1',
          kind: 'building',
          label: 'Wood Bed',
          defId: 'bed_wood',
          cell: { x: 8, y: 8 },
          footprint: { width: 1, height: 2 },
          category: 'furniture',
          usageType: 'bed',
          bed: { role: 'owned', ownerPawnId: 'Alice', occupantPawnId: null, autoAssignable: false },
        } as any,
      },
    });

    const vm = selectObjectInspector(snapshot, makeUiState());
    expect(vm).not.toBeNull();
    expect(vm!.mode).toBe('specialized');
    if (vm!.mode === 'specialized') {
      expect(vm!.actions.map(a => a.id)).toContain('assign_bed_owner');
      expect(vm!.actions.map(a => a.id)).toContain('clear_bed_owner');
      expect(vm!.sections.some(s => s.title === 'Bed')).toBe(true);
    }
  });
});
