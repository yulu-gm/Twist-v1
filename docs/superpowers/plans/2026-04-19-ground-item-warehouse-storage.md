# Ground Item 仓库存储重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用仓库建筑替代 `stockpile zone` 作为唯一正式库存，并让所有材料型工作统一从仓库取材，同时落地仓库专属 Inspector。

**Architecture:** 本次重构分三层推进。第一层把仓库建筑升级为真正的抽象库存容器，并新增 `features/storage` 负责容量、入库、出库和库存摘要。第二层把 AI 链路拆成“地面物资入仓”和“从仓库取材后交付工作目标”两条明确路径，彻底切断正式工作对 `stockpile` 和地面物资的依赖。第三层继续复用统一 Inspector 外壳，但给仓库建筑注入一个功能区在上、库存区固定在底部的重功能面板。

**Tech Stack:** TypeScript, Vite, Phaser, Preact, Vitest

---

## File Structure

**Create**

- `src/features/storage/storage.service.ts`
  - 仓库存储领域服务，负责可接收判断、容量计算、入库、出库、摘要排序。
- `src/features/storage/storage.service.test.ts`
  - 仓库存储服务单元测试。
- `src/features/ai/jobs/storage-job.ts`
  - 仓库专用 Job 工厂，负责生成“入库”和“取材”两类 Job。
- `src/features/ai/toil-handlers/store-in-storage.handler.ts`
  - 入库 Toil handler。
- `src/features/ai/toil-handlers/take-from-storage.handler.ts`
  - 从仓库取材 Toil handler。
- `src/testing/scenarios/warehouse-storage-haul.scenario.ts`
  - 新版“地面物资入仓”场景。
- `src/testing/headless/warehouse-storage-haul.scenario.test.ts`
  - 上述场景的 headless 回归测试。

**Modify**

- `src/world/def-database.ts`
  - 将 `storageConfig` 改成仓库容量配置。
- `src/defs/buildings.ts`
  - 删除 `stockpile_zone_marker`，新增真实仓库建筑。
- `src/features/building/building.types.ts`
  - 将 `building.storage` 改为抽象库存容器。
- `src/features/building/building.factory.ts`
  - 初始化仓库库存组件和交互点。
- `src/features/building/building.factory.test.ts`
  - 覆盖仓库 building 初始化。
- `src/features/save/save.commands.ts`
  - 序列化与反序列化仓库库存。
- `src/features/save/save.commands.test.ts`
  - 覆盖仓库库存存档回读。
- `src/core/types.ts`
  - 新增仓库相关 `ToilType`，删除 `ZoneType.Stockpile`。
- `src/features/zone/zone.types.ts`
  - 移除 `stockpile` 相关类型导出。
- `src/world/zone-manager.ts`
  - 删除 `stockpile` 默认配置与归一化逻辑。
- `src/features/item/item.types.ts`
  - 删除 `stockpile-only` 搜索语义。
- `src/features/item/item.queries.ts`
  - 清理 `stockpile` 依赖，仅保留地面落点逻辑。
- `src/features/ai/work-types.ts`
  - 将 `no_stockpile_destination` 替换为 `no_storage_destination`，补充 `no_storage_source`。
- `src/features/ai/work-evaluators/hauling.evaluator.ts`
  - 将 `haul_to_stockpile` 改为 `haul_to_storage`。
- `src/features/ai/work-evaluators/construction.evaluator.ts`
  - 将材料来源从地面 item 改为仓库库存。
- `src/features/ai/work-evaluators/carrying.evaluator.ts`
  - 让携带中物资优先送蓝图，否则送仓库。
- `src/features/ai/work-evaluators/blueprint-inflight.ts`
  - 让在途材料统计理解仓库取材链路。
- `src/features/ai/work-evaluators/index.ts`
  - 注册新的搬运 evaluator。
- `src/features/ai/jobs/haul-job.ts`
  - 保留“地面 item -> 蓝图”语义，不再承担正式入库。
- `src/features/ai/jobs/carry-job.ts`
  - 改成“手持物 -> 蓝图”或“手持物 -> 仓库”。
- `src/features/ai/toil-executor.ts`
  - 注册 `store_in_storage` 和 `take_from_storage`。
- `src/features/ai/toil-handlers/drop.handler.ts`
  - 仅保留临时落地和清理用途。
- `src/features/ai/toil-handlers/deliver.handler.ts`
  - 只负责向蓝图交付材料。
- `src/features/ai/deliver.handler.construction.test.ts`
  - 覆盖“仓库取材后交付蓝图”。
- `src/features/ai/work-evaluators/evaluators.test.ts`
  - 更新为 `haul_to_storage`。
- `src/features/ai/job-selector.work-decision.test.ts`
  - 更新工作命名与选项来源。
- `src/features/ai/job-selector.reachability.test.ts`
  - 用仓库交互点替代 stockpile 目标。
- `src/features/ai/job-selector.carrying.test.ts`
  - 把归还目标改成仓库。
- `src/features/ai/job-selector.work-reasons.test.ts`
  - 验证“地上有料但未入库”时正式材料工作被阻塞。
- `src/features/ai/reservation-lifecycle.test.ts`
  - 覆盖仓库目标 reservation 生命周期。
- `src/testing/scenarios/blueprint-construction.scenario.ts`
  - 改成“地上物先入仓，再从仓库取材施工”的完整链路。
- `src/testing/headless/blueprint-construction.scenario.test.ts`
  - 更新场景标题和断言。
- `src/testing/scenario-registry.ts`
  - 删除 `stockpile` 场景，注册仓库场景。
- `src/testing/headless/scenario-regression.test.ts`
  - 承接新的场景表。
- `src/ui/domains/build/command-menu.ts`
  - 删除 `zone_stockpile`，新增 `build_warehouse`。
- `src/ui/domains/build/command-menu.test.ts`
  - 更新建造菜单断言。
- `src/ui/kernel/ui-types.ts`
  - 给 building 快照增加仓库库存摘要。
- `src/ui/kernel/snapshot-reader.ts`
  - 把仓库库存投影到 UI 快照。
- `src/ui/kernel/snapshot-reader.test.ts`
  - 覆盖仓库快照字段。
- `src/ui/domains/inspector/inspector.types.ts`
  - 增加仓库库存视图模型。
- `src/ui/domains/inspector/adapters/building-inspector.adapter.tsx`
  - 为仓库 building 输出重功能 Inspector。
- `src/ui/domains/inspector/inspector.selectors.test.ts`
  - 覆盖仓库 Inspector 命中。
- `src/ui/domains/inspector/components/object-inspector.tsx`
  - 允许 specialized body 占满高度并把库存区钉到底部。
- `src/ui/domains/inspector/components/object-inspector.test.tsx`
  - 覆盖仓库 body 布局。
- `src/ui/styles/app.css`
  - 落地仓库 Inspector 样式。
- `src/ui/domains/colonist/colonist.selectors.test.ts`
  - 更新工作文案。

**Delete**

