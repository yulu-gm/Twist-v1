# Object Inspector 架构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一的 Object Inspector 架构，支持同格对象切换、类型专属 Inspector 扩展，以及带明确降级提示的 generic fallback。

**Architecture:** 先把 `selection.primaryId` 与 `uiState.inspectorTargetId` 分离，再把 snapshot 扩展为统一对象数据源，然后在 `ui/domains/inspector/` 下建立统一容器、对象栈导航与 adapter 注册机制。现有 colonist/building inspector 逻辑不再由 `app-shell` 直接分支选择，而是改为作为对象专属 adapter 接入统一 inspector；未实现专属支持的对象统一走 generic fallback，并明确显示“缺少专用 Inspector”的降级提示。

**Tech Stack:** TypeScript、Preact、Vitest、现有 snapshot-reader / ui-reducer / UiPorts / command bus

---

## 文件结构与职责

- `src/ui/kernel/ui-types.ts`
  - 扩展 `UiState`、统一对象节点快照类型、Object Inspector 所需基础类型。
- `src/ui/kernel/ui-reducer.ts`
  - 新增 `inspectorTargetId` 及相关 action。
- `src/ui/kernel/ui-reducer.test.ts`
  - 覆盖 inspector target 的默认值、设置、清理行为。
- `src/ui/kernel/snapshot-reader.ts`
  - 把 Blueprint / ConstructionSite / Item / Plant 等对象也映射进统一 snapshot。
- `src/ui/domains/inspector/*`
  - 新增统一 inspector 领域：容器、导航、selectors、types、generic fallback、adapter 注册表。
- `src/ui/domains/colonist/*`
  - 将现有 colonist inspector 视图模型提炼为 Pawn adapter。
- `src/ui/domains/building/*`
  - 将现有 building inspector 视图模型提炼为 Building adapter。
- `src/ui/domains/inspector/adapters/*`
  - Blueprint / ConstructionSite / Item / Plant / Rock 等专属 adapter。
- `src/ui/app/app-shell.tsx`
  - 从“分别渲染 colonist/building inspector”迁移为统一 `ObjectInspector`。
- `src/ui/app/app-shell.test.tsx`
  - 覆盖统一 Object Inspector 的挂载路径。

---

### Task 1: 为 Inspector 目标引入独立 UI 状态

**Files:**
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/ui-reducer.ts`
- Modify: `src/ui/kernel/ui-reducer.test.ts`

- [ ] **Step 1: 先写 reducer 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { createInitialUiState, uiReducer } from './ui-reducer';

describe('uiReducer inspectorTargetId', () => {
  it('defaults inspectorTargetId to null', () => {
    const state = createInitialUiState();
    expect(state.inspectorTargetId).toBeNull();
  });

  it('sets inspector target independently from selection state', () => {
    const state = createInitialUiState();
    const next = uiReducer(state, {
      type: 'set_inspector_target',
      targetId: 'item_1',
    });

    expect(next.inspectorTargetId).toBe('item_1');
  });

  it('clears inspector target explicitly', () => {
    const state = {
      ...createInitialUiState(),
      inspectorTargetId: 'building_1',
    };
    const next = uiReducer(state, {
      type: 'set_inspector_target',
      targetId: null,
    });

    expect(next.inspectorTargetId).toBeNull();
  });
});
```

- [ ] **Step 2: 运行 reducer 测试，确认先失败**

Run: `npx vitest run src/ui/kernel/ui-reducer.test.ts`
Expected: FAIL，因为 `UiState` 还没有 `inspectorTargetId`，`UiAction` 也没有 `set_inspector_target`。

- [ ] **Step 3: 最小实现 `inspectorTargetId` 状态**

```ts
// src/ui/kernel/ui-types.ts
export interface UiState {
  activePanel: MainPanel;
  inspectorTab: InspectorTab;
  colonistSort: 'name' | 'mood' | 'job';
  colonistSearch: string;
  buildSearch: string;
  notificationCenterOpen: boolean;
  pinnedColonistId: string | null;
  inspectorTargetId: string | null;
}
```

