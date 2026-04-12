# 建筑放置占地冲突校验与预览反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为建筑蓝图放置补齐占地冲突校验，并让建造预览在悬停阶段复用同一套规则显示 blocked 反馈。

**Architecture:** 在 `features/construction` 内提取共享 placement 判定函数，统一解释 footprint 命中对象里哪些属于建造冲突。`place_blueprint.validate()` 和 `adapter/input` 的预览更新都调用这套共享判定，`world-preview` 继续只消费 `placementPreview.valid` 做视觉反馈，不在渲染层复制业务规则。

**Tech Stack:** TypeScript、Phaser、Preact 展示态、Vitest、现有 command bus / presentation state / occupancy 查询

---

## 文件结构与职责

- `src/features/construction/construction.placement.ts`
  - 新增共享建造放置判定。
  - 负责把 footprint 命中对象解释为“可放置 / 不可放置”。
- `src/features/construction/construction.commands.ts`
  - `place_blueprint.validate()` 接入共享 placement 判定。
- `src/features/construction/construction.placement.test.ts`
  - 覆盖共享 placement 判定的对象筛选规则。
- `src/features/construction/construction.commands.test.ts`
  - 覆盖 command validate 的重叠放置拒绝行为。
- `src/adapter/input/input-handler.ts`
  - 建造预览接入共享 placement 判定，而不是只看 `map.spatial.isPassable(cell)`。
- `src/adapter/render/world-preview.test.ts`
  - 验证 blocked preview 仍通过 `placementPreview.valid = false` 正确走红色预览渲染。

---

### Task 1: 提取共享 placement 判定

**Files:**
- Create: `src/features/construction/construction.placement.ts`
- Test: `src/features/construction/construction.placement.test.ts`

- [ ] **Step 1: 先写共享判定的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createBuilding } from '../building/building.factory';
import { createBlueprint, createConstructionSite } from './construction.test-utils';
import { analyzeBuildingPlacement } from './construction.placement';

describe('analyzeBuildingPlacement', () => {
  it('把蓝图、工地、建筑视为 blocking object', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const blueprint = createBlueprint(map, {
      id: 'bp_1',
      cell: { x: 4, y: 4 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });
    const site = createConstructionSite(map, {
      id: 'site_1',
      cell: { x: 6, y: 4 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });
    const building = createBuilding({
      defId: 'bed_wood',
      cell: { x: 8, y: 4 },
      mapId: map.id,
      defs,
    });
    map.objects.add(building);

    expect(analyzeBuildingPlacement(map, { x: 4, y: 4 }, { width: 1, height: 1 }).blocked).toBe(true);
    expect(analyzeBuildingPlacement(map, { x: 6, y: 4 }, { width: 1, height: 1 }).blocked).toBe(true);
    expect(analyzeBuildingPlacement(map, { x: 8, y: 4 }, { width: 1, height: 2 }).blocked).toBe(true);
  });

  it('忽略 pawn 与 item，不把它们当成放置冲突', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 2 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 3, y: 3 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    const item = createItem({
      defId: 'wood',
      cell: { x: 5, y: 5 },
      mapId: map.id,
      stackCount: 5,
      defs,
    });
    map.objects.add(pawn);
    map.objects.add(item);

    expect(analyzeBuildingPlacement(map, { x: 3, y: 3 }, { width: 1, height: 1 }).blocked).toBe(false);
    expect(analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 1, height: 1 }).blocked).toBe(false);
  });

  it('多格 footprint 任一格冲突时整体 blocked', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 3 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    createBlueprint(map, {
      id: 'bp_2',
      cell: { x: 5, y: 6 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });

    const result = analyzeBuildingPlacement(map, { x: 5, y: 5 }, { width: 2, height: 2 });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('occupied_by_construction_or_building');
    expect(result.blockingObjects.map(obj => obj.id)).toContain('bp_2');
  });
});
```

- [ ] **Step 2: 运行测试，确认它们先失败**

Run: `npx vitest run src/features/construction/construction.placement.test.ts`
Expected: FAIL，提示 `construction.placement.ts` 或 `analyzeBuildingPlacement` 尚不存在。

- [ ] **Step 3: 实现最小共享 placement 判定**

```ts
import { ObjectKind } from '../../core/types';
import type { Footprint, CellCoord, MapObjectBase } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import { getObjectsInFootprint } from '../../world/occupancy';