- `src/testing/scenarios/stockpile-haul.scenario.ts`
- `src/testing/headless/stockpile-haul.scenario.test.ts`
- `src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts`
- `src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts`
- `src/testing/scenarios/quantity-haul-stack-chain.scenario.ts`
- `src/testing/headless/quantity-haul-stack-chain.scenario.test.ts`

---

### Task 1: 仓库模型与存储服务基础

**Files:**
- Create: `src/features/storage/storage.service.ts`
- Test: `src/features/storage/storage.service.test.ts`
- Modify: `src/world/def-database.ts`
- Modify: `src/defs/buildings.ts`
- Modify: `src/features/building/building.types.ts`
- Modify: `src/features/building/building.factory.ts`
- Test: `src/features/building/building.factory.test.ts`
- Modify: `src/features/save/save.commands.ts`
- Test: `src/features/save/save.commands.test.ts`

- [ ] **Step 1: 先写仓库 building 与存储服务的失败测试**

```ts
// src/features/building/building.factory.test.ts
it('attaches warehouse storage inventory from the building def', () => {
  const defs = buildDefDatabase();

  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell: { x: 4, y: 5 },
    mapId: 'main',
    defs,
  });

  expect(warehouse.category).toBe('furniture');
  expect(warehouse.furniture?.usageType).toBe('storage');
  expect(warehouse.storage).toEqual({
    mode: 'all-haulable',
    capacityMax: 160,
    storedCount: 0,
    inventory: {},
  });
});

// src/features/storage/storage.service.test.ts
it('stores, withdraws and summarizes warehouse inventory', () => {
  const defs = buildDefDatabase();
  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell: { x: 2, y: 2 },
    mapId: 'main',
    defs,
  });

  expect(canWarehouseAcceptItem(warehouse, defs, 'wood')).toBe(true);
  expect(storeInWarehouse(warehouse, 'wood', 12)).toEqual({ storedCount: 12, remainingCount: 0 });
  expect(storeInWarehouse(warehouse, 'stone_block', 7)).toEqual({ storedCount: 7, remainingCount: 0 });
  expect(withdrawFromWarehouse(warehouse, 'wood', 5)).toEqual({ takenCount: 5, remainingCount: 0 });

  expect(summarizeWarehouseInventory(warehouse, defs)).toEqual({
    totalCount: 14,
    typeCount: 2,
    entries: [
      { defId: 'stone_block', label: 'Stone Block', count: 7, color: 0x777777 },
      { defId: 'wood', label: 'Wood', count: 7, color: 0x8b6914 },
    ],
  });
});
```

- [ ] **Step 2: 运行测试，确认仓库模型尚未存在**

Run: `npx vitest run src/features/building/building.factory.test.ts src/features/storage/storage.service.test.ts`

Expected: FAIL，提示 `warehouse_shed` 未定义、`building.storage` 结构不匹配，或 `storage.service.ts` 尚不存在。

- [ ] **Step 3: 最小实现仓库 building、库存结构与领域服务**

```ts
// src/world/def-database.ts
export interface BuildingDef {
  // ...
  storageConfig?: {
    mode: 'all-haulable';
    capacityMax: number;
  };
  furnitureType?: 'bed' | 'table' | 'chair' | 'storage';
}

// src/features/building/building.types.ts
export interface Building extends MapObjectBase {
  // ...
  storage?: {
    mode: 'all-haulable';
    capacityMax: number;
    storedCount: number;
    inventory: Partial<Record<DefId, number>>;
  };
}

// src/defs/buildings.ts
{
  defId: 'warehouse_shed',
  label: 'Warehouse',
  description: 'A dedicated warehouse for abstract item storage.',
  size: { width: 2, height: 2 },
  maxHp: 180,
  workToBuild: 180,
  costList: [{ defId: 'wood', count: 20 }],
  tags: ['furniture', 'storage'],
  category: 'furniture',
  furnitureType: 'storage',
  storageConfig: {
    mode: 'all-haulable',
    capacityMax: 160,
  },
  blocksMovement: false,
  blocksLight: false,
  passable: false,
  interactionCellOffset: { x: 1, y: 2 },
  color: 0x8a6a3a,
}

// src/features/building/building.factory.ts
if (def.storageConfig) {
  building.storage = {
    mode: def.storageConfig.mode,
    capacityMax: def.storageConfig.capacityMax,
    storedCount: 0,
    inventory: {},
  };
}

// src/features/storage/storage.service.ts
export function canWarehouseAcceptItem(building: Building, defs: DefDatabase, defId: DefId): boolean {
  if (!building.storage || building.storage.mode !== 'all-haulable') return false;
  return defs.items.get(defId)?.tags.includes('haulable') ?? false;
}

export function getWarehouseFreeCapacity(building: Building): number {
  if (!building.storage) return 0;
  return Math.max(0, building.storage.capacityMax - building.storage.storedCount);
}

export function storeInWarehouse(building: Building, defId: DefId, count: number) {
  if (!building.storage || count <= 0) return { storedCount: 0, remainingCount: count };
  const accepted = Math.min(count, getWarehouseFreeCapacity(building));
  if (accepted <= 0) return { storedCount: 0, remainingCount: count };
  building.storage.inventory[defId] = (building.storage.inventory[defId] ?? 0) + accepted;
  building.storage.storedCount += accepted;
  return { storedCount: accepted, remainingCount: count - accepted };
}

export function withdrawFromWarehouse(building: Building, defId: DefId, count: number) {
  if (!building.storage || count <= 0) return { takenCount: 0, remainingCount: count };
  const available = building.storage.inventory[defId] ?? 0;
  const taken = Math.min(available, count);
  if (taken <= 0) return { takenCount: 0, remainingCount: count };
  const next = available - taken;
  if (next > 0) {
    building.storage.inventory[defId] = next;
  } else {
    delete building.storage.inventory[defId];
  }
  building.storage.storedCount -= taken;
  return { takenCount: taken, remainingCount: count - taken };
}

export function summarizeWarehouseInventory(building: Building, defs: DefDatabase) {
  const entries = Object.entries(building.storage?.inventory ?? {})
    .map(([defId, count]) => ({
      defId,
      label: defs.items.get(defId)?.label ?? defId,
      count,
      color: defs.items.get(defId)?.color ?? 0xffffff,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label) || a.defId.localeCompare(b.defId));

  return {
    totalCount: building.storage?.storedCount ?? 0,
    typeCount: entries.length,
    entries,
  };
}
```

- [ ] **Step 4: 补存档失败测试并实现仓库库存序列化**

