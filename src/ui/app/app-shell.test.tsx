/**
 * @file app-shell.test.tsx
 * @description AppShell 组件测试 — 验证空壳占位模式和统一 Inspector 渲染
 * @part-of ui/app — 应用层
 */

import { render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders the unified object inspector when an object is selected', () => {
    const snapshot = {
      tick: 1,
      speed: 1,
      clockDisplay: 'Day 1, 00:00',
      colonistCount: 1,
      presentation: {
        activeTool: 'select',
        activeDesignationType: null,
        activeZoneType: null,
        activeBuildDefId: null,
        hoveredCell: null,
        selectedIds: ['pawn_1'],
        showDebugPanel: false,
        showGrid: false,
      },
      selection: { primaryId: 'pawn_1', selectedIds: ['pawn_1'] },
      colonists: {
        pawn_1: {
          id: 'pawn_1',
          name: 'Alice',
          cell: { x: 2, y: 2 },
          factionId: 'player',
          currentJob: 'idle',
          currentJobLabel: 'Idle',
          needs: { food: 60, rest: 50, joy: 70, mood: 60 },
          health: { hp: 100, maxHp: 100 },
          workDecision: null,
        },
      },
      buildings: {},
      objects: {
        pawn_1: {
          id: 'pawn_1',
          kind: 'pawn',
          label: 'Alice',
          defId: 'pawn',
          cell: { x: 2, y: 2 },
          footprint: { width: 1, height: 1 },
          currentJobLabel: 'Idle',
          needs: { food: 60, rest: 50, joy: 70, mood: 60 },
          health: { hp: 100, maxHp: 100 },
          workDecision: null,
        },
      },
      build: {
        activeTool: 'select',
        activeDesignationType: null,
        activeZoneType: null,
        lastZoneType: 'stockpile',
        activeBuildDefId: null,
        activeModeLabel: 'Select',
      },
      feedback: { recentEvents: [] },
      workOrders: { list: [], byId: {} },
      debugInfo: '',
    } as any;

    const uiState = {
      activePanel: 'colonists' as const,
      inspectorTab: 'overview' as const,
      colonistSort: 'name' as const,
      colonistSearch: '',
      buildSearch: '',
      notificationCenterOpen: false,
      pinnedColonistId: null,
      inspectorTargetId: null,
    };

    const ports = {
      setSpeed: vi.fn(),
      selectColonist: vi.fn(),
      selectObjects: vi.fn(),
      setTool: vi.fn(),
      jumpCameraTo: vi.fn(),
      dispatchCommand: vi.fn(),
      assignBedOwner: vi.fn(),
      clearBedOwner: vi.fn(),
    };

    render(<AppShell snapshot={snapshot} uiState={uiState} dispatch={vi.fn()} ports={ports as any} />);

    // 统一 Object Inspector 应被渲染
    expect(screen.getByTestId('object-inspector')).toBeInTheDocument();
    // Alice 的名称应出现在 Inspector 标题中
    expect(screen.getByTestId('inspector-title').textContent).toBe('Alice');
  });
});