```ts
// src/ui/kernel/ui-reducer.ts
export type UiAction =
  | { type: 'open_panel'; panel: UiState['activePanel'] }
  | { type: 'set_inspector_tab'; tab: UiState['inspectorTab'] }
  | { type: 'set_colonist_sort'; sort: UiState['colonistSort'] }
  | { type: 'set_colonist_search'; value: string }
  | { type: 'set_build_search'; value: string }
  | { type: 'toggle_notification_center' }
  | { type: 'pin_colonist'; colonistId: string | null }
  | { type: 'set_inspector_target'; targetId: string | null };

export function createInitialUiState(): UiState {
  return {
    activePanel: 'colonists',
    inspectorTab: 'overview',
    colonistSort: 'name',
    colonistSearch: '',
    buildSearch: '',
    notificationCenterOpen: false,
    pinnedColonistId: null,
    inspectorTargetId: null,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    // ...
    case 'set_inspector_target':
      return { ...state, inspectorTargetId: action.targetId };
  }
}
```

- [ ] **Step 4: 再跑 reducer 测试**

Run: `npx vitest run src/ui/kernel/ui-reducer.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/kernel/ui-types.ts src/ui/kernel/ui-reducer.ts src/ui/kernel/ui-reducer.test.ts
git commit -m "feat: add inspector target ui state"
```

### Task 2: 扩展 snapshot，建立统一对象数据源

**Files:**
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Test: `src/ui/kernel/snapshot-reader.test.ts`

- [ ] **Step 1: 先写 snapshot-reader 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPresentationState } from '../../presentation/presentation-state';
import { createBlueprint, createConstructionSite } from '../../features/construction/construction.test-utils';
import { createItem } from '../../features/item/item.factory';
import { createPlant } from '../../features/plant/plant.factory';
import { readEngineSnapshot } from './snapshot-reader';