```ts
// src/features/save/save.commands.test.ts
it('persists warehouse inventory across save and load', () => {
  localStorage.clear();

  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 42 });
  const map = createGameMap({ id: 'main', width: 12, height: 12 });
  world.maps.set(map.id, map);

  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell: { x: 3, y: 3 },
    mapId: map.id,
    defs,
  });

  warehouse.storage!.inventory = { wood: 12, stone_block: 4 };
  warehouse.storage!.storedCount = 16;
  map.objects.add(warehouse);

  saveGameHandler.execute(world, { type: 'save_game', payload: {} } as any);

  const loadedWorld = createWorld({ defs, seed: 7 });
  loadGameHandler.execute(loadedWorld, { type: 'load_game', payload: {} } as any);

  const loadedMap = loadedWorld.maps.get('main')!;
  const loadedWarehouse = loadedMap.objects.getAs(warehouse.id, ObjectKind.Building)!;

  expect(loadedWarehouse.storage).toEqual({
    mode: 'all-haulable',
    capacityMax: 160,
    storedCount: 16,
    inventory: { wood: 12, stone_block: 4 },
  });
});

// src/features/save/save.commands.ts
if (object.kind === ObjectKind.Building && object.storage) {
  serialized.storage = {
    mode: object.storage.mode,
    capacityMax: object.storage.capacityMax,
    storedCount: object.storage.storedCount,
    inventory: { ...object.storage.inventory },
  };
}
```

- [ ] **Step 5: 跑通基础测试**

Run: `npx vitest run src/features/building/building.factory.test.ts src/features/storage/storage.service.test.ts src/features/save/save.commands.test.ts`

Expected: PASS，仓库 building、容量计算、库存摘要与 save/load 全绿。

- [ ] **Step 6: 提交仓库模型基础**

```bash
git add src/world/def-database.ts src/defs/buildings.ts src/features/building/building.types.ts src/features/building/building.factory.ts src/features/building/building.factory.test.ts src/features/storage/storage.service.ts src/features/storage/storage.service.test.ts src/features/save/save.commands.ts src/features/save/save.commands.test.ts
git commit -m "feat: add warehouse storage model foundation"
```

### Task 2: 入库链路切到 `haul_to_storage`

**Files:**
- Create: `src/features/ai/jobs/storage-job.ts`
- Create: `src/features/ai/toil-handlers/store-in-storage.handler.ts`
- Modify: `src/core/types.ts`
- Modify: `src/features/storage/storage.service.ts`
- Modify: `src/features/ai/work-types.ts`
- Modify: `src/features/ai/toil-executor.ts`
- Modify: `src/features/ai/work-evaluators/hauling.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/index.ts`
- Test: `src/features/ai/work-evaluators/evaluators.test.ts`
- Test: `src/features/ai/job-selector.work-decision.test.ts`
- Test: `src/features/ai/job-selector.reachability.test.ts`
- Create: `src/testing/scenarios/warehouse-storage-haul.scenario.ts`
- Create: `src/testing/headless/warehouse-storage-haul.scenario.test.ts`

- [ ] **Step 1: 先写 `haul_to_storage` 的失败测试**

```ts
// src/features/ai/work-evaluators/evaluators.test.ts
it('returns haul_to_storage when haulable item and warehouse both exist', () => {
  const env = createTestEnv();
  const pawn = createTestPawn(env);
  env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));
  env.map.objects.add(createBuilding({ defId: 'warehouse_shed', cell: { x: 10, y: 5 }, mapId: env.map.id, defs: env.defs }));

  const result = haulToStorageWorkEvaluator.evaluate(pawn, env.map, env.world);

  expect(result.kind).toBe('haul_to_storage');
  expect(result.failureReasonCode).toBe('none');
  expect(result.jobDefId).toBe('job_store_in_storage');
});

it('returns no_storage_destination when warehouse is full', () => {
  const env = createTestEnv();
  const pawn = createTestPawn(env);
  env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));
  const warehouse = createBuilding({ defId: 'warehouse_shed', cell: { x: 10, y: 5 }, mapId: env.map.id, defs: env.defs });
  warehouse.storage!.storedCount = warehouse.storage!.capacityMax;
  warehouse.storage!.inventory = { wood: warehouse.storage!.capacityMax };
  env.map.objects.add(warehouse);

  const result = haulToStorageWorkEvaluator.evaluate(pawn, env.map, env.world);
  expect(result.failureReasonCode).toBe('no_storage_destination');
  expect(result.createJob).toBeNull();
});
```

- [ ] **Step 2: 运行 evaluator 测试，确认新工作类型尚未落地**

Run: `npx vitest run src/features/ai/work-evaluators/evaluators.test.ts`

Expected: FAIL，提示 `haulToStorageWorkEvaluator`、`job_store_in_storage` 或 `no_storage_destination` 尚不存在。

- [ ] **Step 3: 新增仓库入库 Job、ToilType 和 handler**

```ts
// src/core/types.ts
export enum ToilType {
  GoTo = 'goto',
  PickUp = 'pickup',
  Drop = 'drop',
  Work = 'work',
  Wait = 'wait',
  Deliver = 'deliver',
  Interact = 'interact',
  PrepareConstruction = 'prepare_construction',
  StoreInStorage = 'store_in_storage',
  TakeFromStorage = 'take_from_storage',
}

// src/features/ai/work-types.ts
export type WorkFailureReasonCode =
  | 'none'
  | 'no_target'
  | 'target_reserved'
  | 'target_unreachable'
  | 'need_not_triggered'
  | 'no_storage_destination'
  | 'no_storage_source'
  | 'materials_not_delivered'
  | 'carrying_conflict'
  | 'no_available_bed'
  | 'no_reachable_material_source'
  | 'order_paused'
  | 'order_cancelled'
  | 'no_order_executor';

// src/features/storage/storage.service.ts
export function findReachableWarehouseForDeposit(
  pawn: Pawn,
  map: GameMap,
  world: World,
  defId: DefId,
  requestedCount: number,
): {
  warehouse: Building;
  approachCell: CellCoord;
  freeCapacity: number;
  distance: number;
} | null {
  let best: {
    warehouse: Building;
    approachCell: CellCoord;
    freeCapacity: number;
    distance: number;
  } | null = null;

  for (const building of map.objects.allOfKind(ObjectKind.Building) as Building[]) {
    if (!canWarehouseAcceptItem(building, world.defs, defId)) continue;
    const freeCapacity = getWarehouseFreeCapacity(building);
    if (freeCapacity <= 0) continue;
    const approachCell = building.interaction?.interactionCell;
    if (!approachCell) continue;
    if (!isReachable(map, pawn.cell, approachCell)) continue;

    const distance = estimateDistance(pawn.cell, approachCell);
    if (!best || distance < best.distance) {
      best = { warehouse: building, approachCell, freeCapacity: Math.min(freeCapacity, requestedCount), distance };
    }
  }

  return best;
}

// src/features/ai/jobs/storage-job.ts
let storageJobCounter = 0;

export function createStoreInStorageJob(
  pawnId: ObjectId,
  itemId: ObjectId,
  itemCell: CellCoord,
  warehouseId: ObjectId,
  approachCell: CellCoord,
  count: number,
): Job {
  return {
    id: `job_store_in_storage_${++storageJobCounter}`,
    defId: 'job_store_in_storage',
    pawnId,
    targetId: itemId,
    targetCell: itemCell,
    toils: [
      { type: ToilType.GoTo, targetCell: itemCell, state: ToilState.NotStarted, localData: {} },
      { type: ToilType.PickUp, targetId: itemId, targetCell: itemCell, state: ToilState.NotStarted, localData: { requestedCount: count } },
      { type: ToilType.GoTo, targetCell: approachCell, state: ToilState.NotStarted, localData: {} },
      { type: ToilType.StoreInStorage, targetId: warehouseId, targetCell: approachCell, state: ToilState.NotStarted, localData: { count } },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}

// src/features/ai/toil-handlers/store-in-storage.handler.ts
export const executeStoreInStorage: ToilHandler = ({ pawn, toil, map, world }) => {
  const carrying = pawn.inventory.carrying;
  if (!carrying || !toil.targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const warehouse = map.objects.getAs(toil.targetId, ObjectKind.Building);
  if (!warehouse || !warehouse.storage) {
    toil.state = ToilState.Failed;
    return;
  }

  const requestedCount = Math.max(0, Math.floor((toil.localData.count as number) ?? carrying.count));
  const stored = storeInWarehouse(warehouse, carrying.defId, Math.min(requestedCount, carrying.count));
  if (stored.storedCount <= 0) {
    toil.state = ToilState.Failed;
    return;
  }

  const left = carrying.count - stored.storedCount;
  pawn.inventory.carrying = left > 0 ? { defId: carrying.defId, count: left } : null;
  toil.state = left === 0 ? ToilState.Completed : ToilState.Failed;
};

// src/features/ai/toil-executor.ts
const toilHandlers: Record<string, ToilHandler> = {
  [ToilType.GoTo]: executeGoTo,
  [ToilType.PickUp]: executePickUp,
  [ToilType.Drop]: executeDrop,
  [ToilType.Work]: executeWork,
  [ToilType.Wait]: executeWait,
  [ToilType.Deliver]: executeDeliver,
  [ToilType.Interact]: executeInteract,
  [ToilType.PrepareConstruction]: executePrepareConstruction,
  [ToilType.StoreInStorage]: executeStoreInStorage,
  [ToilType.TakeFromStorage]: executeTakeFromStorage,
};
```

