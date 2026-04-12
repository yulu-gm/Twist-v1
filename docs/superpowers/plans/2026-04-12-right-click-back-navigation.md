# 右键返回导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为地图交互接入右键“返回/取消”机制，拦截浏览器菜单，并通过返回栈按进入顺序回退工具模式与选中/inspector 状态。

**Architecture:** 在 `presentation-state` 中新增稳定交互状态快照与返回栈辅助函数，所有会改变稳定交互状态的入口统一走该 API；`input-handler` 负责接管右键与 `contextmenu`，在右键时先取消拖拽和临时预览，再恢复返回栈顶层状态。测试分为状态层单元测试和输入层交互测试，确保左键现有行为不回归。

**Tech Stack:** TypeScript、Phaser 3、Preact、Vitest

---

## 文件结构

### 需要修改

- `src/presentation/presentation-state.ts`
  - 新增 `PresentationBackEntry`
  - 为 `PresentationState` 增加 `backStack`
  - 提供稳定状态快照、压栈、恢复、清理临时交互状态的统一函数
- `src/adapter/input/input-handler.ts`
  - 注册右键监听
  - 为 Phaser canvas 绑定 `contextmenu` 拦截
  - 新增 `handleBackAction()` 与拖拽取消逻辑
- `src/main.ts`
  - `selectObjects()`、`selectColonist()`、`setTool()` 改为走新的 presentation 状态变更 API
- `src/adapter/render/world-preview.test.ts`
  - 补齐 `PresentationState` 新字段，保证现有测试可编译

### 需要新建

- `src/presentation/presentation-state.test.ts`
  - 验证压栈、去重、恢复、临时状态清理规则
- `src/adapter/input/input-handler.test.ts`
  - 验证右键返回、拖拽中断、栈空安全行为

---

### Task 1: 扩展 PresentationState 返回栈模型

**Files:**
- Modify: `src/presentation/presentation-state.ts`
- Test: `src/presentation/presentation-state.test.ts`

- [ ] **Step 1: 写出返回栈状态层的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import {
  ToolType,
  createPresentationState,
  applyToolSelection,
  applyObjectSelection,
  popBackNavigation,
} from './presentation-state';

