# Player Work Order Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把玩家工作入口改造成“地图/结果双源开单 + 全局订单排序 + AI 只从订单取活”的统一订单系统，并提供首版订单看板。

**Architecture:** 先在 simulation 层引入独立的 `work-orders` 领域，负责订单、订单项、状态汇总、命令与系统维护；再把地图输入从“直接下裸 designation/blueprint 命令”改为“批量创建地图订单并投影到底图对象”；最后把 AI evaluator、snapshot 与 Preact UI 统一接到订单数据源。结果订单本轮只实现正式模型、命令、排序和阻塞显示，不扩写完整工坊生产链。没有对应执行器的结果订单必须以明确 blocked 原因进入同一调度体系，而不是隐式失效。

**Tech Stack:** TypeScript、Phaser、Preact、Vitest、现有 command bus / tick runner / snapshot-reader / scenario harness

---

## 文件结构与职责

- `src/features/work-orders/work-order.types.ts`
  - 定义 `WorkOrder`、`WorkOrderItem`、状态枚举、来源类型、地图投影引用与汇总字段。
- `src/features/work-orders/work-order.commands.ts`
  - 新增订单命令：创建地图订单、创建结果订单、暂停、继续、取消、排序、软指派。
- `src/features/work-orders/work-order.system.ts`
  - 每 tick 汇总订单状态，处理目标失效、阻塞汇总、完成态收口。
- `src/features/work-orders/work-order.test.ts`
  - 覆盖订单命令与系统行为。
- `src/features/construction/blueprint.types.ts`
  - 给蓝图补订单归属字段。
- `src/features/designation/designation.types.ts`
  - 给 designation 补订单归属字段。
- `src/features/zone/zone.types.ts`
  - 给区域类地图对象补订单归属字段。
- `src/features/construction/construction.commands.ts`
  - 支持“由地图订单创建蓝图并挂接订单项”。
- `src/features/designation/designation.commands.ts`
  - 支持“由地图订单创建 designation 并挂接订单项”。
- `src/features/zone/zone.commands.ts`
  - 支持“由地图订单创建区域并挂接订单项”。
- `src/bootstrap/default-registrations.ts`
  - 注册 `work-order` 命令与系统，替换/补强现有 `designation.workGenerationSystem` 的职责。
- `src/adapter/input/input-handler.ts`
  - 把拖拽/点击的地图工具输出改为订单创建命令，而不是逐个裸命令。
- `src/adapter/input/input-handler.test.ts`
  - 覆盖“单次拖拽只产生一个订单命令”的输入语义。
- `src/features/ai/work-types.ts`
  - 扩展订单相关 failure reason。
- `src/features/ai/work-evaluators/designation.evaluator.ts`
  - 改为从订单项选择砍伐/采集/采矿工作，而不是直接扫描所有 designation。
- `src/features/ai/work-evaluators/construction.evaluator.ts`
  - 改为从订单项选择运料/施工目标，而不是直接扫描所有 blueprint/site。
- `src/features/ai/job-selector.ts`
  - 保持“全局 priority 后再 score”的主流程，但 detail/冻结快照要体现订单上下文。
- `src/features/ai/job-selector.work-order-priority.test.ts`
  - 新增“高优先订单先于低优先订单”的核心测试。
- `src/ui/kernel/ui-types.ts`
  - 扩展订单看板所需的快照类型。
- `src/ui/kernel/snapshot-reader.ts`
  - 把 simulation 中的订单投影为 UI 可读的 `workOrders` 字典与列表。
- `src/ui/kernel/ui-ports.ts`
  - 新增排序、暂停、继续、取消、创建结果订单、软指派等 UI 端口。
- `src/ui/domains/work-orders/work-order.selectors.ts`
  - 把快照投影为看板列表和详情视图模型。
- `src/ui/domains/work-orders/components/work-order-board.tsx`
  - 订单看板主列表。
- `src/ui/domains/work-orders/components/work-order-detail.tsx`
  - 订单详情区。
- `src/ui/domains/work-orders/components/work-order-board.test.tsx`
  - 看板列表/详情/按钮交互测试。
- `src/ui/app/app-shell.tsx`
  - 挂载订单看板。
- `src/ui/app/app-shell.test.tsx`
  - 验证订单看板在主 UI 中挂载。