- [ ] **Step 4: 把搬运 evaluator 从 `stockpile` 改成仓库**

```ts
// src/features/ai/work-evaluators/hauling.evaluator.ts
export const haulToStorageWorkEvaluator: WorkEvaluator = {
  kind: 'haul_to_storage',
  label: '搬运入库',
  priority: 15,
  evaluate(pawn, map, world) {
    const blocked = (code: 'no_target' | 'no_storage_destination', text: string): WorkEvaluation => ({
      kind: 'haul_to_storage',
      label: '搬运入库',
      priority: 15,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    });

    const items = map.objects.allOfKind(ObjectKind.Item) as Item[];
    let best: {
      item: Item;
      warehouse: Building;
      approachCell: CellCoord;
      score: number;
      haulCount: number;
    } | null = null;

    for (const item of items) {
      if (item.destroyed || !item.tags.has('haulable') || map.reservations.isReserved(item.id)) continue;
      const candidate = findReachableWarehouseForDeposit(pawn, map, world, item.defId, item.stackCount);
      if (!candidate) continue;

      const itemDist = estimateDistance(pawn.cell, item.cell);
      const destDist = estimateDistance(item.cell, candidate.approachCell);
      const haulCount = Math.min(item.stackCount, candidate.freeCapacity, pawn.inventory.carryCapacity);
      if (haulCount <= 0) continue;

      const score = 15 - itemDist * 0.45 - destDist * 0.2;
      if (!best || score > best.score) {
        best = { item, warehouse: candidate.warehouse, approachCell: candidate.approachCell, score, haulCount };
      }
    }

    if (!best) return blocked('no_target', '没有可入库的地面物资');

    return {
      kind: 'haul_to_storage',
      label: '搬运入库',
      priority: 15,
      score: best.score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: best.item.defId,
      jobDefId: 'job_store_in_storage',
      evaluatedAtTick: world.tick,
      createJob: () => createStoreInStorageJob(
        pawn.id,
        best!.item.id,
        { ...best!.item.cell },
        best!.warehouse.id,
        { ...best!.approachCell },
        best!.haulCount,
      ),
    };
  },
};
```

- [ ] **Step 5: 增加 headless 场景，锁死“地面物资入仓后不再落地”**

```ts
// src/testing/scenarios/warehouse-storage-haul.scenario.ts
import { createScenario, createWaitForStep, createAssertStep } from '../scenario-dsl/scenario.builders';
import { spawnPawnFixture, spawnItemFixture, spawnBuildingFixture } from '../scenario-fixtures/world-fixtures';

export const warehouseStorageHaulScenario = createScenario({
  id: 'warehouse-storage-haul',
  title: '搬运进入仓库',
  description: '验证地面物资会被搬到仓库并转成抽象库存。',
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 6, y: 10 }, 5),
    spawnBuildingFixture('warehouse_shed', { x: 14, y: 8 }),
  ],
  script: [
    createWaitForStep('等待木材进入仓库', ({ query }) => {
      const warehouse = query.findBuildingAt('warehouse_shed', { x: 14, y: 8 }) as any;
      return (warehouse?.storage?.inventory?.wood ?? 0) === 5;
    }, { timeoutTicks: 300, timeoutMessage: '木材未进入仓库' }),
  ],
  expect: [
    createAssertStep('地面木材已清空', ({ query }) => query.findItemsByDef('wood').length === 0, {
      failureMessage: '地面仍残留木材',
    }),
  ],
});

// src/testing/headless/warehouse-storage-haul.scenario.test.ts
describe('warehouseStorageHaulScenario', () => {
  it('stores ground items into the warehouse inventory', async () => {
    const result = await runHeadlessScenario(warehouseStorageHaulScenario);
    expect(result.status).toBe('passed');
  });
});
```

- [ ] **Step 6: 跑通入库链路测试**

Run: `npx vitest run src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.reachability.test.ts src/testing/headless/warehouse-storage-haul.scenario.test.ts`

Expected: PASS，搬运目标改为仓库，地面物资会进入仓库库存。

- [ ] **Step 7: 提交入库链路**

```bash
git add src/core/types.ts src/features/ai/work-types.ts src/features/ai/jobs/storage-job.ts src/features/ai/toil-handlers/store-in-storage.handler.ts src/features/ai/toil-executor.ts src/features/ai/work-evaluators/hauling.evaluator.ts src/features/ai/work-evaluators/index.ts src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.reachability.test.ts src/testing/scenarios/warehouse-storage-haul.scenario.ts src/testing/headless/warehouse-storage-haul.scenario.test.ts
git commit -m "feat: route haul jobs into warehouses"
```

### Task 3: 所有材料工作统一从仓库取材