export type BuildingPlacementBlockReason = 'occupied_by_construction_or_building';

export interface BuildingPlacementAnalysis {
  blocked: boolean;
  blockingObjects: MapObjectBase[];
  reason: BuildingPlacementBlockReason | null;
}

function isBlockingPlacementObject(obj: MapObjectBase): boolean {
  return obj.kind === ObjectKind.Blueprint
    || obj.kind === ObjectKind.ConstructionSite
    || obj.kind === ObjectKind.Building;
}

export function analyzeBuildingPlacement(
  map: GameMap,
  cell: CellCoord,
  footprint: Footprint,
): BuildingPlacementAnalysis {
  const blockingObjects = getObjectsInFootprint(map, cell, footprint)
    .filter(isBlockingPlacementObject);

  if (blockingObjects.length > 0) {
    return {
      blocked: true,
      blockingObjects,
      reason: 'occupied_by_construction_or_building',
    };
  }

  return {
    blocked: false,
    blockingObjects: [],
    reason: null,
  };
}
```

- [ ] **Step 4: 再跑一次共享判定测试**

Run: `npx vitest run src/features/construction/construction.placement.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/features/construction/construction.placement.ts src/features/construction/construction.placement.test.ts
git commit -m "feat: add shared building placement analysis"
```

### Task 2: 让 `place_blueprint.validate()` 使用共享 placement 判定

**Files:**
- Modify: `src/features/construction/construction.commands.ts`
- Modify: `src/features/construction/construction.commands.test.ts`

- [ ] **Step 1: 先写 validate 层失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createBuilding } from '../building/building.factory';
import { createBlueprint, createConstructionSite } from './construction.test-utils';
import { placeBlueprintHandler } from './construction.commands';

describe('placeBlueprintHandler.validate occupancy', () => {
  it('已有蓝图时拒绝放置', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 11 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);
    createBlueprint(map, {
      id: 'bp_overlap',
      cell: { x: 4, y: 4 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });

    const result = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 4, y: 4 } },
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('已有工地时拒绝放置', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);
    createConstructionSite(map, {
      id: 'site_overlap',
      cell: { x: 5, y: 4 },
      footprint: { width: 1, height: 1 },
      targetDefId: 'wall_wood',
    });

    const result = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 5, y: 4 } },
    });

    expect(result.valid).toBe(false);
  });

  it('已有建筑时拒绝放置，但 pawn 与 item 不阻止', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 13 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 7, y: 4 },
      mapId: map.id,
      defs,
    });
    const pawn = createPawn({
      name: 'Bob',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    const item = createItem({
      defId: 'wood',
      cell: { x: 3, y: 3 },
      mapId: map.id,
      stackCount: 3,
      defs,
    });
    map.objects.add(bed);
    map.objects.add(pawn);
    map.objects.add(item);

    const blocked = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'bed_wood', cell: { x: 7, y: 4 } },
    });
    const allowedOnPawn = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 2, y: 2 } },
    });
    const allowedOnItem = placeBlueprintHandler.validate(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 3, y: 3 } },
    });

    expect(blocked.valid).toBe(false);
    expect(allowedOnPawn.valid).toBe(true);
    expect(allowedOnItem.valid).toBe(true);
  });
});
```

- [ ] **Step 2: 运行 construction command 测试**

Run: `npx vitest run src/features/construction/construction.commands.test.ts`
Expected: FAIL，新增用例会暴露 `place_blueprint.validate()` 还没有检查蓝图 / 工地 / 建筑冲突。

- [ ] **Step 3: 在命令校验中接入共享 placement 判定**