- `src/testing/scenario-commands/player-commands.ts`
  - 补充脚本期订单命令 helpers。
- `src/testing/scenarios/work-order-map-priority.scenario.ts`
  - 构造“两个地图订单 + 顺序调整 + 小人先做高优先”的 headless 场景。
- `src/testing/headless/work-order-map-priority.scenario.test.ts`
  - 跑首个订单场景回归。

---

### Task 1: 建立 work-order 领域基础类型、命令和状态系统

**Files:**
- Create: `src/features/work-orders/work-order.types.ts`
- Create: `src/features/work-orders/work-order.commands.ts`
- Create: `src/features/work-orders/work-order.system.ts`
- Create: `src/features/work-orders/work-order.test.ts`
- Modify: `src/bootstrap/default-registrations.ts`

- [ ] **Step 1: 先写失败测试，固定订单命令与状态汇总语义**

```ts
import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { registerDefaultCommands } from '../../bootstrap/default-registrations';
import { reconcileWorkOrders } from './work-order.system';

describe('work order commands', () => {
  it('creates one map order with two open items and preserves list order', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    registerDefaultCommands(world);

    world.commandQueue.push({
      type: 'create_map_work_order',
      payload: {
        mapId: map.id,
        orderKind: 'cut',
        title: '砍伐 2 个目标',
        items: [
          { targetRef: { kind: 'object', objectId: 'tree_a' } },
          { targetRef: { kind: 'object', objectId: 'tree_b' } },
        ],
      },
    });
    world.commandBus.processQueue(world);

    const orders = map.workOrders.list();
    expect(orders).toHaveLength(1);
    expect(orders[0].items).toHaveLength(2);
    expect(orders[0].priorityIndex).toBe(0);
    expect(orders[0].status).toBe('pending');
    expect(orders[0].items.every(item => item.status === 'open')).toBe(true);
  });

  it('pauses, resumes and cancels orders through explicit commands', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    registerDefaultCommands(world);

    const order = map.workOrders.createResultOrder({
      orderKind: 'craft',
      title: '制作 5 个木材箱',
      items: [{ id: 'item_1', status: 'open', targetRef: { kind: 'result_batch', batchId: 'batch_1' } }],
    });

    world.commandQueue.push({ type: 'pause_work_order', payload: { mapId: map.id, orderId: order.id } });
    world.commandBus.processQueue(world);
    expect(map.workOrders.get(order.id)?.status).toBe('paused');

    world.commandQueue.push({ type: 'resume_work_order', payload: { mapId: map.id, orderId: order.id } });
    world.commandBus.processQueue(world);
    expect(map.workOrders.get(order.id)?.status).toBe('pending');

    world.commandQueue.push({ type: 'cancel_work_order', payload: { mapId: map.id, orderId: order.id } });
    world.commandBus.processQueue(world);
    expect(map.workOrders.get(order.id)?.status).toBe('cancelled');
  });

  it('reconciles invalid items and marks order done when all items terminate', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const order = map.workOrders.createMapOrder({
      orderKind: 'cut',
      title: '砍伐 1 棵树',
      items: [{
        id: 'woi_1',
        status: 'open',
        targetRef: { kind: 'object', objectId: 'missing_tree' },
      }],
    });

    reconcileWorkOrders(world);

    expect(map.workOrders.get(order.id)?.items[0].status).toBe('invalid');
    expect(map.workOrders.get(order.id)?.status).toBe('done');
  });
});
```

- [ ] **Step 2: 运行新测试，确认先失败**

Run: `npx vitest run src/features/work-orders/work-order.test.ts`
Expected: FAIL，因为 `map.workOrders`、相关命令和 `reconcileWorkOrders` 还不存在。

- [ ] **Step 3: 最小实现订单类型与容器**

