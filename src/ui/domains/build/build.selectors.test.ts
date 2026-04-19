/**
 * @file build.selectors.test.ts
 * @description 建造选择器测试 — 验证顶栏数据提取和分层命令菜单视图模型
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { describe, expect, it } from 'vitest';
import { selectCommandMenuViewModel, selectTopStatusBar } from './build.selectors';
import type { EngineSnapshot } from '../../kernel/ui-types';

/** 构造测试用引擎快照，可覆盖任意字段 */
function makeSnapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    tick: 100,
    speed: 1,
    clockDisplay: 'Year 1, Spring, Day 1, 6:00',
    colonistCount: 3,
    presentation: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, activeBuildDefId: null, commandMenuPath: [], hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    selection: { primaryId: null, selectedIds: [] },
    colonists: {},
    build: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, lastZoneType: 'stockpile', activeBuildDefId: null, activeModeLabel: 'Select' },
    feedback: { recentEvents: [] },
    workOrders: { list: [], byId: {} },
    debugInfo: '',
    objects: {},
    ...overrides,
  };
}

describe('selectTopStatusBar', () => {
  it('extracts clock, tick, speed, and colonist count', () => {
    const vm = selectTopStatusBar(makeSnapshot());
    expect(vm.clockDisplay).toBe('Year 1, Spring, Day 1, 6:00');
    expect(vm.tick).toBe(100);
    expect(vm.speed).toBe(1);
    expect(vm.colonistCount).toBe(3);
  });
});

describe('selectCommandMenuViewModel', () => {
  it('returns root entries with 选择 marked active when no tool is engaged', () => {
    const vm = selectCommandMenuViewModel(makeSnapshot());
    expect(vm.path).toEqual([]);
    expect(vm.entries.map((entry) => entry.label)).toEqual(['选择', '建造', '指令', '区域', '取消']);
    expect(vm.entries[0].active).toBe(true);
  });

  it('highlights the 建造 ancestor branch when wall is the active leaf', () => {
    const vm = selectCommandMenuViewModel(
      makeSnapshot({
        presentation: {
          activeTool: 'build',
          activeDesignationType: null,
          activeZoneType: null,
          activeBuildDefId: 'wall_wood',
          commandMenuPath: [],
          hoveredCell: null,
          selectedIds: [],
          showDebugPanel: false,
          showGrid: false,
        },
      }),
    );
    expect(vm.entries.find((entry) => entry.label === '建造')?.active).toBe(true);
  });

  it('returns 建造 -> 家具 level with 返回 and 床 (床 active when bed_wood is selected)', () => {
    const vm = selectCommandMenuViewModel(
      makeSnapshot({
        presentation: {
          activeTool: 'build',
          activeDesignationType: null,
          activeZoneType: null,
          activeBuildDefId: 'bed_wood',
          commandMenuPath: ['build', 'furniture'],
          hoveredCell: null,
          selectedIds: [],
          showDebugPanel: false,
          showGrid: false,
        },
      }),
    );
    expect(vm.path).toEqual(['build', 'furniture']);
    expect(vm.entries.map((entry) => entry.label)).toEqual(['返回', '床']);
    expect(vm.entries[1].active).toBe(true);
  });

  it('exposes designate and zone leaves with their action payloads at the leaf level', () => {
    const designateVm = selectCommandMenuViewModel(
      makeSnapshot({
        presentation: {
          activeTool: 'designate',
          activeDesignationType: 'mine',
          activeZoneType: null,
          activeBuildDefId: null,
          commandMenuPath: ['designate'],
          hoveredCell: null,
          selectedIds: [],
          showDebugPanel: false,
          showGrid: false,
        },
      }),
    );
    expect(designateVm.entries.map((entry) => entry.label)).toEqual(['返回', '采矿', '收获', '砍伐']);
    expect(designateVm.entries.find((entry) => entry.label === '采矿')?.active).toBe(true);

    const zoneVm = selectCommandMenuViewModel(
      makeSnapshot({
        presentation: {
          activeTool: 'zone',
          activeDesignationType: null,
          activeZoneType: 'growing',
          activeBuildDefId: null,
          commandMenuPath: ['zone'],
          hoveredCell: null,
          selectedIds: [],
          showDebugPanel: false,
          showGrid: false,
        },
      }),
    );
    expect(zoneVm.entries.map((entry) => entry.label)).toEqual(['返回', '存储区', '种植区']);
    expect(zoneVm.entries.find((entry) => entry.label === '种植区')?.active).toBe(true);
  });
});