describe('readEngineSnapshot object nodes', () => {
  it('includes blueprint, construction site, item, and plant nodes for inspector consumption', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const blueprint = createBlueprint(map, {
      id: 'bp_1',
      cell: { x: 4, y: 4 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });
    const site = createConstructionSite(map, {
      id: 'site_1',
      cell: { x: 5, y: 4 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });
    const item = createItem({
      defId: 'wood',
      cell: { x: 6, y: 4 },
      mapId: map.id,
      stackCount: 10,
      defs,
    });
    const plant = createPlant({
      defId: 'tree_oak',
      cell: { x: 7, y: 4 },
      mapId: map.id,
      growth: 0.5,
    });

    map.objects.add(item);
    map.objects.add(plant);

    const snapshot = readEngineSnapshot(
      world,
      map,
      createPresentationState(),
      { recentEvents: [] },
    );

    expect(snapshot.objects?.[blueprint.id]?.kind).toBe(ObjectKind.Blueprint);
    expect(snapshot.objects?.[site.id]?.kind).toBe(ObjectKind.ConstructionSite);
    expect(snapshot.objects?.[item.id]?.kind).toBe(ObjectKind.Item);
    expect(snapshot.objects?.[plant.id]?.kind).toBe(ObjectKind.Plant);
  });
});
```

- [ ] **Step 2: 运行 snapshot-reader 测试，确认先失败**

Run: `npx vitest run src/ui/kernel/snapshot-reader.test.ts`
Expected: FAIL，因为 `EngineSnapshot` 还没有统一 `objects` 索引和新对象节点类型。

- [ ] **Step 3: 最小实现统一对象快照结构**

```ts
// src/ui/kernel/ui-types.ts
export interface ObjectNodeBase {
  id: string;
  kind: string;
  label: string;
  defId: string;
  cell: { x: number; y: number };
  footprint: { width: number; height: number };
  tags?: string[];
  destroyed?: boolean;
}

export interface BlueprintNode extends ObjectNodeBase {
  kind: 'blueprint';
  targetDefId: string;
  materialsRequired: Array<{ defId: string; count: number }>;
  materialsDelivered: Array<{ defId: string; count: number }>;
}

export interface ConstructionSiteNode extends ObjectNodeBase {
  kind: 'construction_site';
  targetDefId: string;
  buildProgress: number;
}

export interface ItemNode extends ObjectNodeBase {
  kind: 'item';
  stackCount: number;
}

export interface PlantNode extends ObjectNodeBase {
  kind: 'plant';
  growth: number;
}

export type ObjectNode =
  | ColonistNode
  | BuildingNode
  | BlueprintNode
  | ConstructionSiteNode
  | ItemNode
  | PlantNode;

export interface EngineSnapshot {
  // ...
  objects?: Record<string, ObjectNode>;
}
```

```ts
// src/ui/kernel/snapshot-reader.ts
const objects: Record<string, ObjectNode> = {};

for (const pawn of pawns) {
  const node = /* existing colonist mapping */;
  colonists[pawn.id] = node;
  objects[pawn.id] = { ...node, kind: 'pawn', label: pawn.name ?? pawn.id, defId: 'pawn' };
}

for (const building of placedBuildings) {
  const node = /* existing building mapping */;
  buildings[building.id] = node;
  objects[building.id] = { ...node, kind: 'building', tags: Array.from(building.tags) };
}

for (const blueprint of map.objects.allOfKind(ObjectKind.Blueprint)) {
  objects[blueprint.id] = {
    id: blueprint.id,
    kind: 'blueprint',
    label: `Blueprint: ${blueprint.targetDefId}`,
    defId: blueprint.defId,
    targetDefId: blueprint.targetDefId,
    cell: { x: blueprint.cell.x, y: blueprint.cell.y },
    footprint: blueprint.footprint,
    materialsRequired: blueprint.materialsRequired.map(m => ({ defId: m.defId, count: m.count })),
    materialsDelivered: blueprint.materialsDelivered.map(m => ({ defId: m.defId, count: m.count })),
    tags: Array.from(blueprint.tags),
    destroyed: blueprint.destroyed,
  };
}
```

- [ ] **Step 4: 再跑 snapshot-reader 测试**

Run: `npx vitest run src/ui/kernel/snapshot-reader.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/kernel/snapshot-reader.test.ts
git commit -m "feat: add unified object nodes to ui snapshot"
```

### Task 3: 建立统一 inspector 领域与 generic fallback

**Files:**
- Create: `src/ui/domains/inspector/inspector.types.ts`
- Create: `src/ui/domains/inspector/inspector.selectors.ts`
- Create: `src/ui/domains/inspector/components/object-inspector.tsx`
- Create: `src/ui/domains/inspector/components/object-stack-tabs.tsx`
- Create: `src/ui/domains/inspector/inspector.selectors.test.ts`
- Create: `src/ui/domains/inspector/components/object-inspector.test.tsx`

- [ ] **Step 1: 先写 selector 失败测试，覆盖同格对象切换与 generic fallback**

```ts
import { describe, expect, it } from 'vitest';
import { selectObjectInspector } from './inspector.selectors';
import type { EngineSnapshot, UiState } from '../../kernel/ui-types';

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

it('uses selection.primaryId as the default inspector target and exposes same-cell object tabs', () => {
  const snapshot = {
    selection: { primaryId: 'building_1', selectedIds: ['building_1'] },
    objects: {
      building_1: { id: 'building_1', kind: 'building', label: 'Wood Bed', defId: 'bed_wood', cell: { x: 5, y: 5 }, footprint: { width: 1, height: 2 } },
      item_1: { id: 'item_1', kind: 'item', label: 'Wood', defId: 'wood', cell: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, stackCount: 10 },
    },
  } as unknown as EngineSnapshot;

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.targetId).toBe('building_1');
  expect(vm?.stack.map(entry => entry.id)).toEqual(['building_1', 'item_1']);
});