**Files:**
- Modify: `src/features/storage/storage.service.ts`
- Modify: `src/features/ai/work-evaluators/construction.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/carrying.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/blueprint-inflight.ts`
- Modify: `src/features/ai/jobs/haul-job.ts`
- Modify: `src/features/ai/jobs/carry-job.ts`
- Modify: `src/features/ai/jobs/storage-job.ts`
- Create: `src/features/ai/toil-handlers/take-from-storage.handler.ts`
- Modify: `src/features/ai/toil-handlers/deliver.handler.ts`
- Test: `src/features/ai/deliver.handler.construction.test.ts`
- Test: `src/features/ai/job-selector.work-reasons.test.ts`
- Test: `src/features/ai/job-selector.carrying.test.ts`
- Modify: `src/testing/scenarios/blueprint-construction.scenario.ts`
- Modify: `src/testing/headless/blueprint-construction.scenario.test.ts`

- [ ] **Step 1: 先写“地上有料但未入库时，正式工作不能直接拿”的失败测试**

```ts
// src/features/ai/job-selector.work-reasons.test.ts
it('blocks deliver_materials when material only exists on the ground', () => {
  const env = createConstructionEnv();
  env.map.objects.add(createItem({ defId: 'wood', cell: { x: 8, y: 10 }, mapId: env.map.id, stackCount: 20, defs: env.defs }));
  placeBlueprint(env.map, 'wall_wood', { x: 14, y: 10 });

  const result = deliverMaterialsWorkEvaluator.evaluate(env.pawn, env.map, env.world);

  expect(result.failureReasonCode).toBe('no_storage_source');
  expect(result.createJob).toBeNull();
});

// src/features/ai/deliver.handler.construction.test.ts
it('delivers material after taking it from warehouse inventory', () => {
  const env = createConstructionEnv();
  const warehouse = createBuilding({ defId: 'warehouse_shed', cell: { x: 12, y: 8 }, mapId: env.map.id, defs: env.defs });
  warehouse.storage!.inventory = { wood: 20 };
  warehouse.storage!.storedCount = 20;
  env.map.objects.add(warehouse);

  const blueprint = placeBlueprint(env.map, 'wall_wood', { x: 14, y: 10 });
  const job = createTakeFromStorageToBlueprintJob(
    env.pawn.id,
    warehouse.id,
    warehouse.interaction!.interactionCell,
    'wood',
    5,
    blueprint.id,
    { x: 14, y: 9 },
  );

  runJobUntilComplete(env, job);

  expect(warehouse.storage!.inventory.wood).toBe(15);
  expect(blueprint.materialsDelivered.find(entry => entry.defId === 'wood')?.count).toBe(5);
});
```

- [ ] **Step 2: 运行材料工作测试，确认正式取材链路尚未存在**

Run: `npx vitest run src/features/ai/job-selector.work-reasons.test.ts src/features/ai/deliver.handler.construction.test.ts`

Expected: FAIL，提示 `no_storage_source`、`createTakeFromStorageToBlueprintJob` 或 `take_from_storage` 尚不存在。

- [ ] **Step 3: 新增从仓库取材的 Job 和 handler**

```ts
// src/features/ai/jobs/storage-job.ts
export function createTakeFromStorageToBlueprintJob(
  pawnId: ObjectId,
  warehouseId: ObjectId,
  warehouseCell: CellCoord,
  defId: DefId,
  count: number,
  blueprintId: ObjectId,
  blueprintApproachCell: CellCoord,
): Job {
  return {
    id: `job_take_from_storage_${++storageJobCounter}`,
    defId: 'job_take_from_storage',
    pawnId,
    targetId: warehouseId,
    targetCell: warehouseCell,
    toils: [
      { type: ToilType.GoTo, targetCell: warehouseCell, state: ToilState.NotStarted, localData: {} },
      { type: ToilType.TakeFromStorage, targetId: warehouseId, targetCell: warehouseCell, state: ToilState.NotStarted, localData: { defId, count } },
      { type: ToilType.GoTo, targetCell: blueprintApproachCell, state: ToilState.NotStarted, localData: {} },
      { type: ToilType.Deliver, targetId: blueprintId, targetCell: blueprintApproachCell, state: ToilState.NotStarted, localData: { defId, count } },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}

// src/features/ai/toil-handlers/take-from-storage.handler.ts
export const executeTakeFromStorage: ToilHandler = ({ pawn, toil, map }) => {
  if (!toil.targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const warehouse = map.objects.getAs(toil.targetId, ObjectKind.Building);
  if (!warehouse || !warehouse.storage) {
    toil.state = ToilState.Failed;
    return;
  }

  const defId = toil.localData.defId as DefId;
  const count = Math.max(0, Math.floor((toil.localData.count as number) ?? 0));
  const taken = withdrawFromWarehouse(warehouse, defId, count);
  if (taken.takenCount <= 0) {
    toil.state = ToilState.Failed;
    return;
  }

  pawn.inventory.carrying = { defId, count: taken.takenCount };
  toil.state = ToilState.Completed;
};
```

- [ ] **Step 4: 把 construction evaluator 的材料来源从地面 item 改到仓库库存**

```ts
// src/features/storage/storage.service.ts
export function findReachableWarehouseForWithdrawal(
  pawn: Pawn,
  map: GameMap,
  world: World,
  defId: DefId,
  requestedCount: number,
): {
  warehouse: Building;
  approachCell: CellCoord;
  availableCount: number;
  distance: number;
} | null {
  let best: {
    warehouse: Building;
    approachCell: CellCoord;
    availableCount: number;
    distance: number;
  } | null = null;

  for (const building of map.objects.allOfKind(ObjectKind.Building) as Building[]) {
    const availableCount = building.storage?.inventory[defId] ?? 0;
    if (availableCount <= 0) continue;
    const approachCell = building.interaction?.interactionCell;
    if (!approachCell) continue;
    if (!isReachable(map, pawn.cell, approachCell)) continue;

    const distance = estimateDistance(pawn.cell, approachCell);
    if (!best || distance < best.distance) {
      best = {
        warehouse: building,
        approachCell,
        availableCount: Math.min(availableCount, requestedCount),
        distance,
      };
    }
  }

  return best;
}

// src/features/ai/work-evaluators/construction.evaluator.ts
const candidate = findReachableWarehouseForWithdrawal(
  pawn,
  map,
  world,
  matDefId,
  needed,
);

if (!candidate) {
  return blocked('no_storage_source', '没有可达的仓库材料来源');
}

const haulCount = Math.min(needed, candidate.availableCount, pawn.inventory.carryCapacity);
bestCreateJob = () => createTakeFromStorageToBlueprintJob(
  pawn.id,
  candidate.warehouse.id,
  { ...candidate.approachCell },
  matDefId,
  haulCount,
  bp.id,
  { ...approachCell },
);
```

- [ ] **Step 5: 把携带物回收逻辑从 `stockpile` 改成仓库**

```ts
// src/features/ai/work-evaluators/carrying.evaluator.ts
const storageCandidate = findReachableWarehouseForDeposit(
  pawn,
  map,
  world,
  carrying.defId,
  carrying.count,
);

if (!storageCandidate) {
  return {
    ...blocked,
    failureReasonCode: 'no_storage_destination',
    failureReasonText: '当前携带物没有合法仓库存放目标',
  };
}

return {
  kind: 'resolve_carrying',
  label: '处理携带物',
  priority: 20,
  score: 4 - storageCandidate.distance * 0.1,
  failureReasonCode: 'none',
  failureReasonText: null,
  detail: carrying.defId,
  jobDefId: 'job_store_carried_materials',
  evaluatedAtTick: world.tick,
  createJob: () => createCarryJob(
    pawn.id,
    { ...storageCandidate.approachCell },
    carrying.count,
    undefined,
    { warehouseId: storageCandidate.warehouse.id, mode: 'store_in_storage' },
  ),
};
```

