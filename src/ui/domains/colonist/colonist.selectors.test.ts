/**
 * @file colonist.selectors.test.ts
 * @description 殖民者选择器测试 — 验证列表排序/搜索/选中标记和检查器视图模型生成
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

import { describe, expect, it } from 'vitest';
import { selectColonistRosterRows, selectColonistInspector } from './colonist.selectors';
import type { EngineSnapshot, UiState } from '../../kernel/ui-types';

/** 构造测试用引擎快照，可覆盖任意字段 */
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

/** 构造测试用 UI 状态，可覆盖任意字段 */
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

describe('selectColonistRosterRows', () => {
  it('sorts colonists by name by default', () => {
    const rows = selectColonistRosterRows(
      makeSnapshot({
        colonists: {
          b: { id: 'b', name: 'Bob', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 50, rest: 50, joy: 50, mood: 50 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
          a: { id: 'a', name: 'Alice', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 50, rest: 50, joy: 50, mood: 80 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
        },
      }),
      makeUiState(),
    );
    expect(rows.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('sorts colonists by mood descending', () => {
    const rows = selectColonistRosterRows(
      makeSnapshot({
        colonists: {
          a: { id: 'a', name: 'Alice', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 50, rest: 50, joy: 50, mood: 74 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
          b: { id: 'b', name: 'Bob', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'job_mine', currentJobLabel: 'Mine', needs: { food: 50, rest: 50, joy: 50, mood: 21 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
        },
      }),
      makeUiState({ colonistSort: 'mood' }),
    );
    expect(rows.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('filters by search text', () => {
    const rows = selectColonistRosterRows(
      makeSnapshot({
        colonists: {
          a: { id: 'a', name: 'Alice', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 50, rest: 50, joy: 50, mood: 50 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
          b: { id: 'b', name: 'Bob', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 50, rest: 50, joy: 50, mood: 50 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
        },
      }),
      makeUiState({ colonistSearch: 'ali' }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');
  });

  it('marks selected colonists', () => {
    const rows = selectColonistRosterRows(
      makeSnapshot({
        colonists: {
          a: { id: 'a', name: 'Alice', cell: { x: 0, y: 0 }, factionId: '', currentJob: 'idle', currentJobLabel: 'Idle', needs: { food: 50, rest: 50, joy: 50, mood: 50 }, health: { hp: 100, maxHp: 100 }, workDecision: null },
        },
        selection: { primaryId: 'a', selectedIds: ['a'] },
      }),
      makeUiState(),
    );
    expect(rows[0].isSelected).toBe(true);
  });
});

describe('selectColonistInspector', () => {
  it('returns null when no primary selection', () => {
    expect(selectColonistInspector(makeSnapshot(), makeUiState())).toBeNull();
  });

  it('returns inspector view model for selected colonist', () => {
    const vm = selectColonistInspector(
      makeSnapshot({
        colonists: {
          a: { id: 'a', name: 'Alice', cell: { x: 5, y: 10 }, factionId: 'player', currentJob: 'job_construct', currentJobLabel: 'Construct', needs: { food: 62, rest: 41, joy: 80, mood: 55 }, health: { hp: 80, maxHp: 100 }, workDecision: null },
        },
        selection: { primaryId: 'a', selectedIds: ['a'] },
      }),
      makeUiState(),
    );
    expect(vm).not.toBeNull();
    expect(vm!.name).toBe('Alice');
    expect(vm!.jobLabel).toBe('Construct');
    expect(vm!.needs).toHaveLength(3);
    expect(vm!.needs[0].key).toBe('food');
    expect(vm!.needs[0].value).toBe(62);
    expect(vm!.needs.some(need => need.key === 'rest')).toBe(false);
    expect(vm!.workQueue).toEqual([]);
  });

  it('builds work queue rows for the colonist inspector', () => {
    const vm = selectColonistInspector(
      makeSnapshot({
        colonists: {
          a: {
            id: 'a',
            name: 'Alice',
            cell: { x: 5, y: 10 },
            factionId: 'player',
            currentJob: 'job_eat',
            currentJobLabel: '吃饭',
            needs: { food: 20, rest: 80, joy: 80, mood: 60 },
            health: { hp: 80, maxHp: 100 },
            workDecision: {
              evaluatedAtTick: 12,
              selectedWorkKind: 'eat',
              selectedWorkLabel: '吃饭',
              activeToilLabel: 'pickup',
              activeToilState: 'not_started',
              options: [
                { kind: 'eat', label: '吃饭', status: 'active', detail: 'meal_simple', failureReasonText: null },
                { kind: 'construct', label: '施工', status: 'blocked', detail: null, failureReasonText: '材料尚未送达' },
                { kind: 'haul_to_storage', label: '搬运到仓库', status: 'deferred', detail: null, failureReasonText: null },
              ],
            },
          },
        },
        selection: { primaryId: 'a', selectedIds: ['a'] },
      }),
      makeUiState(),
    );

    expect(vm?.workQueue).toEqual([
      { label: '吃饭', tone: 'active', detail: '拾取（未开始）' },
      { label: '施工', tone: 'blocked', detail: '材料尚未送达' },
      { label: '搬运到仓库', tone: 'deferred', detail: null },
    ]);
  });
});