it('shows generic fallback messaging when no specialized adapter matches', () => {
  const snapshot = {
    selection: { primaryId: 'mystery_1', selectedIds: ['mystery_1'] },
    objects: {
      mystery_1: { id: 'mystery_1', kind: 'mystery', label: 'Mystery', defId: 'mystery_def', cell: { x: 1, y: 1 }, footprint: { width: 1, height: 1 } },
    },
  } as unknown as EngineSnapshot;

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.mode).toBe('generic');
  expect(vm?.fallbackNotice).toContain('尚未实现专用 Inspector');
});
```

- [ ] **Step 2: 运行 inspector selector 测试，确认先失败**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts`
Expected: FAIL，因为 `ui/domains/inspector/` 目录尚不存在。

- [ ] **Step 3: 实现统一 selector 与 generic fallback view model**

```ts
// src/ui/domains/inspector/inspector.types.ts
export interface ObjectStackEntryViewModel {
  id: string;
  label: string;
  kind: string;
  isActive: boolean;
}

export interface GenericInspectorViewModel {
  mode: 'generic';
  targetId: string;
  title: string;
  subtitle: string;
  stack: ObjectStackEntryViewModel[];
  fallbackNotice: string;
  stats: Array<{ label: string; value: string }>;
}

export interface SpecializedInspectorViewModel {
  mode: 'specialized';
  targetId: string;
  title: string;
  subtitle: string;
  stack: ObjectStackEntryViewModel[];
  sections: Array<{ id: string; title: string; rows: Array<{ label: string; value: string }> }>;
  actions: Array<{ id: string; label: string; enabled: boolean }>;
}

export type ObjectInspectorViewModel = GenericInspectorViewModel | SpecializedInspectorViewModel;
```

```ts
// src/ui/domains/inspector/inspector.selectors.ts
export function selectObjectInspector(
  snapshot: EngineSnapshot,
  uiState: UiState,
): ObjectInspectorViewModel | null {
  const primaryId = snapshot.selection.primaryId;
  if (!primaryId || !snapshot.objects) return null;

  const primary = snapshot.objects[primaryId];
  if (!primary) return null;

  const stackObjects = Object.values(snapshot.objects)
    .filter(object => object.cell.x === primary.cell.x && object.cell.y === primary.cell.y)
    .sort(compareInspectorPriority);

  const targetId = uiState.inspectorTargetId && stackObjects.some(object => object.id === uiState.inspectorTargetId)
    ? uiState.inspectorTargetId
    : primaryId;
  const target = stackObjects.find(object => object.id === targetId)!;

  const stack = stackObjects.map(object => ({
    id: object.id,
    label: object.label,
    kind: object.kind,
    isActive: object.id === targetId,
  }));

  return {
    mode: 'generic',
    targetId,
    title: target.label,
    subtitle: target.kind,
    stack,
    fallbackNotice: '该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。',
    stats: [
      { label: 'Kind', value: target.kind },
      { label: 'Def', value: target.defId },
      { label: 'Position', value: `(${target.cell.x}, ${target.cell.y})` },
      { label: 'Size', value: `${target.footprint.width}x${target.footprint.height}` },
    ],
  };
}
```

- [ ] **Step 4: 再跑 selector 测试**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts`
Expected: PASS。

- [ ] **Step 5: 增加 generic inspector 组件测试**

```tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { ObjectInspector } from './object-inspector';