- [ ] **Step 6: 改写蓝图场景，锁死“先入仓，再出仓，再施工”**

```ts
// src/testing/scenarios/blueprint-construction.scenario.ts
import { createScenario, createWaitForStep, createAssertStep } from '../scenario-dsl/scenario.builders';
import { spawnPawnFixture, spawnItemFixture, spawnBuildingFixture } from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import { waitForBlueprintDelivered, waitForBuildingCreated } from '../scenario-probes/building-probes';

export const blueprintConstructionScenario = createScenario({
  id: 'blueprint-construction',
  title: '仓库供料建造',
  description: '验证材料会先进入仓库，再从仓库取出并交付蓝图。',
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Builder'),
    spawnItemFixture('wood', { x: 8, y: 10 }, 20),
    spawnBuildingFixture('warehouse_shed', { x: 12, y: 8 }),
  ],
  script: [
    createWaitForStep('等待木材进入仓库', ({ query }) => {
      const warehouse = query.findBuildingAt('warehouse_shed', { x: 12, y: 8 }) as any;
      return (warehouse?.storage?.inventory?.wood ?? 0) >= 5;
    }, { timeoutTicks: 300, timeoutMessage: '木材未先进入仓库' }),
    placeBlueprintCommand('wall_wood', { x: 14, y: 10 }),
    waitForBlueprintDelivered('等待仓库材料送达蓝图', 'wall_wood', 300),
    waitForBuildingCreated('等待建筑完成', 'wall_wood', { x: 14, y: 10 }, 600),
  ],
  expect: [
    createAssertStep('施工阶段没有直接消费地面木材', ({ query }) => query.findItemsByDef('wood').length === 0, {
      failureMessage: '施工期间出现了未入仓的地面木材来源',
    }),
  ],
});
```

- [ ] **Step 7: 跑通仓库取材闭环**

Run: `npx vitest run src/features/ai/job-selector.work-reasons.test.ts src/features/ai/job-selector.carrying.test.ts src/features/ai/deliver.handler.construction.test.ts src/testing/headless/blueprint-construction.scenario.test.ts`

Expected: PASS，所有正式材料工作只会从仓库取材，地面物资不再直接参与消费链路。

- [ ] **Step 8: 提交仓库供料闭环**

```bash
git add src/features/ai/work-evaluators/construction.evaluator.ts src/features/ai/work-evaluators/carrying.evaluator.ts src/features/ai/work-evaluators/blueprint-inflight.ts src/features/ai/jobs/haul-job.ts src/features/ai/jobs/carry-job.ts src/features/ai/jobs/storage-job.ts src/features/ai/toil-handlers/take-from-storage.handler.ts src/features/ai/toil-handlers/deliver.handler.ts src/features/ai/deliver.handler.construction.test.ts src/features/ai/job-selector.work-reasons.test.ts src/features/ai/job-selector.carrying.test.ts src/testing/scenarios/blueprint-construction.scenario.ts src/testing/headless/blueprint-construction.scenario.test.ts
git commit -m "feat: source all material work from warehouses"
```

### Task 4: 删除 `stockpile` 正式存储链路并替换回归资产

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/features/zone/zone.types.ts`
- Modify: `src/world/zone-manager.ts`
- Modify: `src/features/item/item.types.ts`
- Modify: `src/features/item/item.queries.ts`
- Modify: `src/ui/domains/build/command-menu.ts`
- Modify: `src/ui/domains/build/command-menu.test.ts`
- Modify: `src/testing/scenario-registry.ts`
- Modify: `src/testing/headless/scenario-regression.test.ts`
- Modify: `src/features/ai/job-selector.work-decision.test.ts`
- Modify: `src/features/ai/job-selector.reachability.test.ts`
- Modify: `src/features/ai/reservation-lifecycle.test.ts`
- Modify: `src/ui/domains/colonist/colonist.selectors.test.ts`
- Delete: `src/testing/scenarios/stockpile-haul.scenario.ts`
- Delete: `src/testing/headless/stockpile-haul.scenario.test.ts`
- Delete: `src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts`
- Delete: `src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts`
- Delete: `src/testing/scenarios/quantity-haul-stack-chain.scenario.ts`
- Delete: `src/testing/headless/quantity-haul-stack-chain.scenario.test.ts`

- [ ] **Step 1: 先写菜单和回归表的失败测试**

```ts
// src/ui/domains/build/command-menu.test.ts
it('shows warehouse under build > furniture and removes stockpile entry', () => {
  const entries = getVisibleCommandMenuEntries(['build', 'furniture'], 'build_warehouse');
  expect(entries.map(entry => entry.label)).toEqual(['返回', '床', '仓库']);

  const zoneEntries = getVisibleCommandMenuEntries(['zone'], 'zone_growing');
  expect(zoneEntries.map(entry => entry.label)).toEqual(['返回', '种植区']);
});

// src/testing/scenario-registry.ts
expect(scenarioRegistry.map(scenario => scenario.id)).toContain('warehouse-storage-haul');
expect(scenarioRegistry.map(scenario => scenario.id)).not.toContain('stockpile-haul');
```

- [ ] **Step 2: 运行菜单和 registry 测试**

Run: `npx vitest run src/ui/domains/build/command-menu.test.ts src/testing/headless/scenario-regression.test.ts`

Expected: FAIL，当前菜单仍暴露 `zone_stockpile`，旧场景仍在注册表内。

- [ ] **Step 3: 移除 stockpile 类型与旧 item 搜索语义**

```ts
// src/core/types.ts
export enum ZoneType {
  Growing = 'growing',
}

// src/features/item/item.types.ts
export type ItemPlacementSearchScope = 'nearest-compatible';

// src/features/item/item.queries.ts
export function canPlaceItemAtCell(
  map: GameMap,
  defs: DefDatabase,
  cell: CellCoord,
  defId: DefId,
  _searchScope: ItemPlacementSearchScope,
): boolean {
  if (!map.pathGrid.isPassable(cell.x, cell.y)) return false;
  if (!map.spatial.isPassable(cell)) return false;

  const items = getItemsAtCell(map, cell);
  if (items.length === 0) return true;
  if (items.some(item => item.defId !== defId)) return false;

  const maxStack = getResolvedMaxStack(defs, defId, items);
  return items.some(item => item.stackCount < maxStack);
}
```

- [ ] **Step 4: 替换建造菜单入口并清理场景注册**

```ts
// src/ui/domains/build/command-menu.ts
{
  id: 'build_warehouse',
  label: '仓库',
  kind: 'leaf',
  action: { id: 'build_warehouse', tool: 'build', label: '仓库', hotkey: '', buildDefId: 'warehouse_shed', group: 1 },
}