```ts
// src/features/work-orders/work-order.types.ts
export type WorkOrderSourceKind = 'map' | 'result';
export type WorkOrderStatus = 'pending' | 'active' | 'paused' | 'done' | 'cancelled';
export type WorkOrderItemStatus = 'open' | 'claimed' | 'working' | 'blocked' | 'done' | 'invalid';

export interface WorkOrderItemTargetRef {
  kind: 'object' | 'cell' | 'area' | 'result_batch';
  objectId?: string;
  cell?: { x: number; y: number };
  cells?: Array<{ x: number; y: number }>;
  batchId?: string;
}

export interface WorkOrderItem {
  id: string;
  status: WorkOrderItemStatus;
  targetRef: WorkOrderItemTargetRef;
  currentStage?: string | null;
  claimedByPawnId?: string | null;
  blockedReason?: string | null;
  progress?: number | null;
}

export interface WorkOrder {
  id: string;
  sourceKind: WorkOrderSourceKind;
  orderKind: string;
  title: string;
  status: WorkOrderStatus;
  priorityIndex: number;
  createdAtTick: number;
  preferredPawnIds: string[];
  items: WorkOrderItem[];
}
```

```ts
// src/features/work-orders/work-order.system.ts
import type { World } from '../../world/world';

export function reconcileWorkOrders(world: World): void {
  for (const [, map] of world.maps) {
    for (const order of map.workOrders.list()) {
      if (order.status === 'paused' || order.status === 'cancelled') continue;

      for (const item of order.items) {
        if (item.status === 'done' || item.status === 'invalid') continue;
        if (item.targetRef.kind === 'object' && item.targetRef.objectId) {
          const target = map.objects.get(item.targetRef.objectId);
          if (!target || target.destroyed) {
            item.status = 'invalid';
            item.blockedReason = 'target_missing';
          }
        }
      }

      const activeItems = order.items.filter(item => !['done', 'invalid'].includes(item.status));
      if (activeItems.length === 0) {
        order.status = 'done';
      }
    }
  }
}
```

- [ ] **Step 4: 实现命令处理器并注册**

```ts
// src/features/work-orders/work-order.commands.ts
export const workOrderCommandHandlers: CommandHandler[] = [
  createMapWorkOrderHandler,
  createResultWorkOrderHandler,
  reorderWorkOrdersHandler,
  pauseWorkOrderHandler,
  resumeWorkOrderHandler,
  cancelWorkOrderHandler,
  assignPreferredPawnHandler,
];
```

```ts
// src/bootstrap/default-registrations.ts
import { workOrderCommandHandlers } from '../features/work-orders/work-order.commands';
import { workOrderSystem } from '../features/work-orders/work-order.system';

systems.push(workOrderSystem);
world.commandBus.registerAll(workOrderCommandHandlers);
```

- [ ] **Step 5: 再跑 work-order 测试**

Run: `npx vitest run src/features/work-orders/work-order.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/features/work-orders src/bootstrap/default-registrations.ts
git commit -m "feat: add work order domain foundation"
```

### Task 2: 把地图输入改成“单次操作直接开地图订单”

**Files:**
- Modify: `src/adapter/input/input-handler.ts`
- Modify: `src/adapter/input/input-handler.test.ts`
- Modify: `src/features/construction/construction.commands.ts`
- Modify: `src/features/construction/blueprint.types.ts`
- Modify: `src/features/designation/designation.commands.ts`
- Modify: `src/features/designation/designation.types.ts`
- Modify: `src/features/zone/zone.commands.ts`

- [ ] **Step 1: 先写输入层失败测试，固定“一次拖拽一张订单命令”**

```ts
it('queues one create_map_work_order command for a drag designation instead of many raw designation commands', () => {
  const scene = createFakeScene();
  const world = createFakeWorld();
  const map = createFakeMap();
  const presentation = createPresentationState();
  applyToolSelection(presentation, { tool: ToolType.Designate, designationType: DesignationType.Cut });

  map.spatial.getAt = ({ x, y }: { x: number; y: number }) => [`tree_${x}_${y}`];
  map.objects.get = (id: string) => ({ id, kind: ObjectKind.Plant, tags: new Set(['tree']), cell: { x: 1, y: 1 } });

  new InputHandler(scene as any, world as any, map as any, presentation);

  const pointerdown = scene.__listeners['pointerdown'][0];
  const pointermove = scene.__listeners['pointermove'][0];
  const pointerup = scene.__listeners['pointerup'][0];

  pointerdown({ leftButtonDown: () => true, rightButtonDown: () => false, x: 32, y: 32 });
  pointermove({ leftButtonDown: () => true, x: 96, y: 96 });
  pointerup({ leftButtonDown: () => false, x: 96, y: 96 });

  expect(world.commandQueue).toHaveLength(1);
  expect(world.commandQueue[0].type).toBe('create_map_work_order');
  expect(world.commandQueue[0].payload.items).toHaveLength(9);
});
```

