import { describe, expect, it } from 'vitest';
import { selectBuildingInspector } from './building.selectors';
import type { EngineSnapshot, UiState } from '../../kernel/ui-types';

function makeSnapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    tick: 1,
    speed: 1,
    clockDisplay: '',
    colonistCount: 0,
    presentation: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, activeBuildDefId: null, commandMenuPath: [], hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    selection: { primaryId: null, selectedIds: [] },
    colonists: {},
    build: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, lastZoneType: 'growing', activeBuildDefId: null, activeModeLabel: 'Select' },
    feedback: { recentEvents: [] },
    workOrders: { list: [], byId: {} },
    debugInfo: '',
    objects: {},
    ...overrides,
  };
}

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

describe('selectBuildingInspector', () => {
  it('returns null when nothing is selected', () => {
    expect(selectBuildingInspector(makeSnapshot(), makeUiState())).toBeNull();
  });

  it('returns a bed inspector when a bed is the primary selection', () => {
    const vm = selectBuildingInspector(
      makeSnapshot({
        selection: { primaryId: 'bed_1', selectedIds: ['bed_1'] },
        buildings: {
          bed_1: {
            id: 'bed_1',
            label: 'Wood Bed',
            defId: 'bed_wood',
            cell: { x: 8, y: 12 },
            category: 'furniture',
            usageType: 'bed',
            footprint: { width: 1, height: 2 },
            bed: {
              role: 'public',
              ownerPawnId: null,
              occupantPawnId: null,
              autoAssignable: true,
            },
          },
        },
      } as Partial<EngineSnapshot>),
      makeUiState(),
    );

    expect(vm).not.toBeNull();
    expect(vm!.kind).toBe('bed');
    expect(vm!.base.label).toBe('Wood Bed');
    expect(vm!.base.stats.find((row) => row.label === 'Type')?.value).toBe('Bed');
    expect(vm!.base.stats.find((row) => row.label === 'Size')?.value).toBe('1x2');
  });

  it('returns a generic inspector for non-bed buildings', () => {
    const vm = selectBuildingInspector(makeSnapshot({
      selection: { primaryId: 'wall_1', selectedIds: ['wall_1'] },
      buildings: {
        wall_1: {
          id: 'wall_1', label: 'Wood Wall', defId: 'wall_wood',
          cell: { x: 4, y: 4 }, footprint: { width: 1, height: 1 },
          category: 'structure',
        },
      },
    } as Partial<EngineSnapshot>), makeUiState());

    expect(vm?.kind).toBe('generic');
    expect(vm?.base.label).toBe('Wood Wall');
    expect(vm?.base.stats.find(row => row.label === 'Type')?.value).toBe('Structure');
  });

  it('returns a bed inspector with owner info and colonist options', () => {
    const vm = selectBuildingInspector(makeSnapshot({
      selection: { primaryId: 'bed_1', selectedIds: ['bed_1'] },
      colonists: {
        pawn_1: { id: 'pawn_1', name: 'Alice', cell: { x: 5, y: 5 }, factionId: 'player', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 80, rest: 70, joy: 80, mood: 70 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
      },
      buildings: {
        bed_1: {
          id: 'bed_1', label: 'Wood Bed', defId: 'bed_wood',
          cell: { x: 8, y: 12 }, footprint: { width: 1, height: 2 },
          category: 'furniture', usageType: 'bed',
          bed: { role: 'owned', ownerPawnId: 'Alice', occupantPawnId: null, autoAssignable: false },
        },
      },
    } as Partial<EngineSnapshot>), makeUiState());

    expect(vm?.kind).toBe('bed');
    if (vm?.kind === 'bed') {
      expect(vm.detail.ownerLabel).toBe('Alice');
      expect(vm.detail.occupantLabel).toBe('Empty');
      expect(vm.detail.availableOwners.map(o => o.label)).toEqual(['Alice']);
    }
  });
});