export function resolveActiveCommandLeafId(state: ActiveToolState): string {
  if (state.activeTool === 'build') {
    if (state.activeBuildDefId === 'bed_wood') return 'build_bed';
    if (state.activeBuildDefId === 'warehouse_shed') return 'build_warehouse';
    return 'build_wall';
  }
  if (state.activeTool === 'designate') return state.activeDesignationType ?? 'mine';
  if (state.activeTool === 'zone') return 'zone_growing';
  return state.activeTool;
}

// src/testing/scenario-registry.ts
import { warehouseStorageHaulScenario } from './scenarios/warehouse-storage-haul.scenario';

export const scenarioRegistry: readonly ScenarioDefinition[] = [
  woodcuttingScenario,
  warehouseStorageHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
  sleepBedOccupancyScenario,
  bedBlueprintSleepScenario,
  blueprintOversupplyHaulScenario,
  blueprintMultiPawnOversupplyScenario,
  todSleepRhythmScenario,
  workOrderMapPriorityScenario,
] as const;
```

- [ ] **Step 5: 删除旧 stockpile 场景并改写剩余断言**

```ts
// src/ui/domains/colonist/colonist.selectors.test.ts
expect(vm.workDecision?.options).toContainEqual(
  expect.objectContaining({
    kind: 'haul_to_storage',
    label: '搬运入库',
  }),
);

// src/features/ai/job-selector.work-decision.test.ts
expect(
  pawn.ai.workDecision?.options.some(
    option => option.kind === 'haul_to_storage' && option.status === 'deferred',
  ),
).toBe(true);
```

- [ ] **Step 6: 跑通删除 `stockpile` 后的回归面**

Run: `npx vitest run src/ui/domains/build/command-menu.test.ts src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.reachability.test.ts src/features/ai/reservation-lifecycle.test.ts src/ui/domains/colonist/colonist.selectors.test.ts src/testing/headless/scenario-regression.test.ts`

Expected: PASS，主链路不再引用 `stockpile`，场景回归改由仓库版本覆盖。

- [ ] **Step 7: 提交 `stockpile` 删除**

```bash
git add src/core/types.ts src/features/zone/zone.types.ts src/world/zone-manager.ts src/features/item/item.types.ts src/features/item/item.queries.ts src/ui/domains/build/command-menu.ts src/ui/domains/build/command-menu.test.ts src/testing/scenario-registry.ts src/testing/headless/scenario-regression.test.ts src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.reachability.test.ts src/features/ai/reservation-lifecycle.test.ts src/ui/domains/colonist/colonist.selectors.test.ts
git rm src/testing/scenarios/stockpile-haul.scenario.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts src/testing/scenarios/quantity-haul-stack-chain.scenario.ts src/testing/headless/quantity-haul-stack-chain.scenario.test.ts
git commit -m "refactor: remove stockpile-based storage flow"
```

### Task 5: 仓库 Inspector、快照投影与底部库存 Dock

**Files:**
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Modify: `src/ui/kernel/snapshot-reader.test.ts`
- Modify: `src/ui/domains/inspector/inspector.types.ts`
- Modify: `src/ui/domains/inspector/adapters/building-inspector.adapter.tsx`
- Modify: `src/ui/domains/inspector/inspector.selectors.test.ts`
- Modify: `src/ui/domains/inspector/components/object-inspector.tsx`
- Modify: `src/ui/domains/inspector/components/object-inspector.test.tsx`
- Modify: `src/ui/styles/app.css`

- [ ] **Step 1: 先写仓库 Inspector 的失败测试**

```ts
// src/ui/domains/inspector/inspector.selectors.test.ts
it('uses a specialized warehouse inspector with inventory summary', () => {
  const snapshot = makeSnapshot({
    selection: { primaryId: 'warehouse_1', selectedIds: ['warehouse_1'] },
    objects: {
      warehouse_1: {
        id: 'warehouse_1',
        kind: 'building',
        label: 'Warehouse',
        defId: 'warehouse_shed',
        cell: { x: 8, y: 8 },
        footprint: { width: 2, height: 2 },
        category: 'furniture',
        usageType: 'storage',
        storage: {
          capacityMax: 160,
          storedCount: 36,
          typeCount: 3,
          entries: [
            { defId: 'wood', label: 'Wood', count: 20, color: 0x8b6914 },
            { defId: 'stone_block', label: 'Stone Block', count: 10, color: 0x777777 },
            { defId: 'meal_simple', label: 'Simple Meal', count: 6, color: 0xe0c068 },
          ],
        },
      } as any,
    },
  });

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.mode).toBe('specialized');
  expect(vm?.title).toBe('Warehouse');
});