- [ ] **Step 2: 跑输入测试确认先失败**

Run: `npx vitest run src/adapter/input/input-handler.test.ts`
Expected: FAIL，因为当前仍然按格子 push 多条 `designate_*` / `place_blueprint` / `zone_*` 命令。

- [ ] **Step 3: 在输入层改成批量订单命令**

```ts
// src/adapter/input/input-handler.ts
private queueMapWorkOrder(orderKind: string, title: string, items: Array<Record<string, unknown>>): void {
  if (items.length === 0) return;
  this.world.commandQueue.push({
    type: 'create_map_work_order',
    payload: {
      mapId: this.map.id,
      orderKind,
      title,
      items,
    },
  });
}

private dragDesignate(minX: number, minY: number, maxX: number, maxY: number): void {
  const items: Array<Record<string, unknown>> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = { x, y };
      for (const id of this.map.spatial.getAt(cell)) {
        const obj = this.map.objects.get(id);
        if (obj && obj.kind === ObjectKind.Plant) {
          items.push({ targetRef: { kind: 'object', objectId: id } });
        }
      }
    }
  }
  this.queueMapWorkOrder('cut', `砍伐 ${items.length} 个目标`, items);
}
```

- [ ] **Step 4: 在命令层实现“订单创建底图对象”的投影**

```ts
// src/features/designation/designation.types.ts
export interface Designation extends MapObjectBase {
  // ...
  workOrderId?: string;
  workOrderItemId?: string;
}
```

```ts
// src/features/designation/designation.commands.ts
function createDesignationFromOrderItem(
  mapId: string,
  workOrderId: string,
  workOrderItemId: string,
  designationType: DesignationType,
  targetObjectId?: ObjectId,
  targetCell?: CellCoord,
): Designation {
  return {
    ...createDesignation(mapId, designationType, WorkPriority.Normal, targetObjectId, targetCell),
    workOrderId,
    workOrderItemId,
  };
}
```

```ts
// src/features/construction/blueprint.types.ts
export interface Blueprint extends MapObjectBase {
  // ...
  workOrderId?: string;
  workOrderItemId?: string;
}
```

- [ ] **Step 5: 再跑输入和命令测试**

Run: `npx vitest run src/adapter/input/input-handler.test.ts src/features/work-orders/work-order.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/adapter/input src/features/designation src/features/construction src/features/zone
git commit -m "feat: create map work orders from player input"
```

### Task 3: 补齐订单维护系统、快照序列化与结果订单最小接入口

**Files:**
- Modify: `src/features/work-orders/work-order.system.ts`
- Modify: `src/features/work-orders/work-order.test.ts`
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Create: `src/ui/kernel/snapshot-reader.work-orders.test.ts`

- [ ] **Step 1: 先写 snapshot 失败测试，固定订单在 UI 快照中的结构**

```ts
import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPresentationState } from '../../presentation/presentation-state';
import { readEngineSnapshot } from './snapshot-reader';

describe('readEngineSnapshot work orders', () => {
  it('serializes work orders with summary, workers and blocked state', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    map.workOrders.createResultOrder({
      orderKind: 'craft',
      title: '制作 2 个木箱',
      items: [{
        id: 'woi_1',
        status: 'blocked',
        targetRef: { kind: 'result_batch', batchId: 'batch_1' },
        blockedReason: 'no_executor',
      }],
    });

    const snapshot = readEngineSnapshot(world, map, createPresentationState(), { recentEvents: [] });
    expect(snapshot.workOrders.list).toHaveLength(1);
    expect(snapshot.workOrders.list[0]).toMatchObject({
      title: '制作 2 个木箱',
      sourceKind: 'result',
      blocked: true,
    });
  });
});
```

- [ ] **Step 2: 跑快照测试确认先失败**

Run: `npx vitest run src/ui/kernel/snapshot-reader.work-orders.test.ts`
Expected: FAIL，因为 `EngineSnapshot` 还没有 `workOrders` 字段。

- [ ] **Step 3: 扩展 UI 快照类型**