it('renders the fallback notice for generic inspectors', () => {
  render(
    <ObjectInspector
      viewModel={{
        mode: 'generic',
        targetId: 'mystery_1',
        title: 'Mystery',
        subtitle: 'mystery',
        stack: [{ id: 'mystery_1', label: 'Mystery', kind: 'mystery', isActive: true }],
        fallbackNotice: '该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。',
        stats: [{ label: 'Kind', value: 'mystery' }],
      }}
      onSelectTarget={() => {}}
      onRunAction={() => {}}
    />,
  );

  expect(screen.getByText('该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。')).toBeInTheDocument();
});
```

- [ ] **Step 6: 提交这一小步**

```bash
git add src/ui/domains/inspector/inspector.types.ts src/ui/domains/inspector/inspector.selectors.ts src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/inspector/components/object-inspector.tsx src/ui/domains/inspector/components/object-stack-tabs.tsx src/ui/domains/inspector/components/object-inspector.test.tsx
git commit -m "feat: add unified object inspector shell"
```

### Task 4: 把 Colonist 与 Building 迁移为专属 adapter

**Files:**
- Create: `src/ui/domains/inspector/adapters/pawn-inspector.adapter.ts`
- Create: `src/ui/domains/inspector/adapters/building-inspector.adapter.ts`
- Create: `src/ui/domains/inspector/adapters/inspector-adapters.ts`
- Modify: `src/ui/domains/colonist/colonist.selectors.ts`
- Modify: `src/ui/domains/building/building.selectors.ts`
- Modify: `src/ui/domains/inspector/inspector.selectors.ts`
- Test: `src/ui/domains/inspector/inspector.selectors.test.ts`

- [ ] **Step 1: 先写专属 adapter 接管测试**

```ts
it('uses the pawn adapter for pawn objects instead of generic fallback', () => {
  const snapshot = {
    selection: { primaryId: 'pawn_1', selectedIds: ['pawn_1'] },
    objects: {
      pawn_1: {
        id: 'pawn_1',
        kind: 'pawn',
        label: 'Alice',
        defId: 'pawn',
        cell: { x: 2, y: 2 },
        footprint: { width: 1, height: 1 },
        currentJobLabel: 'Idle',
        needs: { food: 60, rest: 40, joy: 70, mood: 50 },
        health: { hp: 100, maxHp: 100 },
        workDecision: null,
      },
    },
  } as unknown as EngineSnapshot;

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.mode).toBe('specialized');
  expect(vm?.title).toBe('Alice');
  expect(vm?.sections.some(section => section.title === 'Needs')).toBe(true);
});

it('uses the building adapter for buildings and keeps bed actions', () => {
  const snapshot = {
    selection: { primaryId: 'bed_1', selectedIds: ['bed_1'] },
    objects: {
      bed_1: {
        id: 'bed_1',
        kind: 'building',
        label: 'Wood Bed',
        defId: 'bed_wood',
        cell: { x: 8, y: 8 },
        footprint: { width: 1, height: 2 },
        category: 'furniture',
        usageType: 'bed',
        bed: { role: 'owned', ownerPawnId: 'Alice', occupantPawnId: null, autoAssignable: false },
      },
    },
  } as unknown as EngineSnapshot;

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.mode).toBe('specialized');
  expect(vm?.actions.map(action => action.id)).toContain('assign_bed_owner');
});
```

- [ ] **Step 2: 运行 inspector selector 测试，确认先失败**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts`
Expected: FAIL，因为 selector 目前只会回 generic fallback。

- [ ] **Step 3: 实现 Pawn / Building adapter 注册**

```ts
// src/ui/domains/inspector/adapters/inspector-adapters.ts
import type { ObjectInspectorAdapter } from '../inspector.types';
import { pawnInspectorAdapter } from './pawn-inspector.adapter';
import { buildingInspectorAdapter } from './building-inspector.adapter';

export const inspectorAdapters: ObjectInspectorAdapter[] = [
  pawnInspectorAdapter,
  buildingInspectorAdapter,
];
```