// src/ui/domains/inspector/components/object-inspector.test.tsx
it('renders warehouse inventory dock inside specialized inspector body', () => {
  const vm: SpecializedInspectorViewModel = {
    mode: 'specialized',
    targetId: 'warehouse_1',
    title: 'Warehouse',
    subtitle: 'Building',
    stack: [{ id: 'warehouse_1', label: 'Warehouse', kind: 'building', isActive: true }],
    sections: [],
    actions: [],
    renderBody: () => (
      <div class="warehouse-inspector">
        <div class="warehouse-inspector__top">top</div>
        <div class="warehouse-inventory">
          <div class="warehouse-inventory__grid" data-testid="warehouse-inventory-grid">grid</div>
        </div>
      </div>
    ),
  };

  render(<ObjectInspector viewModel={vm} onSelectTarget={() => {}} onRunAction={() => {}} />);
  expect(screen.getByTestId('warehouse-inventory-grid')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行 Inspector 测试，确认快照尚未携带库存摘要**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/inspector/components/object-inspector.test.tsx`

Expected: FAIL，当前 `BuildingObjectNode` 没有 `storage` 视图字段，也没有仓库专属 body。

- [ ] **Step 3: 把仓库库存摘要投影到 UI 快照**

```ts
// src/ui/kernel/ui-types.ts
export interface BuildingNode {
  // ...
  storage?: {
    capacityMax: number;
    storedCount: number;
    typeCount: number;
    entries: Array<{ defId: string; label: string; count: number; color: number }>;
  };
}

export interface BuildingObjectNode extends ObjectNodeBase {
  kind: 'building';
  category?: 'structure' | 'furniture';
  usageType?: 'bed' | 'table' | 'chair' | 'storage';
  bed?: { role: 'public' | 'owned' | 'medical' | 'prisoner'; ownerPawnId: string | null; occupantPawnId: string | null; autoAssignable: boolean };
  storage?: {
    capacityMax: number;
    storedCount: number;
    typeCount: number;
    entries: Array<{ defId: string; label: string; count: number; color: number }>;
  };
}

// src/ui/kernel/snapshot-reader.ts
const storageSummary = building.storage
  ? summarizeWarehouseInventory(building, world.defs)
  : null;

buildings[building.id] = {
  id: building.id,
  label: def?.label ?? building.defId,
  defId: building.defId,
  cell: { x: building.cell.x, y: building.cell.y },
  footprint: building.footprint ?? { width: 1, height: 1 },
  category: building.category,
  usageType: building.furniture?.usageType,
  bed: building.bed ? {
    role: building.bed.role,
    ownerPawnId: building.bed.ownerPawnId ?? null,
    occupantPawnId: building.bed.occupantPawnId ?? null,
    autoAssignable: building.bed.autoAssignable,
  } : undefined,
  storage: storageSummary ? {
    capacityMax: building.storage!.capacityMax,
    storedCount: storageSummary.totalCount,
    typeCount: storageSummary.typeCount,
    entries: storageSummary.entries,
  } : undefined,
};
```

- [ ] **Step 4: 在 building adapter 中渲染仓库专属 Inspector**

```tsx
// src/ui/domains/inspector/adapters/building-inspector.adapter.tsx
if (building.storage) {
  sections.push({
    id: 'storage',
    title: 'Storage',
    rows: [
      { label: 'Capacity', value: `${building.storage.storedCount}/${building.storage.capacityMax}` },
      { label: 'Item Types', value: String(building.storage.typeCount) },
    ],
  });
}

renderBody: (callbacks: InspectorBodyCallbacks) => {
  if (building.storage) {
    return (
      <div class="warehouse-inspector" data-testid="warehouse-inspector">
        <div class="warehouse-inspector__top">
          <Section title="Info">
            {infoRows.map(row => <StatRow key={row.label} label={row.label} value={row.value} />)}
          </Section>
          <Section title="Storage">
            <StatRow label="Capacity" value={`${building.storage.storedCount}/${building.storage.capacityMax}`} />
            <StatRow label="Item Types" value={String(building.storage.typeCount)} />
            <StatRow label="Total Count" value={String(building.storage.storedCount)} />
          </Section>
          <Section title="Controls">
            <div class="warehouse-inspector__future-panel">Incoming / Outgoing / Priority</div>
          </Section>
        </div>
        <div class="warehouse-inventory">
          <div class="warehouse-inventory__header">
            <span>Inventory</span>
            <span>{building.storage.typeCount} types / {building.storage.storedCount} total</span>
          </div>
          <div class="warehouse-inventory__grid" data-testid="warehouse-inventory-grid">
            {building.storage.entries.map(entry => (
              <div key={entry.defId} class="warehouse-item-card">
                <span class="warehouse-item-card__swatch" style={{ background: `#${entry.color.toString(16).padStart(6, '0')}` }} />
                <span class="warehouse-item-card__label">{entry.label}</span>
                <strong class="warehouse-item-card__count">{entry.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Section title="Info">
        {infoRows.map(row => <StatRow key={row.label} label={row.label} value={row.value} />)}
      </Section>
      {building.bed && (
        <Section title="Bed">
          <StatRow label="Role" value={toTitleCase(building.bed.role)} />
          <StatRow label="Owner" value={building.bed.ownerPawnId ?? 'Unassigned'} />
          <StatRow label="Occupant" value={building.bed.occupantPawnId ?? 'Empty'} />
        </Section>
      )}
    </>
  );
},
```

- [ ] **Step 5: 让 ObjectInspector 支持“上半功能区 + 底部库存 Dock”**

```tsx
// src/ui/domains/inspector/components/object-inspector.tsx
<div class="inspector-panel" data-testid="object-inspector">
  <ObjectStackTabs stack={vm.stack} onSelectTarget={onSelectTarget} />
  <div class="inspector-panel__header" data-testid="inspector-title">{vm.title}</div>
  <div class="inspector-panel__body inspector-panel__body--flex">
    {vm.mode === 'generic' ? (
      <>
        <div class="inspector-fallback-notice" data-testid="fallback-notice">{vm.fallbackNotice}</div>
        <Section title="Info">
          {vm.stats.map(stat => <StatRow key={stat.label} label={stat.label} value={stat.value} />)}
        </Section>
      </>
    ) : vm.renderBody ? (
      vm.renderBody(bodyCallbacks)
    ) : (
      <>
        {vm.sections.map(section => (
          <Section key={section.id} title={section.title}>
            <div data-testid={`section-${section.id}`}>
              {section.rows.map(row => <StatRow key={row.label} label={row.label} value={row.value} />)}
            </div>
          </Section>
        ))}
      </>
    )}
  </div>
</div>
```

```css
/* src/ui/styles/app.css */
.inspector-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inspector-panel__body--flex {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.warehouse-inspector {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.warehouse-inspector__top {
  flex: 0 0 auto;
}

.warehouse-inventory {
  margin-top: auto;
  display: flex;
  flex: 1 1 auto;
  min-height: 180px;
  flex-direction: column;
}

.warehouse-inventory__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
}
```

- [ ] **Step 6: 跑通仓库 Inspector 测试**

Run: `npx vitest run src/ui/kernel/snapshot-reader.test.ts src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/inspector/components/object-inspector.test.tsx`

Expected: PASS，仓库 building 会投影库存摘要，Inspector 功能区在上，库存区固定在底部。

- [ ] **Step 7: 提交仓库 Inspector**

```bash
git add src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/kernel/snapshot-reader.test.ts src/ui/domains/inspector/inspector.types.ts src/ui/domains/inspector/adapters/building-inspector.adapter.tsx src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/inspector/components/object-inspector.tsx src/ui/domains/inspector/components/object-inspector.test.tsx src/ui/styles/app.css
git commit -m "feat: add warehouse inspector inventory dock"
```

### Task 6: 最终验证与清理

**Files:**
- Modify: `src/testing/scenario-registry.ts`
- Modify: `src/testing/headless/scenario-regression.test.ts`
- Modify: `src/ui/domains/colonist/colonist.selectors.test.ts`
- Modify: `src/ui/kernel/snapshot-reader.test.ts`

- [ ] **Step 1: 跑关键单测批次**

Run: `npx vitest run src/features/storage/storage.service.test.ts src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.work-reasons.test.ts src/features/ai/deliver.handler.construction.test.ts src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/inspector/components/object-inspector.test.tsx`

Expected: PASS，simulation 核心逻辑和 UI 单测全部通过。

- [ ] **Step 2: 跑关键 headless 场景**

Run: `npx vitest run src/testing/headless/warehouse-storage-haul.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts src/testing/headless/bed-blueprint-sleep.scenario.test.ts`

Expected: PASS，仓库存储闭环、仓库供料闭环以及一个非存储主链路场景同时通过。

- [ ] **Step 3: 跑完整回归**

Run: `npx vitest run src/testing/headless/scenario-regression.test.ts`

Expected: PASS，新仓库场景替换旧 `stockpile` 场景后，整套注册表回归通过。

- [ ] **Step 4: 搜索残留的正式 `stockpile` 业务引用**

Run: `rg -n "stockpile|haul_to_stockpile|zone_stockpile|no_stockpile_destination" src`

Expected: 无匹配；如果仍命中业务代码，回到对应任务清理。

- [ ] **Step 5: 提交最终收口**

```bash
git add src
git commit -m "refactor: complete warehouse-only storage flow"
```