```ts
// src/ui/kernel/ui-types.ts
export interface WorkOrderItemNode {
  id: string;
  status: string;
  currentStage: string | null;
  blockedReason: string | null;
  claimedByPawnId: string | null;
}

export interface WorkOrderNode {
  id: string;
  sourceKind: 'map' | 'result';
  orderKind: string;
  title: string;
  status: string;
  priorityIndex: number;
  totalItemCount: number;
  doneItemCount: number;
  activeWorkerCount: number;
  blocked: boolean;
  items: WorkOrderItemNode[];
}

export interface WorkOrdersSnapshot {
  list: WorkOrderNode[];
  byId: Record<string, WorkOrderNode>;
}

export interface EngineSnapshot {
  // ...
  workOrders: WorkOrdersSnapshot;
}
```

- [ ] **Step 4: 在 snapshot-reader 和系统里补汇总与结果订单 blocked 原因**

```ts
// src/features/work-orders/work-order.system.ts
if (order.sourceKind === 'result' && order.items.every(item => item.status === 'open')) {
  for (const item of order.items) {
    item.status = 'blocked';
    item.blockedReason = 'no_executor';
  }
}
```

```ts
// src/ui/kernel/snapshot-reader.ts
const workOrderList = map.workOrders.list()
  .slice()
  .sort((a, b) => a.priorityIndex - b.priorityIndex)
  .map(order => ({
    id: order.id,
    sourceKind: order.sourceKind,
    orderKind: order.orderKind,
    title: order.title,
    status: order.status,
    priorityIndex: order.priorityIndex,
    totalItemCount: order.items.length,
    doneItemCount: order.items.filter(item => item.status === 'done').length,
    activeWorkerCount: new Set(order.items.map(item => item.claimedByPawnId).filter(Boolean)).size,
    blocked: order.items.every(item => ['blocked', 'invalid', 'done'].includes(item.status)),
    items: order.items.map(item => ({
      id: item.id,
      status: item.status,
      currentStage: item.currentStage ?? null,
      blockedReason: item.blockedReason ?? null,
      claimedByPawnId: item.claimedByPawnId ?? null,
    })),
  }));
```

- [ ] **Step 5: 再跑 work-order 与 snapshot 测试**

Run: `npx vitest run src/features/work-orders/work-order.test.ts src/ui/kernel/snapshot-reader.work-orders.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/features/work-orders src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/kernel/snapshot-reader.work-orders.test.ts
git commit -m "feat: expose work orders to UI snapshot"
```

### Task 4: 把 AI evaluator 切换到“只从订单项取活”

**Files:**
- Modify: `src/features/ai/work-types.ts`
- Modify: `src/features/ai/work-evaluators/designation.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/construction.evaluator.ts`
- Modify: `src/features/ai/job-selector.ts`
- Create: `src/features/ai/job-selector.work-order-priority.test.ts`
- Modify: `src/features/ai/job-selector.work-decision.test.ts`

- [ ] **Step 1: 先写失败测试，固定“高优先订单先于低优先订单”**

```ts
import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createPlant } from '../plant/plant.factory';
import { jobSelectionSystem } from './job-selector';

describe('job selector work order priority', () => {
  it('selects the higher-priority cut order before a lower-priority one', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({ name: 'Alice', cell: { x: 1, y: 1 }, mapId: map.id, factionId: 'player', rng: world.rng });
    map.objects.add(pawn);

    const nearTree = createPlant({ defId: 'tree_oak', cell: { x: 8, y: 8 }, mapId: map.id, defs, growthProgress: 1 });
    const farTree = createPlant({ defId: 'tree_oak', cell: { x: 2, y: 1 }, mapId: map.id, defs, growthProgress: 1 });
    map.objects.add(nearTree);
    map.objects.add(farTree);

    const high = map.workOrders.createMapOrder({
      orderKind: 'cut',
      title: '高优先砍树',
      priorityIndex: 0,
      items: [{ id: 'high_1', status: 'open', targetRef: { kind: 'object', objectId: nearTree.id } }],
    });
    const low = map.workOrders.createMapOrder({
      orderKind: 'cut',
      title: '低优先砍树',
      priorityIndex: 1,
      items: [{ id: 'low_1', status: 'open', targetRef: { kind: 'object', objectId: farTree.id } }],
    });

    void low;
    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.targetId).toBe(nearTree.id);
    expect(map.workOrders.get(high.id)?.items[0].claimedByPawnId).toBe(pawn.id);
  });
});
```