```ts
// src/ui/domains/inspector/inspector.selectors.ts
import { inspectorAdapters } from './adapters/inspector-adapters';

const adapter = inspectorAdapters.find(candidate => candidate.supports(target));
if (adapter) {
  return adapter.buildViewModel(target, {
    snapshot,
    stack,
    targetId,
  });
}
```

```ts
// src/ui/domains/inspector/adapters/pawn-inspector.adapter.ts
export const pawnInspectorAdapter: ObjectInspectorAdapter = {
  id: 'pawn',
  supports(object) {
    return object.kind === 'pawn';
  },
  buildViewModel(object, context) {
    return {
      mode: 'specialized',
      targetId: object.id,
      title: object.label,
      subtitle: 'Pawn',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          rows: [
            { label: 'Job', value: object.currentJobLabel },
            { label: 'HP', value: `${object.health.hp}/${object.health.maxHp}` },
          ],
        },
        {
          id: 'needs',
          title: 'Needs',
          rows: [
            { label: 'Food', value: String(object.needs.food) },
            { label: 'Rest', value: String(object.needs.rest) },
            { label: 'Joy', value: String(object.needs.joy) },
            { label: 'Mood', value: String(object.needs.mood) },
          ],
        },
      ],
      actions: [],
    };
  },
};
```

- [ ] **Step 4: 再跑 inspector selector 测试**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/domains/inspector/adapters/pawn-inspector.adapter.ts src/ui/domains/inspector/adapters/building-inspector.adapter.ts src/ui/domains/inspector/adapters/inspector-adapters.ts src/ui/domains/inspector/inspector.selectors.ts src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/colonist/colonist.selectors.ts src/ui/domains/building/building.selectors.ts
git commit -m "refactor: migrate pawn and building into object inspector adapters"
```

### Task 5: 接入 Blueprint / ConstructionSite / Item / Plant / Rock 第一批对象

**Files:**
- Create: `src/ui/domains/inspector/adapters/blueprint-inspector.adapter.ts`
- Create: `src/ui/domains/inspector/adapters/construction-site-inspector.adapter.ts`
- Create: `src/ui/domains/inspector/adapters/item-inspector.adapter.ts`
- Create: `src/ui/domains/inspector/adapters/plant-inspector.adapter.ts`
- Create: `src/ui/domains/inspector/adapters/rock-inspector.adapter.ts`
- Modify: `src/ui/domains/inspector/adapters/inspector-adapters.ts`
- Test: `src/ui/domains/inspector/inspector.selectors.test.ts`

- [ ] **Step 1: 先写第一批对象专属 inspector 测试**

```ts
it('uses the blueprint adapter and exposes cancel_construction action', () => {
  const snapshot = {
    selection: { primaryId: 'bp_1', selectedIds: ['bp_1'] },
    objects: {
      bp_1: {
        id: 'bp_1',
        kind: 'blueprint',
        label: 'Blueprint: bed_wood',
        defId: 'blueprint_bed_wood',
        targetDefId: 'bed_wood',
        cell: { x: 4, y: 4 },
        footprint: { width: 1, height: 2 },
        materialsRequired: [{ defId: 'wood', count: 10 }],
        materialsDelivered: [{ defId: 'wood', count: 4 }],
      },
    },
  } as unknown as EngineSnapshot;

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.mode).toBe('specialized');
  expect(vm?.actions.map(action => action.id)).toContain('cancel_construction');
});

it('uses the item adapter instead of generic fallback', () => {
  const snapshot = {
    selection: { primaryId: 'item_1', selectedIds: ['item_1'] },
    objects: {
      item_1: {
        id: 'item_1',
        kind: 'item',
        label: 'Wood',
        defId: 'wood',
        cell: { x: 5, y: 5 },
        footprint: { width: 1, height: 1 },
        stackCount: 15,
      },
    },
  } as unknown as EngineSnapshot;

  const vm = selectObjectInspector(snapshot, makeUiState());
  expect(vm?.mode).toBe('specialized');
  expect(vm?.sections.some(section => section.title === 'Overview')).toBe(true);
});
```

- [ ] **Step 2: 运行 selector 测试，确认先失败**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts`
Expected: FAIL，因为第一批对象 adapter 还没注册。

