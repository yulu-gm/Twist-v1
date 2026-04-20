import { describe, expect, it } from 'vitest';
import { InputHandler } from './input-handler';
import {
  createPresentationState,
  applyToolSelection,
  ToolType,
} from '../../presentation/presentation-state';
import { DesignationType, ObjectKind, ZoneType, cellKey } from '../../core/types';

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

function createFakeWorld(opts: { mineableTerrains?: string[] } = {}) {
  const terrains = new Map<string, any>();
  // 默认所有地形不可挖；测试可注入可挖地形
  terrains.set('grass', { mineable: false });
  for (const t of opts.mineableTerrains ?? []) {
    terrains.set(t, { mineable: true });
  }
  return {
    commandQueue: [] as any[],
    defs: {
      buildings: new Map(),
      terrains,
    },
  };
}

/**
 * 创建可注入对象/地形/区域的 fake map。
 * - objectsByCell: 格子 -> 对象数组（每个对象需有 id/kind/tags 等）
 * - terrainByCell: 格子 -> 地形 defId（默认 'grass'）
 * - zonesByCell: 格子 -> 区域 ID（用于 zone-erase / cancel 流程）
 */
function createFakeMap(opts: {
  width?: number;
  height?: number;
  objectsByCell?: Record<string, any[]>;
  terrainByCell?: Record<string, string>;
  zonesByCell?: Record<string, { id: string; zoneType: ZoneType }>;
} = {}) {
  const width = opts.width ?? 80;
  const height = opts.height ?? 80;
  const objectsByCell = opts.objectsByCell ?? {};
  const terrainByCell = opts.terrainByCell ?? {};
  const zonesByCell = opts.zonesByCell ?? {};

  // 反查 id -> object
  const objectsById = new Map<string, any>();
  for (const arr of Object.values(objectsByCell)) {
    for (const o of arr) objectsById.set(o.id, o);
  }

  return {
    id: 'main',
    width,
    height,
    spatial: {
      getAt(cell: { x: number; y: number }) {
        const arr = objectsByCell[cellKey(cell)] ?? [];
        return arr.map((o) => o.id);
      },
      isPassable() { return true; },
      getInRect() { return []; },
    },
    terrain: {
      get(x: number, y: number) {
        return terrainByCell[cellKey({ x, y })] ?? 'grass';
      },
      inBounds() { return true; },
    },
    zones: {
      getZoneAt(key: string) {
        return zonesByCell[key] ?? null;
      },
    },
    objects: {
      get(id: string) { return objectsById.get(id) ?? null; },
    },
  };
}

/** 模拟一次拖拽：pointerdown -> pointermove(超阈值) -> pointerup */
function simulateDrag(
  scene: ReturnType<typeof createFakeScene>,
  startScreenPos: { x: number; y: number },
  endScreenPos: { x: number; y: number },
) {
  const down = scene.__listeners['pointerdown'][0];
  const move = scene.__listeners['pointermove'][0];
  const up = scene.__listeners['pointerup'][0];

  down({
    button: 0,
    rightButtonDown: () => false,
    leftButtonDown: () => true,
    x: startScreenPos.x,
    y: startScreenPos.y,
  });
  move({
    button: 0,
    rightButtonDown: () => false,
    leftButtonDown: () => true,
    x: endScreenPos.x,
    y: endScreenPos.y,
  });
  up({
    button: 0,
    rightButtonDown: () => false,
    leftButtonDown: () => false,
    x: endScreenPos.x,
    y: endScreenPos.y,
  });
}

