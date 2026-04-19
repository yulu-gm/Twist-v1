/**
 * @file app-shell.test.tsx
 * @description AppShell 组件测试 — 验证空壳占位模式、统一 Inspector 与工作订单看板渲染
 * @part-of ui/app — 应用层
 */

import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

// 每个 test 后清理 DOM，避免相邻测试中的 AppShell 实例互相干扰
afterEach(() => cleanup());

/** 构造一份最小可用的 ports mock — 所有方法为 vi.fn() */
function makePorts() {
  return {
    setSpeed: vi.fn(),
    selectColonist: vi.fn(),
    selectObjects: vi.fn(),
    setTool: vi.fn(),
    jumpCameraTo: vi.fn(),
    dispatchCommand: vi.fn(),
    assignBedOwner: vi.fn(),
    clearBedOwner: vi.fn(),
    pauseWorkOrder: vi.fn(),
    resumeWorkOrder: vi.fn(),
    cancelWorkOrder: vi.fn(),
    reorderWorkOrders: vi.fn(),
    createResultWorkOrder: vi.fn(),
  };
}

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
        commandMenuPath: [],
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
        lastZoneType: 'growing',
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

    const ports = makePorts();

    render(<AppShell snapshot={snapshot} uiState={uiState} dispatch={vi.fn()} ports={ports as any} />);

    // 统一 Object Inspector 应被渲染
    expect(screen.getByTestId('object-inspector')).toBeInTheDocument();
    // Alice 的名称应出现在 Inspector 标题中
    expect(screen.getByTestId('inspector-title').textContent).toBe('Alice');
  });

  it('renders the work order board with an order title from the snapshot', () => {
    // 构造一份包含单个 work order 的快照，验证看板把 title 渲染出来
    const orderNode = {
      id: 'wo_1',
      title: '砍伐 5 棵树',
      orderKind: 'cut',
      sourceKind: 'map' as const,
      status: 'active' as const,
      priorityIndex: 0,
      totalItemCount: 5,
      doneItemCount: 1,
      activeWorkerCount: 2,
      blocked: false,
      items: [
        { id: 'woi_1', status: 'working' as const, currentStage: 'cutting', claimedByPawnId: 'pawn_1', blockedReason: null },
      ],
    };

    const snapshot = {
      tick: 1,
      speed: 1,
      clockDisplay: 'Day 1, 00:00',
      colonistCount: 0,
      presentation: {
        activeTool: 'select',
        activeDesignationType: null,
        activeZoneType: null,
        activeBuildDefId: null,
        commandMenuPath: [],
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
        lastZoneType: 'growing',
        activeBuildDefId: null,
        activeModeLabel: 'Select',
      },
      feedback: { recentEvents: [] },
      workOrders: { list: [orderNode], byId: { wo_1: orderNode } },
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

    const ports = makePorts();

    render(<AppShell snapshot={snapshot} uiState={uiState} dispatch={vi.fn()} ports={ports as any} />);

    // 看板自身已挂载，订单标题可见
    expect(screen.getByTestId('work-order-board')).toBeInTheDocument();
    expect(screen.getByText('砍伐 5 棵树')).toBeInTheDocument();
    // ports 必须包含工作订单相关方法（保证 createLazyPorts 落地完整）
    expect(ports.pauseWorkOrder).toBeTypeOf('function');
    expect(ports.resumeWorkOrder).toBeTypeOf('function');
    expect(ports.cancelWorkOrder).toBeTypeOf('function');
    expect(ports.reorderWorkOrders).toBeTypeOf('function');
    expect(ports.createResultWorkOrder).toBeTypeOf('function');
  });
});