- [ ] **Step 3: 最小实现第一批对象 adapter**

```ts
// src/ui/domains/inspector/adapters/blueprint-inspector.adapter.ts
export const blueprintInspectorAdapter: ObjectInspectorAdapter = {
  id: 'blueprint',
  supports(object) {
    return object.kind === 'blueprint';
  },
  buildViewModel(object, context) {
    return {
      mode: 'specialized',
      targetId: object.id,
      title: object.label,
      subtitle: 'Blueprint',
      stack: context.stack,
      sections: [
        {
          id: 'materials',
          title: 'Materials',
          rows: object.materialsRequired.map((required, index) => ({
            label: required.defId,
            value: `${object.materialsDelivered[index]?.count ?? 0}/${required.count}`,
          })),
        },
      ],
      actions: [
        { id: 'cancel_construction', label: 'Cancel Construction', enabled: true },
      ],
    };
  },
};
```

```ts
// src/ui/domains/inspector/adapters/inspector-adapters.ts
export const inspectorAdapters: ObjectInspectorAdapter[] = [
  pawnInspectorAdapter,
  blueprintInspectorAdapter,
  constructionSiteInspectorAdapter,
  buildingInspectorAdapter,
  itemInspectorAdapter,
  plantInspectorAdapter,
  rockInspectorAdapter,
];
```

- [ ] **Step 4: 再跑 selector 测试**

Run: `npx vitest run src/ui/domains/inspector/inspector.selectors.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/domains/inspector/adapters/blueprint-inspector.adapter.ts src/ui/domains/inspector/adapters/construction-site-inspector.adapter.ts src/ui/domains/inspector/adapters/item-inspector.adapter.ts src/ui/domains/inspector/adapters/plant-inspector.adapter.ts src/ui/domains/inspector/adapters/rock-inspector.adapter.ts src/ui/domains/inspector/adapters/inspector-adapters.ts src/ui/domains/inspector/inspector.selectors.test.ts
git commit -m "feat: add first wave of object inspector adapters"
```

### Task 6: 将 `app-shell` 迁移到统一 Object Inspector

**Files:**
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/app/app-shell.test.tsx`
- Modify: `src/ui/kernel/ui-ports.ts`
- Modify: `src/ui/domains/inspector/components/object-inspector.tsx`

- [ ] **Step 1: 先写 `app-shell` 失败测试**

```tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

