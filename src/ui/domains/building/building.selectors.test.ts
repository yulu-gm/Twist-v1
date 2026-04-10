import { describe, expect, it } from 'vitest';
import { selectBuildingInspector } from './building.selectors';
import type { EngineSnapshot, UiState } from '../../kernel/ui-types';

function makeSnapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    tick: 1,
    speed: 1,
    clockDisplay: '',
    colonistCount: 0,
    presentation: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    selection: { primaryId: null, selectedIds: [] },
    colonists: {},
    build: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, lastZoneType: 'stockpile', activeBuildDefId: null, activeModeLabel: 'Select' },
    feedback: { recentEvents: [] },
    debugInfo: '',
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
    expect(vm!.label).toBe('Wood Bed');
    expect(vm!.stats.find((row) => row.label === 'Type')?.value).toBe('Bed');
    expect(vm!.stats.find((row) => row.label === 'Size')?.value).toBe('1x2');
  });
});