- [ ] **Step 2: 跑 AI 测试确认先失败**

Run: `npx vitest run src/features/ai/job-selector.work-order-priority.test.ts`
Expected: FAIL，因为 evaluator 还在直接扫 `Designation` / `Blueprint`。

- [ ] **Step 3: 扩展失败原因码并改 evaluator 入口**

```ts
// src/features/ai/work-types.ts
export type WorkFailureReasonCode =
  | 'none'
  | 'no_target'
  | 'target_reserved'
  | 'target_unreachable'
  | 'need_not_triggered'
  | 'no_stockpile_destination'
  | 'materials_not_delivered'
  | 'carrying_conflict'
  | 'no_available_bed'
  | 'no_reachable_material_source'
  | 'order_paused'
  | 'order_cancelled'
  | 'no_order_executor';
```

```ts
// src/features/ai/work-evaluators/designation.evaluator.ts
const candidateItems = map.workOrders
  .list()
  .filter(order => order.status !== 'paused' && order.status !== 'cancelled')
  .sort((a, b) => a.priorityIndex - b.priorityIndex)
  .flatMap(order => order.items.map(item => ({ order, item })))
  .filter(({ order, item }) => order.orderKind === 'cut' && item.status === 'open');
```

- [ ] **Step 4: 在 assignment 成功时回写订单项 claimed 状态**

```ts
// src/features/ai/job-selector.ts
function assignJob(pawn: Pawn, job: Job, world: World): void {
  pawn.ai.currentJob = job;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.ai.idleTicks = 0;

  const workOrderId = (job as Job & { workOrderId?: string }).workOrderId;
  const workOrderItemId = (job as Job & { workOrderItemId?: string }).workOrderItemId;
  if (workOrderId && workOrderItemId) {
    for (const [, map] of world.maps) {
      const order = map.workOrders.get(workOrderId);
      const item = order?.items.find(entry => entry.id === workOrderItemId);
      if (item) {
        item.status = 'claimed';
        item.claimedByPawnId = pawn.id;
        item.currentStage = 'claimed';
      }
    }
  }

  world.eventBuffer.push({
    type: 'job_assigned',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });
}
```

- [ ] **Step 5: 再跑 AI 相关测试**

Run: `npx vitest run src/features/ai/job-selector.work-order-priority.test.ts src/features/ai/job-selector.work-decision.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/features/ai
git commit -m "feat: drive job selection from work orders"
```

### Task 5: 新增订单看板 UI，并把操作接回命令端口

**Files:**
- Modify: `src/ui/kernel/ui-ports.ts`
- Modify: `src/main.ts`
- Create: `src/ui/domains/work-orders/work-order.selectors.ts`
- Create: `src/ui/domains/work-orders/components/work-order-board.tsx`
- Create: `src/ui/domains/work-orders/components/work-order-detail.tsx`
- Create: `src/ui/domains/work-orders/components/work-order-board.test.tsx`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/app/app-shell.test.tsx`

- [ ] **Step 1: 先写看板组件失败测试**

```tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { WorkOrderBoard } from './work-order-board';