it('renders the unified object inspector instead of separate colonist/building panels', () => {
  const snapshot = {
    tick: 1,
    speed: 1,
    clockDisplay: 'Day 1, 00:00',
    colonistCount: 1,
    presentation: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, activeBuildDefId: null, hoveredCell: null, selectedIds: ['pawn_1'], showDebugPanel: false, showGrid: false },
    selection: { primaryId: 'pawn_1', selectedIds: ['pawn_1'] },
    colonists: {},
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
    build: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, lastZoneType: 'stockpile', activeBuildDefId: null, activeModeLabel: 'Select' },
    feedback: { recentEvents: [] },
    debugInfo: '',
  } as any;

  const uiState = {
    activePanel: 'colonists',
    inspectorTab: 'overview',
    colonistSort: 'name',
    colonistSearch: '',
    buildSearch: '',
    notificationCenterOpen: false,
    pinnedColonistId: null,
    inspectorTargetId: null,
  } as any;

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
  expect(screen.getByText('Alice')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行 `app-shell` 测试，确认先失败**

Run: `npx vitest run src/ui/app/app-shell.test.tsx`
Expected: FAIL，因为 `AppShell` 仍在单独走 colonist/building selector 分支。

- [ ] **Step 3: 迁移 `app-shell` 到统一 Object Inspector**

```tsx
// src/ui/app/app-shell.tsx
import { selectObjectInspector } from '../domains/inspector/inspector.selectors';
import { ObjectInspector } from '../domains/inspector/components/object-inspector';

export function AppShell({ snapshot, uiState, dispatch, ports }: AppShellProps) {
  if (!snapshot || !uiState || !dispatch || !ports) {
    return (
      <div class="app-shell" data-testid="app-shell">
        <header>Opus UI</header>
      </div>
    );
  }

  const topBar = selectTopStatusBar(snapshot);
  const activeToolId = selectActiveToolId(snapshot);
  const rosterRows = selectColonistRosterRows(snapshot, uiState);
  const objectInspector = selectObjectInspector(snapshot, uiState);
  const feedback = selectCommandFeedback(snapshot);
  const debugInfo = selectDebugInfo(snapshot);
  const showDebug = selectShowDebugPanel(snapshot);

  return (
    <div class="app-shell" data-testid="app-shell">
      <TopStatusBar viewModel={topBar} onSetSpeed={(speed) => ports.setSpeed(speed)} />
      <ColonistRoster rows={rosterRows} activeId={snapshot.selection.primaryId} onSelect={(id) => ports.selectColonist(id)} />
      {objectInspector && (
        <ObjectInspector
          viewModel={objectInspector}
          onSelectTarget={(targetId) => dispatch({ type: 'set_inspector_target', targetId })}
          onRunAction={(actionId, targetId) => {
            if (actionId === 'clear_bed_owner') ports.clearBedOwner(targetId);
          }}
        />
      )}
      <ToastStack toasts={feedback.toasts} />
      <DebugPanel visible={showDebug} debugInfo={debugInfo} />
      <ToolModeBar activeToolId={activeToolId} activeTool={snapshot.presentation.activeTool} onActivate={(action) => activateToolAction(ports, action)} />
    </div>
  );
}
```

- [ ] **Step 4: 再跑 `app-shell` 测试**

Run: `npx vitest run src/ui/app/app-shell.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/app/app-shell.tsx src/ui/app/app-shell.test.tsx src/ui/domains/inspector/components/object-inspector.tsx src/ui/kernel/ui-ports.ts
git commit -m "refactor: route ui through unified object inspector"
```

### Task 7: 运行聚焦验证

**Files:**
- Modify: none
- Test: `src/ui/kernel/ui-reducer.test.ts`
- Test: `src/ui/kernel/snapshot-reader.test.ts`
- Test: `src/ui/domains/inspector/inspector.selectors.test.ts`
- Test: `src/ui/domains/inspector/components/object-inspector.test.tsx`
- Test: `src/ui/app/app-shell.test.tsx`

- [ ] **Step 1: 运行聚焦测试集**

Run: `npx vitest run src/ui/kernel/ui-reducer.test.ts src/ui/kernel/snapshot-reader.test.ts src/ui/domains/inspector/inspector.selectors.test.ts src/ui/domains/inspector/components/object-inspector.test.tsx src/ui/app/app-shell.test.tsx`
Expected: PASS。

- [ ] **Step 2: 运行完整类型检查**

Run: `npx tsc --noEmit`
Expected: PASS。

- [ ] **Step 3: 检查工作区状态**

Run: `git status --short`
Expected: clean working tree。

---

## 覆盖检查

- `inspectorTargetId` 与主选中对象分离：Task 1。
- 统一对象快照与第一批对象节点输入：Task 2。
- 统一 Inspector 容器、同格对象栈、generic fallback：Task 3。
- generic fallback 明确提示“缺少专用 Inspector”：Task 3。
- Pawn / Building adapter 迁移：Task 4。
- Blueprint / ConstructionSite / Item / Plant / Rock 第一批对象接入：Task 5。
- `app-shell` 从多路 inspector 分支迁移到统一入口：Task 6。
- 聚焦验证与类型检查：Task 7。