/** 模拟一次单击（pointerdown 后立即 pointerup，移动距离不足阈值） */
function simulateClick(
  scene: ReturnType<typeof createFakeScene>,
  screenPos: { x: number; y: number },
) {
  const down = scene.__listeners['pointerdown'][0];
  const up = scene.__listeners['pointerup'][0];
  down({
    button: 0,
    rightButtonDown: () => false,
    leftButtonDown: () => true,
    x: screenPos.x,
    y: screenPos.y,
  });
  up({
    button: 0,
    rightButtonDown: () => false,
    leftButtonDown: () => false,
    x: screenPos.x,
    y: screenPos.y,
  });
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

describe('InputHandler emits create_map_work_order per drag/click', () => {
  // 像素 -> 格子：每格 32px，scene.cameras.main.getWorldPoint(x,y) = {x,y}
  // 故 (x,y) px → 格子 (Math.floor(x/32), Math.floor(y/32))

  it('drag-cut: emits one create_map_work_order with items for each tree in rect', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Designate,
      designationType: DesignationType.Cut,
    });

    // 在 (1,1)、(2,2)、(3,3) 各放一棵树；(2,1) 放一棵非树植物
    const tree = (id: string) => ({
      id, kind: ObjectKind.Plant, tags: new Set(['tree']),
    });
    const map = createFakeMap({
      objectsByCell: {
        [cellKey({ x: 1, y: 1 })]: [tree('t1')],
        [cellKey({ x: 2, y: 2 })]: [tree('t2')],
        [cellKey({ x: 3, y: 3 })]: [tree('t3')],
        [cellKey({ x: 2, y: 1 })]: [{
          id: 'p1', kind: ObjectKind.Plant, tags: new Set(),
        }],
      },
    });
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    // 拖拽 (32,32)→(127,127) → 格子矩形 (1,1)..(3,3)
    simulateDrag(scene, { x: 32, y: 32 }, { x: 127, y: 127 });

    expect(world.commandQueue).toHaveLength(1);
    const cmd = world.commandQueue[0];
    expect(cmd.type).toBe('create_map_work_order');
    expect(cmd.payload.mapId).toBe('main');
    expect(cmd.payload.orderKind).toBe('cut');
    expect(cmd.payload.items).toHaveLength(3);
    for (const item of cmd.payload.items) {
      expect(item.targetRef.kind).toBe('object');
      expect(['t1', 't2', 't3']).toContain(item.targetRef.objectId);
    }
  });

  it('drag-mine: emits one order with cell items for mineable terrain', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Designate,
      designationType: DesignationType.Mine,
    });

    // 在 2x2 矩形内：(1,1)、(2,1) 是 stone（可挖），(1,2)、(2,2) 是 grass（不可挖）
    const map = createFakeMap({
      terrainByCell: {
        [cellKey({ x: 1, y: 1 })]: 'stone',
        [cellKey({ x: 2, y: 1 })]: 'stone',
      },
    });
    const world = createFakeWorld({ mineableTerrains: ['stone'] });

    new InputHandler(scene as any, world as any, map as any, presentation);

    simulateDrag(scene, { x: 32, y: 32 }, { x: 95, y: 95 });

    expect(world.commandQueue).toHaveLength(1);
    const cmd = world.commandQueue[0];
    expect(cmd.type).toBe('create_map_work_order');
    expect(cmd.payload.orderKind).toBe('mine');
    expect(cmd.payload.items).toHaveLength(2);
    for (const item of cmd.payload.items) {
      expect(item.targetRef.kind).toBe('cell');
      expect(item.targetRef.cell).toBeDefined();
    }
  });

  it('drag-harvest: emits one order with object items per plant in rect', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Designate,
      designationType: DesignationType.Harvest,
    });

    const plant = (id: string) => ({ id, kind: ObjectKind.Plant, tags: new Set() });
    const map = createFakeMap({
      objectsByCell: {
        [cellKey({ x: 1, y: 1 })]: [plant('p1')],
        [cellKey({ x: 2, y: 2 })]: [plant('p2')],
      },
    });
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    simulateDrag(scene, { x: 32, y: 32 }, { x: 95, y: 95 });

    expect(world.commandQueue).toHaveLength(1);
    const cmd = world.commandQueue[0];
    expect(cmd.type).toBe('create_map_work_order');
    expect(cmd.payload.orderKind).toBe('harvest');
    expect(cmd.payload.items).toHaveLength(2);
    for (const item of cmd.payload.items) {
      expect(item.targetRef.kind).toBe('object');
    }
  });

  it('drag-build: emits one order with cell items each carrying defId on targetRef', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Build,
      buildDefId: 'bed_wood',
    });

    const map = createFakeMap();
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    // 1x2 矩形 → 2 个格子
    simulateDrag(scene, { x: 32, y: 32 }, { x: 32, y: 95 });

    expect(world.commandQueue).toHaveLength(1);
    const cmd = world.commandQueue[0];
    expect(cmd.type).toBe('create_map_work_order');
    expect(cmd.payload.orderKind).toBe('build');
    expect(cmd.payload.items).toHaveLength(2);
    for (const item of cmd.payload.items) {
      expect(item.targetRef.kind).toBe('cell');
      expect(item.targetRef.cell).toBeDefined();
      expect(item.targetRef.defId).toBe('bed_wood');
    }
  });

  it('drag-zone-create: emits one create_map_work_order, no zone_set_cells', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Zone,
      zoneType: ZoneType.Growing,
    });

    const map = createFakeMap();
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    simulateDrag(scene, { x: 32, y: 32 }, { x: 95, y: 95 });

    // 必须只有 1 个 create_map_work_order，且没有任何 zone_set_cells
    const types = world.commandQueue.map((c: any) => c.type);
    expect(types).toEqual(['create_map_work_order']);
    const cmd = world.commandQueue[0];
    expect(cmd.payload.orderKind).toBe('zone_create');
    expect(cmd.payload.items).toHaveLength(1);
    const item = cmd.payload.items[0];
    expect(item.targetRef.kind).toBe('area');
    expect(Array.isArray(item.targetRef.cells)).toBe(true);
    expect(item.targetRef.cells.length).toBeGreaterThan(0);
    expect(item.targetRef.zoneType).toBe(ZoneType.Growing);
  });

  it('drag-cancel: splits into one order per cancel kind, no raw cancel/zone commands', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, { tool: ToolType.Cancel });

    // (1,1) 是已存在的 designation；(2,2) 是 blueprint；(3,3) 是 zone 格子
    const map = createFakeMap({
      objectsByCell: {
        [cellKey({ x: 1, y: 1 })]: [{ id: 'd1', kind: ObjectKind.Designation, tags: new Set() }],
        [cellKey({ x: 2, y: 2 })]: [{ id: 'b1', kind: ObjectKind.Blueprint, tags: new Set() }],
      },
      zonesByCell: {
        [cellKey({ x: 3, y: 3 })]: { id: 'z1', zoneType: ZoneType.Growing },
      },
    });
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    simulateDrag(scene, { x: 32, y: 32 }, { x: 127, y: 127 });

    // 不允许任何原始低层命令
    for (const c of world.commandQueue) {
      expect(c.type).toBe('create_map_work_order');
      expect(['cancel_designation', 'cancel_construction', 'cancel_zone']).toContain(c.payload.orderKind);
    }
    const kinds = world.commandQueue.map((c: any) => c.payload.orderKind).sort();
    expect(kinds).toEqual(['cancel_construction', 'cancel_designation', 'cancel_zone']);

    // designation cancel 携带对象 ID
    const desigCmd = world.commandQueue.find((c: any) => c.payload.orderKind === 'cancel_designation');
    expect(desigCmd.payload.items.length).toBe(1);
    expect(desigCmd.payload.items[0].targetRef.kind).toBe('object');
    expect(desigCmd.payload.items[0].targetRef.objectId).toBe('d1');

    // construction cancel
    const constrCmd = world.commandQueue.find((c: any) => c.payload.orderKind === 'cancel_construction');
    expect(constrCmd.payload.items[0].targetRef.objectId).toBe('b1');

    // zone cancel：area 格子
    const zoneCmd = world.commandQueue.find((c: any) => c.payload.orderKind === 'cancel_zone');
    expect(zoneCmd.payload.items[0].targetRef.kind).toBe('area');
    expect(Array.isArray(zoneCmd.payload.items[0].targetRef.cells)).toBe(true);
  });

  it('single click cut on a tree: emits one order with one item', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Designate,
      designationType: DesignationType.Cut,
    });

    const map = createFakeMap({
      objectsByCell: {
        [cellKey({ x: 1, y: 1 })]: [{ id: 't1', kind: ObjectKind.Plant, tags: new Set(['tree']) }],
      },
    });
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    simulateClick(scene, { x: 33, y: 33 });

    expect(world.commandQueue).toHaveLength(1);
    const cmd = world.commandQueue[0];
    expect(cmd.type).toBe('create_map_work_order');
    expect(cmd.payload.orderKind).toBe('cut');
    expect(cmd.payload.items).toHaveLength(1);
    expect(cmd.payload.items[0].targetRef.objectId).toBe('t1');
  });

  it('single click on empty cell with cut tool: emits no command', () => {
    const scene = createFakeScene();
    const presentation = createPresentationState();
    applyToolSelection(presentation, {
      tool: ToolType.Designate,
      designationType: DesignationType.Cut,
    });

    const map = createFakeMap();
    const world = createFakeWorld();

    new InputHandler(scene as any, world as any, map as any, presentation);

    simulateClick(scene, { x: 33, y: 33 });
    expect(world.commandQueue).toHaveLength(0);
  });
});
