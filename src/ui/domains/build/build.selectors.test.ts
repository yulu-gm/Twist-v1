/**
 * @file build.selectors.test.ts
 * @description 建造选择器测试 — 验证顶栏数据提取、建造摘要和工具 ID 匹配
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { describe, expect, it } from 'vitest';
import { selectActiveToolId, selectTopStatusBar } from './build.selectors';
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

describe('selectActiveToolId', () => {
  it('returns select for select tool', () => {
    expect(selectActiveToolId(makeSnapshot())).toBe('select');
  });

  it('returns mine for designate+mine', () => {
    expect(selectActiveToolId(makeSnapshot({
      presentation: { activeTool: 'designate', activeDesignationType: 'mine', activeZoneType: null, activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    }))).toBe('mine');
  });

  it('returns build_wall for wall build tool', () => {
    expect(selectActiveToolId(makeSnapshot({
      presentation: { activeTool: 'build', activeDesignationType: null, activeZoneType: null, activeBuildDefId: 'wall_wood', hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    }))).toBe('build_wall');
  });

  it('returns build_bed for bed build tool', () => {
    expect(selectActiveToolId(makeSnapshot({
      presentation: { activeTool: 'build', activeDesignationType: null, activeZoneType: null, activeBuildDefId: 'bed_wood', hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    }))).toBe('build_bed');
  });

  it('returns zone_stockpile for zone+stockpile', () => {
    expect(selectActiveToolId(makeSnapshot({
      presentation: { activeTool: 'zone', activeDesignationType: null, activeZoneType: 'stockpile', activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    }))).toBe('zone_stockpile');
  });

  it('returns zone_growing for zone+growing', () => {
    expect(selectActiveToolId(makeSnapshot({
      presentation: { activeTool: 'zone', activeDesignationType: null, activeZoneType: 'growing', activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    }))).toBe('zone_growing');
  });
});