```ts
import { analyzeBuildingPlacement } from './construction.placement';

validate(world: World, cmd: Command) {
  const { defId, cell } = cmd.payload as {
    defId: DefId;
    cell: CellCoord;
    mapId?: MapId;
  };

  const mapId = (cmd.payload.mapId as string) ?? world.maps.keys().next().value;
  const map = world.maps.get(mapId);
  if (!map) {
    return { valid: false, reason: `Map ${mapId} not found` };
  }

  const buildingDef = world.defs.buildings.get(defId);
  if (!buildingDef) {
    return { valid: false, reason: `Building def ${defId} not found` };
  }

  const c = cell as CellCoord;
  const size = buildingDef.size;
  for (let dy = 0; dy < size.height; dy++) {
    for (let dx = 0; dx < size.width; dx++) {
      const checkCell = { x: c.x + dx, y: c.y + dy };
      if (!map.terrain.inBounds(checkCell.x, checkCell.y)) {
        return { valid: false, reason: `Cell (${checkCell.x},${checkCell.y}) out of bounds` };
      }
    }
  }

  const placement = analyzeBuildingPlacement(map, c, size);
  if (placement.blocked) {
    return { valid: false, reason: 'Footprint occupied by blueprint, construction site, or building' };
  }

  return { valid: true };
}
```

- [ ] **Step 4: 再跑 command 测试**

Run: `npx vitest run src/features/construction/construction.commands.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/features/construction/construction.commands.ts src/features/construction/construction.commands.test.ts
git commit -m "fix: reject overlapping blueprint placement"
```

### Task 3: 让建造预览复用共享 placement 判定

**Files:**
- Modify: `src/adapter/input/input-handler.ts`
- Modify: `src/presentation/presentation-state.ts`

- [ ] **Step 1: 先写一个最小的预览接入测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from '../../features/building/building.factory';
import { createPresentationState, ToolType } from '../../presentation/presentation-state';
import { InputHandler } from './input-handler';

describe('InputHandler build preview placement validity', () => {
  it('已有建筑占地时把 placementPreview 标记为 invalid', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 21 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 6, y: 6 },
      mapId: map.id,
      defs,
    });
    map.objects.add(bed);

    const presentation = createPresentationState();
    presentation.activeTool = ToolType.Build;
    presentation.activeBuildDefId = 'bed_wood';
    presentation.hoveredCell = { x: 6, y: 6 };

    const scene = { input: { activePointer: {} as any, on: () => {} } } as any;
    const handler = new InputHandler(scene, world, map, presentation);
    (handler as any).presentation.hoveredCell = { x: 6, y: 6 };

    handler.update();

    expect(presentation.placementPreview?.valid).toBe(false);
    expect(presentation.placementPreview?.footprint).toEqual({ width: 1, height: 2 });
  });
});
```

- [ ] **Step 2: 运行预览相关测试，确认先失败**

Run: `npx vitest run src/adapter/render/world-preview.test.ts`
Expected: 现有 `world-preview` 测试仍通过，但新的输入层测试还不存在，且 `input-handler.ts` 当前仅用 `map.spatial.isPassable(cell)`，还不能表达 footprint 冲突。

- [ ] **Step 3: 在输入层复用共享 placement 判定**

```ts
import { analyzeBuildingPlacement } from '../../features/construction/construction.placement';