describe('presentation-state back navigation', () => {
  it('pushes previous select state when entering build mode', () => {
    const presentation = createPresentationState();

    applyToolSelection(presentation, {
      tool: ToolType.Build,
      buildDefId: 'bed_wood',
    });

    expect(presentation.backStack).toHaveLength(1);
    expect(presentation.backStack[0].activeTool).toBe(ToolType.Select);
    expect(presentation.activeTool).toBe(ToolType.Build);
    expect(presentation.activeBuildDefId).toBe('bed_wood');
  });

  it('pushes selection entry only when selection changes from empty to non-empty', () => {
    const presentation = createPresentationState();

    applyObjectSelection(presentation, ['pawn_1']);
    applyObjectSelection(presentation, ['pawn_2']);

    expect(presentation.backStack).toHaveLength(1);
    expect(Array.from(presentation.selectedObjectIds)).toEqual(['pawn_2']);
  });

  it('restores previous stable state and clears transient previews on pop', () => {
    const presentation = createPresentationState();

    applyObjectSelection(presentation, ['pawn_1']);
    applyToolSelection(presentation, {
      tool: ToolType.Build,
      buildDefId: 'bed_wood',
    });

    presentation.hoveredCell = { x: 4, y: 5 };
    presentation.placementPreview = {
      defId: 'bed_wood',
      cell: { x: 4, y: 5 },
      footprint: { width: 1, height: 2 },
      rotation: 0,
      valid: true,
    };
    presentation.dragRect = {
      startCell: { x: 4, y: 5 },
      endCell: { x: 6, y: 7 },
    };

    const popped = popBackNavigation(presentation);

    expect(popped).toBe(true);
    expect(presentation.activeTool).toBe(ToolType.Select);
    expect(Array.from(presentation.selectedObjectIds)).toEqual(['pawn_1']);
    expect(presentation.placementPreview).toBeNull();
    expect(presentation.designationPreview).toBeNull();
    expect(presentation.zonePreview).toBeNull();
    expect(presentation.dragRect).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/presentation/presentation-state.test.ts`

Expected: FAIL，报错包含以下之一：

- `Cannot find module './presentation-state.test.ts'`
- `applyToolSelection is not exported`
- `Property 'backStack' does not exist`

- [ ] **Step 3: 在 `presentation-state.ts` 中实现返回栈与统一状态 API**

```ts
export interface PresentationBackEntry {
  activeTool: ToolType;
  activeDesignationType: DesignationType | null;
  activeZoneType: ZoneType | null;
  activeBuildDefId: DefId | null;
  selectedObjectIds: ObjectId[];
}

export interface ToolSelectionOptions {
  tool: ToolType;
  designationType?: DesignationType | null;
  zoneType?: ZoneType | null;
  buildDefId?: DefId | null;
}

function captureBackEntry(presentation: PresentationState): PresentationBackEntry {
  return {
    activeTool: presentation.activeTool,
    activeDesignationType: presentation.activeDesignationType,
    activeZoneType: presentation.activeZoneType,
    activeBuildDefId: presentation.activeBuildDefId,
    selectedObjectIds: Array.from(presentation.selectedObjectIds),
  };
}

function isSameBackEntry(a: PresentationBackEntry, b: PresentationBackEntry): boolean {
  if (a.activeTool !== b.activeTool) return false;
  if (a.activeDesignationType !== b.activeDesignationType) return false;
  if (a.activeZoneType !== b.activeZoneType) return false;
  if (a.activeBuildDefId !== b.activeBuildDefId) return false;
  if (a.selectedObjectIds.length !== b.selectedObjectIds.length) return false;

  for (let i = 0; i < a.selectedObjectIds.length; i++) {
    if (a.selectedObjectIds[i] !== b.selectedObjectIds[i]) return false;
  }

  return true;
}

export function clearTransientInteractionState(presentation: PresentationState): void {
  presentation.hoveredCell = null;
  presentation.placementPreview = null;
  presentation.designationPreview = null;
  presentation.zonePreview = null;
  presentation.dragRect = null;
}

function pushBackEntryIfNeeded(presentation: PresentationState): void {
  const entry = captureBackEntry(presentation);
  const top = presentation.backStack[presentation.backStack.length - 1];
  if (top && isSameBackEntry(top, entry)) return;
  presentation.backStack.push(entry);
}

function shouldPushForToolSelection(
  presentation: PresentationState,
  next: ToolSelectionOptions,
): boolean {
  if (presentation.activeTool !== next.tool) return true;
  if (next.tool === ToolType.Build && presentation.activeBuildDefId !== (next.buildDefId ?? null)) return true;
  if (next.tool === ToolType.Designate && presentation.activeDesignationType !== (next.designationType ?? null)) return true;
  if (next.tool === ToolType.Zone && presentation.activeZoneType !== (next.zoneType ?? null)) return true;
  return false;
}

export function applyToolSelection(
  presentation: PresentationState,
  next: ToolSelectionOptions,
): void {
  if (shouldPushForToolSelection(presentation, next)) {
    pushBackEntryIfNeeded(presentation);
  }

  presentation.activeTool = next.tool;
  presentation.activeDesignationType = next.tool === ToolType.Designate ? (next.designationType ?? null) : null;
  presentation.activeZoneType = next.tool === ToolType.Zone ? (next.zoneType ?? null) : null;
  presentation.activeBuildDefId = next.tool === ToolType.Build ? (next.buildDefId ?? null) : null;

  if (next.tool === ToolType.Zone && next.zoneType) {
    presentation.lastZoneType = next.zoneType;
  }

  if (next.tool !== ToolType.Select) {
    presentation.selectedObjectIds.clear();
  }

  clearTransientInteractionState(presentation);
}

export function applyObjectSelection(
  presentation: PresentationState,
  ids: ObjectId[],
): void {
  const hadSelection = presentation.selectedObjectIds.size > 0;
  const willHaveSelection = ids.length > 0;

  if (presentation.activeTool !== ToolType.Select) {
    pushBackEntryIfNeeded(presentation);
    presentation.activeTool = ToolType.Select;
    presentation.activeDesignationType = null;
    presentation.activeZoneType = null;
    presentation.activeBuildDefId = null;
  } else if (!hadSelection && willHaveSelection) {
    pushBackEntryIfNeeded(presentation);
  }

  presentation.selectedObjectIds.clear();
  for (const id of ids) presentation.selectedObjectIds.add(id);
  clearTransientInteractionState(presentation);
}

export function popBackNavigation(presentation: PresentationState): boolean {
  const entry = presentation.backStack.pop();
  if (!entry) {
    clearTransientInteractionState(presentation);
    return false;
  }

  presentation.activeTool = entry.activeTool;
  presentation.activeDesignationType = entry.activeDesignationType;
  presentation.activeZoneType = entry.activeZoneType;
  presentation.activeBuildDefId = entry.activeBuildDefId;
  presentation.selectedObjectIds = new Set(entry.selectedObjectIds);
  clearTransientInteractionState(presentation);
  return true;
}
```

- [ ] **Step 4: 更新 `createPresentationState()` 与兼容调用点**

```ts
export interface PresentationState {
  selectedObjectIds: Set<ObjectId>;
  hoveredCell: CellCoord | null;
  placementPreview: PlacementPreview | null;
  designationPreview: DesignationPreview | null;
  activeOverlay: OverlayType;
  cameraPosition: { x: number; y: number };
  cameraZoom: number;
  activeTool: ToolType;
  activeDesignationType: DesignationType | null;
  activeZoneType: ZoneType | null;
  lastZoneType: ZoneType;
  activeBuildDefId: DefId | null;
  showDebugPanel: boolean;
  showGrid: boolean;
  dragRect: { startCell: CellCoord; endCell: CellCoord } | null;
  zonePreview: ZonePreview | null;
  backStack: PresentationBackEntry[];
}

export function createPresentationState(): PresentationState {
  return {
    selectedObjectIds: new Set(),
    hoveredCell: null,
    placementPreview: null,
    designationPreview: null,
    activeOverlay: OverlayType.None,
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: ToolType.Select,
    activeDesignationType: null,
    activeZoneType: null,
    lastZoneType: ZoneType.Stockpile,
    activeBuildDefId: null,
    showDebugPanel: false,
    showGrid: false,
    dragRect: null,
    zonePreview: null,
    backStack: [],
  };
}
```

- [ ] **Step 5: 运行状态层测试并确认通过**

Run: `npx vitest run src/presentation/presentation-state.test.ts`

Expected: PASS，至少包含：

- `3 passed`

- [ ] **Step 6: 提交状态层改动**

```bash
git add src/presentation/presentation-state.ts src/presentation/presentation-state.test.ts
git commit -m "feat: add presentation back navigation state"
```

---

### Task 2: 统一 UI 与主入口对稳定交互状态的写入

**Files:**
- Modify: `src/main.ts`
- Test: `src/presentation/presentation-state.test.ts`

- [ ] **Step 1: 先补一条覆盖主入口使用方式的失败测试**

```ts
it('pushes current selection when switching from selected select mode into build mode', () => {
  const presentation = createPresentationState();

  applyObjectSelection(presentation, ['pawn_1']);
  applyToolSelection(presentation, {
    tool: ToolType.Build,
    buildDefId: 'wall_wood',
  });

  expect(presentation.backStack).toHaveLength(2);

  const restored = popBackNavigation(presentation);
  expect(restored).toBe(true);
  expect(presentation.activeTool).toBe(ToolType.Select);
  expect(Array.from(presentation.selectedObjectIds)).toEqual(['pawn_1']);
});
```

- [ ] **Step 2: 运行测试并确认当前语义被锁定**

Run: `npx vitest run src/presentation/presentation-state.test.ts`

Expected: 如果上一任务实现不完整，此处 FAIL；如果已完整覆盖，则 PASS。无论结果如何，继续以该测试作为回归保护。

- [ ] **Step 3: 修改 `main.ts`，统一使用新的 presentation API**

```ts
import {
  applyObjectSelection,
  applyToolSelection,
  ToolType,
} from './presentation/presentation-state';

// ...

selectObjects(ids: ObjectId[]) {
  const p = pres();
  applyObjectSelection(p, ids);
},

selectColonist(id: string) {
  const p = pres();
  applyObjectSelection(p, [id]);
},

setTool(tool: string, designationType?: string | null, buildDefId?: string | null, zoneType?: string | null) {
  const p = pres();
  applyToolSelection(p, {
    tool: tool as ToolType,
    designationType: (designationType ?? null) as DesignationType | null,
    buildDefId: buildDefId ?? null,
    zoneType: (zoneType ?? null) as ZoneType | null,
  });
},
```

- [ ] **Step 4: 清理 `main.ts` 中过时的直接赋值与旧 helper 依赖**

```ts
// 删除这类直接赋值路径
p.selectedObjectIds.clear();
p.selectedObjectIds.add(id);
switchTool(p, ToolType.Select);

// 保留只读快照默认值，不在默认值里加入 backStack
presentation: {
  activeTool: 'select',
  activeDesignationType: null,
  activeZoneType: null,
  activeBuildDefId: null,
  hoveredCell: null,
  selectedIds: [],
  showDebugPanel: false,
  showGrid: false,
},
```

- [ ] **Step 5: 回归运行状态层测试**

Run: `npx vitest run src/presentation/presentation-state.test.ts`

Expected: PASS

- [ ] **Step 6: 提交主入口接线改动**

```bash
git add src/main.ts src/presentation/presentation-state.test.ts
git commit -m "refactor: route ui presentation changes through back stack api"
```

---

### Task 3: 在 InputHandler 中接入右键返回与浏览器菜单拦截

**Files:**
- Modify: `src/adapter/input/input-handler.ts`
- Test: `src/adapter/input/input-handler.test.ts`

- [ ] **Step 1: 写输入层失败测试，锁定右键返回顺序**

```ts
import { describe, expect, it, vi } from 'vitest';
import { InputHandler } from './input-handler';
import { createPresentationState, applyToolSelection, ToolType } from '../../presentation/presentation-state';

describe('InputHandler right click back navigation', () => {
  it('pops back stack on right click when not dragging', () => {
    const scene = createFakeScene();
    const world = createFakeWorld();
    const map = createFakeMap();
    const presentation = createPresentationState();

    applyToolSelection(presentation, { tool: ToolType.Build, buildDefId: 'bed_wood' });

    new InputHandler(scene as any, world as any, map as any, presentation);

    const handler = scene.__listeners.pointerdown[0];
    handler({
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
    const world = createFakeWorld();
    const map = createFakeMap();
    const presentation = createPresentationState();

    applyToolSelection(presentation, { tool: ToolType.Build, buildDefId: 'bed_wood' });

    const handler = new InputHandler(scene as any, world as any, map as any, presentation);
    scene.__listeners.pointerdown[0]({
      button: 0,
      leftButtonDown: () => true,
      rightButtonDown: () => false,
      x: 32,
      y: 32,
    });

    (handler as any).dragState = {
      startScreenPos: { x: 32, y: 32 },
      startCell: { x: 1, y: 1 },
      active: true,
    };
    presentation.dragRect = {
      startCell: { x: 1, y: 1 },
      endCell: { x: 3, y: 3 },
    };

    scene.__listeners.pointerdown[0]({
      button: 2,
      leftButtonDown: () => false,
      rightButtonDown: () => true,
      x: 64,
      y: 64,
    });

    expect((handler as any).dragState).toBeNull();
    expect(presentation.dragRect).toBeNull();
    expect(presentation.activeTool).toBe(ToolType.Build);
    expect(presentation.backStack).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行输入层测试并确认失败**

Run: `npx vitest run src/adapter/input/input-handler.test.ts`

Expected: FAIL，报错包含以下之一：

- `Cannot find module './input-handler.test.ts'`
- `scene.__listeners.pointerdown is undefined`
- `right click did not restore select mode`

- [ ] **Step 3: 为 `InputHandler` 增加右键监听与返回动作**

```ts
import {
  clearTransientInteractionState,
  popBackNavigation,
  PresentationState,
  ToolType,
} from '../../presentation/presentation-state';

private setupMouseInputs(): void {
  this.bindContextMenuPrevention();

  this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonDown()) {
      this.handleBackAction();
      return;
    }

    if (!pointer.leftButtonDown()) return;
    const cell = this.pointerToCell(pointer);
    if (!cell) return;
    this.presentation.dragRect = null;
    this.presentation.zonePreview = null;
    this.dragState = {
      startScreenPos: { x: pointer.x, y: pointer.y },
      startCell: cell,
      active: false,
    };
  });

  // pointermove / pointerup 维持原有逻辑
}

private bindContextMenuPrevention(): void {
  const canvas = this.scene.game.canvas as HTMLCanvasElement | undefined;
  canvas?.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

private handleBackAction(): void {
  if (this.dragState) {
    this.dragState = null;
    clearTransientInteractionState(this.presentation);
    return;
  }

  clearTransientInteractionState(this.presentation);
  popBackNavigation(this.presentation);
}
```

- [ ] **Step 4: 为输入层测试补 fake scene / fake map 基础设施**

```ts
function createFakeScene() {
  const listeners: Record<string, Array<(pointer: any) => void>> = {
    pointerdown: [],
    pointermove: [],
    pointerup: [],
  };

  const canvasListeners: Record<string, (event: Event) => void> = {};

  return {
    __listeners: listeners,
    __canvasListeners: canvasListeners,
    input: {
      on(event: string, handler: (pointer: any) => void) {
        listeners[event] ??= [];
        listeners[event].push(handler);
      },
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
        addEventListener(type: string, handler: (event: Event) => void) {
          canvasListeners[type] = handler;
        },
      },
    },
  };
}

function createFakeWorld() {
  return {
    commandQueue: [],
    defs: { buildings: new Map(), terrains: new Map() },
  };
}

function createFakeMap() {
  return {
    id: 'main',
    width: 80,
    height: 80,
    spatial: {
      getAt() {
        return [];
      },
      isPassable() {
        return true;
      },
    },
    terrain: {
      get() {
        return 'grass';
      },
    },
    zones: {
      getZoneAt() {
        return null;
      },
    },
    objects: {
      get() {
        return null;
      },
    },
  };
}
```

- [ ] **Step 5: 运行输入层测试并确认通过**

Run: `npx vitest run src/adapter/input/input-handler.test.ts`

Expected: PASS，至少包含：

- `2 passed`

- [ ] **Step 6: 提交输入层右键接入**

```bash
git add src/adapter/input/input-handler.ts src/adapter/input/input-handler.test.ts
git commit -m "feat: add right click back navigation input"
```

---

### Task 4: 修正受影响测试夹具并补回归验证

**Files:**
- Modify: `src/adapter/render/world-preview.test.ts`
- Test: `src/adapter/render/world-preview.test.ts`
- Test: `src/presentation/presentation-state.test.ts`
- Test: `src/adapter/input/input-handler.test.ts`

- [ ] **Step 1: 更新依赖 `PresentationState` 夹具的现有测试**

```ts
function makePresentationState(): PresentationState {
  return {
    selectedObjectIds: new Set(),
    hoveredCell: null,
    placementPreview: null,
    designationPreview: null,
    activeOverlay: 'none' as PresentationState['activeOverlay'],
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: 'select' as PresentationState['activeTool'],
    activeDesignationType: null,
    activeZoneType: null,
    lastZoneType: 'stockpile' as PresentationState['lastZoneType'],
    activeBuildDefId: null,
    showDebugPanel: false,
    showGrid: false,
    dragRect: null,
    zonePreview: null,
    backStack: [],
  };
}
```

- [ ] **Step 2: 运行最小回归测试集**

Run: `npx vitest run src/presentation/presentation-state.test.ts src/adapter/input/input-handler.test.ts src/adapter/render/world-preview.test.ts`

Expected: PASS

- [ ] **Step 3: 运行类型检查确认新增 API 没破坏调用点**

Run: `npx tsc --noEmit`

Expected: 对本次改动无新增 TypeScript 错误。  
Note: 如果命中仓库记忆中已有的 pre-existing 错误，只记录并确认不是本次引入。

- [ ] **Step 4: 提交测试与回归修正**

```bash
git add src/adapter/render/world-preview.test.ts src/presentation/presentation-state.test.ts src/adapter/input/input-handler.test.ts
git commit -m "test: cover right click back navigation flows"
```

---

### Task 5: 手动交互验证与收尾

**Files:**
- Modify: 无
- Test: 运行本地交互验证

- [ ] **Step 1: 启动本地开发环境**

Run: `npm run build`

Expected: 构建成功；如果构建失败，只允许出现仓库中已知的 pre-existing 问题，不能有本次新增错误

- [ ] **Step 2: 手动验证地图交互**

按以下顺序验证：

```text
1. 进入游戏，右键地图区域，确认不出现浏览器菜单
2. 切到 Build -> Bed，右键一次，确认回到 Select
3. Select 选中一个 colonist，确认 inspector 出现；右键一次，确认 inspector 关闭
4. Select 选中 colonist -> 切到 Build，右键一次，确认回到已选中 colonist 的 Select；再右键一次，确认 inspector 关闭
5. 切到 Designate(Mine) -> 再切到 Zone(Stockpile)，右键一次回到 Mine，再右键一次回到 Select
6. 左键拖拽中途点右键，确认只取消当前拖拽，不弹回上一层工具状态
```

- [ ] **Step 3: 查看工作区改动并准备交付**

Run: `git status --short`

Expected: 只包含本次实现相关文件

- [ ] **Step 4: 提交最终收尾变更**

```bash
git add src/presentation/presentation-state.ts src/presentation/presentation-state.test.ts src/main.ts src/adapter/input/input-handler.ts src/adapter/input/input-handler.test.ts src/adapter/render/world-preview.test.ts
git commit -m "feat: add right click back navigation"
```

---

## 自检

### Spec 覆盖检查

- 浏览器右键菜单拦截：Task 3
- 返回栈模型：Task 1
- UI/输入统一走同一状态 API：Task 2
- 右键先取消拖拽再返回：Task 3
- inspector 作为稳定状态层处理：Task 1、Task 2、Task 5
- 测试与回归：Task 1、Task 3、Task 4、Task 5

### 占位符检查

- 没有 `TODO`、`TBD`、`implement later`
- 每个任务都给出了文件、命令与预期结果
- 代码步骤均给出了具体函数名和示例代码

### 类型一致性检查

- 统一使用 `PresentationBackEntry`
- 统一使用 `applyToolSelection`
- 统一使用 `applyObjectSelection`
- 统一使用 `popBackNavigation`
- 临时状态清理统一走 `clearTransientInteractionState`