describe('WorkOrderBoard', () => {
  it('renders rows and dispatches pause / cancel actions', () => {
    const onPause = vi.fn();
    const onCancel = vi.fn();

    render(
      <WorkOrderBoard
        rows={[{
          id: 'wo_1',
          title: '砍伐 5 棵树',
          sourceKind: 'map',
          priorityIndex: 0,
          progressLabel: '0 / 5',
          activeWorkerLabel: '2 人',
          blocked: false,
        }]}
        selectedOrderId="wo_1"
        onSelect={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onCancel={onCancel}
        detail={{
          id: 'wo_1',
          title: '砍伐 5 棵树',
          items: [{ id: 'woi_1', status: 'working', blockedReason: null, currentStage: 'cutting', claimedByPawnId: 'pawn_1' }],
        }}
      />,
    );

    expect(screen.getByText('砍伐 5 棵树')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onPause).toHaveBeenCalledWith('wo_1');
    expect(onCancel).toHaveBeenCalledWith('wo_1');
  });
});
```

- [ ] **Step 2: 跑 UI 测试确认先失败**

Run: `npx vitest run src/ui/domains/work-orders/components/work-order-board.test.tsx`
Expected: FAIL，因为相关 selector、组件和 `UiPorts` 还不存在。

- [ ] **Step 3: 扩展 UiPorts 与主入口实现**

```ts
// src/ui/kernel/ui-ports.ts
export interface UiPorts {
  dispatchCommand(command: Command): void;
  setSpeed(speed: number): void;
  selectObjects(ids: ObjectId[]): void;
  selectColonist(id: string): void;
  setTool(tool: string, designationType?: string | null, buildDefId?: string | null, zoneType?: string | null): void;
  jumpCameraTo(cell: { x: number; y: number }): void;
  assignBedOwner(bedId: string, pawnId: string): void;
  clearBedOwner(bedId: string): void;
  pauseWorkOrder(orderId: string): void;
  resumeWorkOrder(orderId: string): void;
  cancelWorkOrder(orderId: string): void;
  reorderWorkOrders(orderIds: string[]): void;
  createResultWorkOrder(payload: { orderKind: string; title: string; items: Array<Record<string, unknown>> }): void;
}
```

```ts
// src/main.ts
pauseWorkOrder(orderId: string) {
  world.commandQueue.push({ type: 'pause_work_order', payload: { mapId: 'main', orderId } });
},
resumeWorkOrder(orderId: string) {
  world.commandQueue.push({ type: 'resume_work_order', payload: { mapId: 'main', orderId } });
},
cancelWorkOrder(orderId: string) {
  world.commandQueue.push({ type: 'cancel_work_order', payload: { mapId: 'main', orderId } });
},
reorderWorkOrders(orderIds: string[]) {
  world.commandQueue.push({ type: 'reorder_work_orders', payload: { mapId: 'main', orderIds } });
},
createResultWorkOrder(payload) {
  world.commandQueue.push({ type: 'create_result_work_order', payload: { mapId: 'main', ...payload } });
},
```

- [ ] **Step 4: 实现看板 selector 与组件，并挂到 AppShell**

```tsx
// src/ui/app/app-shell.tsx
import { selectWorkOrderBoard } from '../domains/work-orders/work-order.selectors';
import { WorkOrderBoard } from '../domains/work-orders/components/work-order-board';

const workOrderBoard = selectWorkOrderBoard(snapshot, uiState);

<WorkOrderBoard
  rows={workOrderBoard.rows}
  selectedOrderId={workOrderBoard.selectedOrderId}
  detail={workOrderBoard.detail}
  onSelect={(orderId) => dispatch({ type: 'set_inspector_target', targetId: orderId })}
  onPause={(orderId) => ports.pauseWorkOrder(orderId)}
  onResume={(orderId) => ports.resumeWorkOrder(orderId)}
  onCancel={(orderId) => ports.cancelWorkOrder(orderId)}
/>;
```

- [ ] **Step 5: 再跑 UI 相关测试**

Run: `npx vitest run src/ui/domains/work-orders/components/work-order-board.test.tsx src/ui/app/app-shell.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/ui/kernel/ui-ports.ts src/main.ts src/ui/domains/work-orders src/ui/app/app-shell.tsx src/ui/app/app-shell.test.tsx
git commit -m "feat: add work order board UI"
```

### Task 6: 补结果订单创建入口与 headless 回归场景

**Files:**
- Modify: `src/testing/scenario-commands/player-commands.ts`
- Create: `src/testing/scenarios/work-order-map-priority.scenario.ts`
- Create: `src/testing/headless/work-order-map-priority.scenario.test.ts`
- Modify: `src/testing/scenario-registry.ts`

- [ ] **Step 1: 先写 headless 场景测试**

```ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from './headless-scenario-runner';
import { workOrderMapPriorityScenario } from '../scenarios/work-order-map-priority.scenario';

describe('work-order-map-priority scenario', () => {
  it('executes the higher-priority order before the lower one', async () => {
    const result = await runHeadlessScenario(workOrderMapPriorityScenario);
    expect(result.finalSnapshot.workOrders.list[0].title).toBe('高优先砍树');
    expect(result.events.some(event => event.type === 'job_assigned')).toBe(true);
    expect(result.finalSnapshot.workOrders.byId['high_cut'].doneItemCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行 headless 场景测试，确认先失败**

Run: `npx vitest run src/testing/headless/work-order-map-priority.scenario.test.ts`
Expected: FAIL，因为场景、registry 和 snapshot 断言对象还未接好。

- [ ] **Step 3: 添加场景脚本 helpers**

```ts
// src/testing/scenario-commands/player-commands.ts
export function createResultWorkOrderCommand(orderKind: string, title: string): CommandStep {
  return createCommandStep(`创建结果订单：${title}`, ({ issueCommand, stepTicks }) => {
    issueCommand({
      type: 'create_result_work_order',
      payload: {
        mapId: 'scenario',
        orderKind,
        title,
        items: [{ targetRef: { kind: 'result_batch', batchId: `${orderKind}_batch_1` } }],
      },
    });
    stepTicks(1);
  });
}
```

```ts
// src/testing/scenarios/work-order-map-priority.scenario.ts
export const workOrderMapPriorityScenario = defineScenario({
  id: 'work-order-map-priority',
  name: 'work-order-map-priority',
  steps: [
    spawnDefaultColonist(),
    createCutOrderCommand('high_cut', [{ x: 6, y: 6 }], 0),
    createCutOrderCommand('low_cut', [{ x: 2, y: 2 }], 1),
    advanceTicksStep(200),
    checkpointStep('after-priority-check'),
  ],
});
```

- [ ] **Step 4: 再跑 headless 场景测试**

Run: `npx vitest run src/testing/headless/work-order-map-priority.scenario.test.ts`
Expected: PASS。

- [ ] **Step 5: 跑本轮关键回归**

Run: `npx vitest run src/features/work-orders/work-order.test.ts src/adapter/input/input-handler.test.ts src/features/ai/job-selector.work-order-priority.test.ts src/ui/domains/work-orders/components/work-order-board.test.tsx src/testing/headless/work-order-map-priority.scenario.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/testing/scenario-commands/player-commands.ts src/testing/scenarios/work-order-map-priority.scenario.ts src/testing/headless/work-order-map-priority.scenario.test.ts src/testing/scenario-registry.ts
git commit -m "test: add work order priority scenario"
```

### Task 7: 全量类型检查与现有回归验证

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-player-work-order-command-design.md`（仅当实现与 spec 文案有必要同步时）
- Modify: `docs/superpowers/plans/2026-04-17-player-work-order-command.md`（勾选执行记录时）

- [ ] **Step 1: 跑订单相关 Vitest 集合**

Run: `npx vitest run src/features/work-orders/work-order.test.ts src/adapter/input/input-handler.test.ts src/features/ai/job-selector.work-order-priority.test.ts src/ui/domains/work-orders/components/work-order-board.test.tsx src/testing/headless/work-order-map-priority.scenario.test.ts`
Expected: PASS。

- [ ] **Step 2: 跑现有关键 AI/建造回归**

Run: `npx vitest run src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.construction.test.ts src/testing/headless/woodcutting.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts`
Expected: PASS。

- [ ] **Step 3: 跑 TypeScript 全量检查**

Run: `npx tsc --noEmit`
Expected: PASS。

- [ ] **Step 4: 如实现导致 spec 术语变动，补文档并提交收尾**

```bash
git add src docs/superpowers/specs/2026-04-17-player-work-order-command-design.md docs/superpowers/plans/2026-04-17-player-work-order-command.md
git commit -m "feat: ship player work order command flow"
```

---

## 自检结论

- Spec coverage:
  - 订单基础模型、状态机、暂停/取消/排序：Task 1
  - 地图操作直接成单：Task 2
  - 结果订单进入统一列表并显示阻塞：Task 3
  - AI 只从订单取活、绝对优先级：Task 4
  - 统一订单看板与详情：Task 5
  - headless 回归与玩家可感知验证：Task 6、Task 7

- Placeholder scan:
  - 未保留 `TODO` / `TBD` / “后续实现”式占位。
  - 结果订单范围已明确压到“正式模型 + 统一列表 + blocked 显示”，避免计划与现状脱节。

- Type consistency:
  - 统一使用 `WorkOrder` / `WorkOrderItem` / `create_map_work_order` / `create_result_work_order` 命名。
  - UI 快照统一使用 `snapshot.workOrders.list` 与 `snapshot.workOrders.byId`。