update(): void {
  const pointer = this.scene.input.activePointer;
  this.presentation.hoveredCell = this.pointerToCell(pointer);

  if (this.presentation.activeTool === ToolType.Build && this.presentation.activeBuildDefId && this.presentation.hoveredCell) {
    const cell = this.presentation.hoveredCell;
    const footprint = this.world.defs.buildings.get(this.presentation.activeBuildDefId)?.size ?? { width: 1, height: 1 };
    const inBounds = (
      cell.x >= 0
      && cell.y >= 0
      && cell.x + footprint.width - 1 < this.map.width
      && cell.y + footprint.height - 1 < this.map.height
    );
    const placement = inBounds
      ? analyzeBuildingPlacement(this.map, cell, footprint)
      : { blocked: true };

    this.presentation.placementPreview = {
      defId: this.presentation.activeBuildDefId,
      cell,
      footprint,
      rotation: 0,
      valid: inBounds && !placement.blocked,
    };
  } else {
    this.presentation.placementPreview = null;
  }

  // 其余 preview 逻辑保持不变
}
```

- [ ] **Step 4: 补一个 blocked preview 渲染测试**

```ts
it('renders invalid build previews in red when placementPreview.valid is false', () => {
  const rectangles: FakeRectangle[] = [];
  const scene = {
    add: {
      rectangle: (_x: number, _y: number, width: number, height: number, fillColor: number, fillAlpha: number) => {
        const rectangle = new FakeRectangle(width, height, fillColor, fillAlpha);
        rectangles.push(rectangle);
        return rectangle;
      },
      graphics: () => new FakeGraphics(),
    },
  } as any;

  const preview = new WorldPreview(scene);
  const presentation = makePresentationState();
  presentation.placementPreview = {
    defId: 'bed_wood',
    cell: { x: 10, y: 12 },
    footprint: { width: 1, height: 2 },
    rotation: Rotation.North,
    valid: false,
  };

  preview.update(presentation);

  expect(rectangles[0].fillColor).toBe(0xff0000);
  expect(rectangles[0].strokeColor).toBe(0xff0000);
});
```

- [ ] **Step 5: 跑预览相关测试**

Run: `npx vitest run src/adapter/render/world-preview.test.ts`
Expected: PASS，红色 blocked preview 仍正确渲染。

- [ ] **Step 6: 提交这一小步**

```bash
git add src/adapter/input/input-handler.ts src/adapter/render/world-preview.test.ts src/presentation/presentation-state.ts
git commit -m "feat: add blocked feedback to build preview"
```

### Task 4: 补多格 footprint 和输入边界测试

**Files:**
- Modify: `src/features/construction/construction.commands.test.ts`
- Modify: `src/features/construction/construction.placement.test.ts`

- [ ] **Step 1: 先写多格建筑 footprint 冲突测试**

```ts
it('多格建筑只要 footprint 任一格重叠就拒绝放置', () => {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 31 });
  const map = createGameMap({ id: 'main', width: 16, height: 16 });
  world.maps.set(map.id, map);

  createBlueprint(map, {
    id: 'bp_multi',
    cell: { x: 9, y: 10 },
    footprint: { width: 1, height: 1 },
    targetDefId: 'wall_wood',
  });

  const result = placeBlueprintHandler.validate(world, {
    type: 'place_blueprint',
    payload: { defId: 'bed_wood', cell: { x: 9, y: 9 } },
  });

  expect(result.valid).toBe(false);
});
```

- [ ] **Step 2: 运行 placement + command 测试**

Run: `npx vitest run src/features/construction/construction.placement.test.ts src/features/construction/construction.commands.test.ts`
Expected: PASS，如果失败则说明 footprint 遍历或 building def.size 接线有误。

- [ ] **Step 3: 提交这一小步**

```bash
git add src/features/construction/construction.placement.test.ts src/features/construction/construction.commands.test.ts
git commit -m "test: cover multi-cell placement blocking"
```

### Task 5: 运行聚焦验证

**Files:**
- Modify: none
- Test: `src/features/construction/construction.placement.test.ts`
- Test: `src/features/construction/construction.commands.test.ts`
- Test: `src/adapter/render/world-preview.test.ts`

- [ ] **Step 1: 运行聚焦测试集**

Run: `npx vitest run src/features/construction/construction.placement.test.ts src/features/construction/construction.commands.test.ts src/adapter/render/world-preview.test.ts`
Expected: PASS。

- [ ] **Step 2: 运行完整类型检查**

Run: `npx tsc --noEmit`
Expected: PASS。

- [ ] **Step 3: 检查工作区是否干净**

Run: `git status --short`
Expected: clean working tree。

---

## 覆盖检查

- 共享 placement 判定与 blocking object 筛选：Task 1。
- command validate 拒绝蓝图 / 工地 / 建筑重叠放置：Task 2。
- Pawn / Item 不阻止放置：Task 1 + Task 2。
- 预览复用同一套 placement 判定并显示 blocked：Task 3。
- 多格 footprint 任一格冲突即整体 blocked：Task 1 + Task 4。
- 最终验证与类型检查：Task 5。
