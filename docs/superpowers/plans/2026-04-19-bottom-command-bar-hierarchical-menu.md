# 底部命令栏分层菜单重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前全宽工具栏和特判下拉菜单重构为左下角锚定的统一分层命令列表，支持多级菜单、动态 `Z/X/C/V/B/N/M` 快捷键、`Esc` 返回和叶子项连续使用。

**Architecture:** 把菜单树、快捷键映射和高亮判断抽成独立的 `build` 领域纯函数；把当前菜单路径提升到 `PresentationState`，通过 `UiPorts` 暴露给 Preact 和 Phaser 输入层共享。`ToolModeBar` 只消费 selector 产出的当前层级视图模型，不再自己维护 `build/zone` 两套本地弹出状态。

**Tech Stack:** TypeScript、Preact、Vitest、Phaser 输入层、现有 snapshot bridge / UiPorts / PresentationState

---

## 文件结构

- Create: `src/ui/domains/build/command-menu.ts`
  - 统一定义菜单树、可见层级解析、快捷键映射、当前激活叶子的祖先分支判断。
- Create: `src/ui/domains/build/command-menu.test.ts`
  - 覆盖纯函数级菜单路径、返回项和快捷键映射。
- Create: `src/adapter/input/keyboard-bindings.test.ts`
  - 覆盖 `Esc`、`Z/X/C/V/B/N/M` 的动态行为。
- Modify: `src/presentation/presentation-state.ts`
  - 增加 `commandMenuPath` 和菜单路径辅助函数。
- Modify: `src/presentation/presentation-state.test.ts`
  - 为菜单路径 push/pop/reset 增加失败后再转绿的测试。
- Modify: `src/ui/kernel/ui-types.ts`
  - 让快照类型暴露 `commandMenuPath`。
- Modify: `src/ui/kernel/snapshot-reader.ts`
  - 从 `PresentationState` 读取菜单路径写入快照。
- Modify: `src/ui/kernel/snapshot-reader.test.ts`
  - 验证快照投影包含菜单路径。
- Modify: `src/ui/kernel/ui-ports.ts`
  - 为 UI 暴露进入分支、返回一级、重置菜单路径的方法。
- Modify: `src/main.ts`
  - 在 `createLazyPorts()` 和空快照回退值中接入菜单路径。
- Modify: `src/ui/domains/build/build.types.ts`
  - 定义命令栏视图模型类型。
- Modify: `src/ui/domains/build/build.schemas.ts`
  - 移除旧的扁平工具菜单职责，仅保留仍然有效的静态 schema（例如速度按钮），并把注释同步为新职责。
- Modify: `src/ui/domains/build/build.selectors.ts`
  - 基于快照和纯菜单函数生成当前层级视图模型。
- Modify: `src/ui/domains/build/build.selectors.test.ts`
  - 覆盖根层、子层、祖先高亮、快捷键标签。
- Modify: `src/ui/domains/build/components/tool-mode-bar.tsx`
  - 重写为统一方块列表，不再保留 `build/zone` 特判 dropdown。
- Modify: `src/ui/domains/build/components/tool-mode-bar.test.tsx`
  - 改成基于分层菜单视图模型的组件测试。
- Modify: `src/ui/app/app-shell.tsx`
  - 改为传入命令栏视图模型和菜单导航回调。
- Modify: `src/ui/app/app-shell.test.tsx`
  - 补齐新的快照字段与 ports 假对象。
- Modify: `src/ui/styles/app.css`
  - 重做底部命令栏样式为左下角单排正方形命令盘。
- Modify: `src/adapter/input/keyboard-bindings.ts`
  - 去掉固定工具热键，接入动态菜单快捷键和 `Esc` 退层行为。

### Task 1: 给 PresentationState / 快照 / UiPorts 增加菜单路径状态

**Files:**
- Modify: `src/presentation/presentation-state.ts`
- Modify: `src/presentation/presentation-state.test.ts`
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Modify: `src/ui/kernel/snapshot-reader.test.ts`
- Modify: `src/ui/kernel/ui-ports.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 先写失败测试，锁定菜单路径的状态行为**

```ts
// src/presentation/presentation-state.test.ts
import {
  createPresentationState,
  enterCommandMenuBranch,
  popCommandMenuLevel,
  resetCommandMenuPath,
} from './presentation-state';

it('pushes and pops command menu path levels independently from tool backStack', () => {
  const p = createPresentationState();

  enterCommandMenuBranch(p, 'build');
  enterCommandMenuBranch(p, 'furniture');
  expect(p.commandMenuPath).toEqual(['build', 'furniture']);

  expect(popCommandMenuLevel(p)).toBe(true);
  expect(p.commandMenuPath).toEqual(['build']);
  expect(popCommandMenuLevel(p)).toBe(true);
  expect(p.commandMenuPath).toEqual([]);
  expect(popCommandMenuLevel(p)).toBe(false);
});

it('resets command menu path without touching active tool fields', () => {
  const p = createPresentationState();
  p.activeTool = 'build' as any;
  p.activeBuildDefId = 'wall_wood' as any;
  enterCommandMenuBranch(p, 'build');
  enterCommandMenuBranch(p, 'structure');

  resetCommandMenuPath(p);

  expect(p.commandMenuPath).toEqual([]);
  expect(p.activeTool).toBe('build');
  expect(p.activeBuildDefId).toBe('wall_wood');
});
```

```ts
// src/ui/kernel/snapshot-reader.test.ts
it('projects commandMenuPath into the presentation snapshot', () => {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 7 });
  const map = createGameMap({ id: 'main', width: 8, height: 8 });
  const presentation = createPresentationState();
  world.maps.set(map.id, map);

  enterCommandMenuBranch(presentation, 'build');
  enterCommandMenuBranch(presentation, 'structure');

  const snapshot = readEngineSnapshot(world, map, presentation, { recentEvents: [] });
  expect(snapshot.presentation.commandMenuPath).toEqual(['build', 'structure']);
});
```

- [ ] **Step 2: 跑状态与快照测试，确认它们先红掉**

Run: `npx vitest run src/presentation/presentation-state.test.ts src/ui/kernel/snapshot-reader.test.ts`

Expected: FAIL，因为 `PresentationState` 还没有 `commandMenuPath`，`enterCommandMenuBranch()` / `popCommandMenuLevel()` / `resetCommandMenuPath()` 也不存在，快照类型也没有该字段。

- [ ] **Step 3: 最小实现菜单路径状态与投影**

```ts
// src/presentation/presentation-state.ts
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
  commandMenuPath: string[];
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
    commandMenuPath: [],
  };
}

export function enterCommandMenuBranch(presentation: PresentationState, branchId: string): void {
  presentation.commandMenuPath = [...presentation.commandMenuPath, branchId];
}

export function popCommandMenuLevel(presentation: PresentationState): boolean {
  if (presentation.commandMenuPath.length === 0) return false;
  presentation.commandMenuPath = presentation.commandMenuPath.slice(0, -1);
  return true;
}

export function resetCommandMenuPath(presentation: PresentationState): void {
  presentation.commandMenuPath = [];
}
```

```ts
// src/ui/kernel/ui-types.ts
export interface PresentationSnapshot {
  activeTool: string;
  activeDesignationType: string | null;
  activeZoneType: string | null;
  activeBuildDefId: string | null;
  commandMenuPath: string[];
  hoveredCell: { x: number; y: number } | null;
  selectedIds: string[];
  showDebugPanel: boolean;
  showGrid: boolean;
}
```

```ts
// src/ui/kernel/snapshot-reader.ts
return {
  tick: world.tick,
  speed: world.speed,
  clockDisplay: getClockDisplay(world.clock),
  colonistCount: pawns.length,
  presentation: {
    activeTool: presentation.activeTool,
    activeDesignationType: presentation.activeDesignationType,
    activeZoneType: presentation.activeZoneType,
    activeBuildDefId: presentation.activeBuildDefId,
    commandMenuPath: [...presentation.commandMenuPath],
    hoveredCell: presentation.hoveredCell ? { x: presentation.hoveredCell.x, y: presentation.hoveredCell.y } : null,
    selectedIds,
    showDebugPanel: presentation.showDebugPanel,
    showGrid: presentation.showGrid,
  },
  // ...
};
```

```ts
// src/ui/kernel/ui-ports.ts
export interface UiPorts {
  dispatchCommand(command: Command): void;
  setSpeed(speed: number): void;
  selectObjects(ids: ObjectId[]): void;
  selectColonist(id: string): void;
  setTool(tool: string, designationType?: string | null, buildDefId?: string | null, zoneType?: string | null): void;
  enterCommandMenu(branchId: string): void;
  backCommandMenu(): boolean;
  resetCommandMenu(): void;
  jumpCameraTo(cell: { x: number; y: number }): void;
  assignBedOwner(bedId: string, pawnId: string): void;
  clearBedOwner(bedId: string): void;
}
```

```ts
// src/main.ts
import {
  ToolType,
  applyObjectSelection,
  applyToolSelection,
  enterCommandMenuBranch,
  popCommandMenuLevel,
  resetCommandMenuPath,
} from './presentation/presentation-state';

function createLazyPorts(world: World, getPresentation: () => PresentationState | undefined): UiPorts {
  function pres(): PresentationState {
    const p = getPresentation();
    if (!p) throw new Error('Presentation not ready');
    return p;
  }

  return {
    // ...
    enterCommandMenu(branchId: string) {
      enterCommandMenuBranch(pres(), branchId);
    },
    backCommandMenu() {
      return popCommandMenuLevel(pres());
    },
    resetCommandMenu() {
      resetCommandMenuPath(pres());
    },
    // ...
  };
}
```

- [ ] **Step 4: 重跑状态与快照测试，确认转绿**

Run: `npx vitest run src/presentation/presentation-state.test.ts src/ui/kernel/snapshot-reader.test.ts`

Expected: PASS，`commandMenuPath` 初始化、push/pop/reset 和快照投影都正确。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/presentation/presentation-state.ts src/presentation/presentation-state.test.ts src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/kernel/snapshot-reader.test.ts src/ui/kernel/ui-ports.ts src/main.ts
git commit -m "feat: add command menu path state"
```

### Task 2: 建立纯菜单领域模型与命令栏 selector

**Files:**
- Create: `src/ui/domains/build/command-menu.ts`
- Create: `src/ui/domains/build/command-menu.test.ts`
- Modify: `src/ui/domains/build/build.types.ts`
- Modify: `src/ui/domains/build/build.schemas.ts`
- Modify: `src/ui/domains/build/build.selectors.ts`
- Modify: `src/ui/domains/build/build.selectors.test.ts`

- [ ] **Step 1: 先写失败测试，锁定菜单树、快捷键和祖先高亮**

```ts
// src/ui/domains/build/command-menu.test.ts
import {
  COMMAND_SHORTCUT_KEYS,
  getVisibleCommandMenuEntries,
  resolveActiveCommandLeafId,
} from './command-menu';

describe('command-menu', () => {
  it('returns root entries with dynamic shortcuts', () => {
    const entries = getVisibleCommandMenuEntries([], 'select');
    expect(entries.map(entry => `${entry.shortcut}:${entry.label}`)).toEqual([
      'Z:选择',
      'X:建造',
      'C:指令',
      'V:区域',
      'B:取消',
    ]);
    expect(COMMAND_SHORTCUT_KEYS).toEqual(['Z', 'X', 'C', 'V', 'B', 'N', 'M']);
  });

  it('prepends 返回 on non-root levels', () => {
    const entries = getVisibleCommandMenuEntries(['build'], 'build_wall');
    expect(entries[0]).toMatchObject({ id: '__back__', label: '返回', shortcut: 'Esc', kind: 'back' });
    expect(entries[1]).toMatchObject({ label: '结构', shortcut: 'Z', kind: 'branch' });
    expect(entries[2]).toMatchObject({ label: '家具', shortcut: 'X', kind: 'branch' });
  });

  it('resolves root highlight to 建造 when wall is the active leaf', () => {
    const entries = getVisibleCommandMenuEntries([], 'build_wall');
    expect(entries.find(entry => entry.label === '建造')?.active).toBe(true);
  });

  it('resolves designate and zone leaves from tool state', () => {
    expect(resolveActiveCommandLeafId({
      activeTool: 'designate',
      activeDesignationType: 'mine',
      activeBuildDefId: null,
      activeZoneType: null,
    })).toBe('mine');

    expect(resolveActiveCommandLeafId({
      activeTool: 'zone',
      activeDesignationType: null,
      activeBuildDefId: null,
      activeZoneType: 'growing',
    })).toBe('zone_growing');
  });
});
```

```ts
// src/ui/domains/build/build.selectors.test.ts
import { selectCommandMenuViewModel } from './build.selectors';

it('returns 建造 -> 家具 level with 返回 and 床', () => {
  const vm = selectCommandMenuViewModel(makeSnapshot({
    presentation: {
      activeTool: 'build',
      activeDesignationType: null,
      activeZoneType: null,
      activeBuildDefId: 'bed_wood',
      commandMenuPath: ['build', 'furniture'],
      hoveredCell: null,
      selectedIds: [],
      showDebugPanel: false,
      showGrid: false,
    },
  }));

  expect(vm.entries.map(entry => entry.label)).toEqual(['返回', '床']);
  expect(vm.entries[1].active).toBe(true);
});
```

- [ ] **Step 2: 跑纯菜单与 selector 测试，确认它们先失败**

Run: `npx vitest run src/ui/domains/build/command-menu.test.ts src/ui/domains/build/build.selectors.test.ts`

Expected: FAIL，因为 `command-menu.ts` 还不存在，`selectCommandMenuViewModel()` 也还没有实现，fixture 里的 `commandMenuPath` 也还没有被 selector 消费。

- [ ] **Step 3: 实现菜单树、快捷键映射与 selector**

```ts
// src/ui/domains/build/build.types.ts
export type CommandMenuEntryKind = 'back' | 'branch' | 'leaf';

export interface CommandMenuEntryViewModel {
  id: string;
  label: string;
  shortcut: string;
  kind: CommandMenuEntryKind;
  active: boolean;
  branchId?: string;
  action?: ToolActionDef;
}

export interface CommandMenuViewModel {
  path: string[];
  entries: CommandMenuEntryViewModel[];
}
```

```ts
// src/ui/domains/build/command-menu.ts
import type { ToolActionDef } from './build.types';
import type { CommandMenuEntryViewModel } from './build.types';

type ActiveToolState = {
  activeTool: string;
  activeDesignationType: string | null;
  activeBuildDefId: string | null;
  activeZoneType: string | null;
};

interface CommandMenuNode {
  id: string;
  label: string;
  kind: 'branch' | 'leaf';
  action?: ToolActionDef;
  children?: CommandMenuNode[];
}

export const COMMAND_SHORTCUT_KEYS = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'] as const;

const ROOT_COMMAND_MENU: CommandMenuNode[] = [
  { id: 'select', label: '选择', kind: 'leaf', action: { id: 'select', tool: 'select', label: '选择', hotkey: '', group: 0 } },
  {
    id: 'build',
    label: '建造',
    kind: 'branch',
    children: [
      {
        id: 'structure',
        label: '结构',
        kind: 'branch',
        children: [
          { id: 'build_wall', label: '墙', kind: 'leaf', action: { id: 'build_wall', tool: 'build', label: '墙', hotkey: '', buildDefId: 'wall_wood', group: 1 } },
        ],
      },
      {
        id: 'furniture',
        label: '家具',
        kind: 'branch',
        children: [
          { id: 'build_bed', label: '床', kind: 'leaf', action: { id: 'build_bed', tool: 'build', label: '床', hotkey: '', buildDefId: 'bed_wood', group: 1 } },
        ],
      },
    ],
  },
  {
    id: 'designate',
    label: '指令',
    kind: 'branch',
    children: [
      { id: 'mine', label: '采矿', kind: 'leaf', action: { id: 'mine', tool: 'designate', label: '采矿', hotkey: '', designationType: 'mine', group: 2 } },
      { id: 'harvest', label: '收获', kind: 'leaf', action: { id: 'harvest', tool: 'designate', label: '收获', hotkey: '', designationType: 'harvest', group: 2 } },
      { id: 'cut', label: '砍伐', kind: 'leaf', action: { id: 'cut', tool: 'designate', label: '砍伐', hotkey: '', designationType: 'cut', group: 2 } },
    ],
  },
  {
    id: 'zone',
    label: '区域',
    kind: 'branch',
    children: [
      { id: 'zone_stockpile', label: '存储区', kind: 'leaf', action: { id: 'zone_stockpile', tool: 'zone', label: '存储区', hotkey: '', zoneType: 'stockpile', group: 3 } },
      { id: 'zone_growing', label: '种植区', kind: 'leaf', action: { id: 'zone_growing', tool: 'zone', label: '种植区', hotkey: '', zoneType: 'growing', group: 3 } },
    ],
  },
  { id: 'cancel', label: '取消', kind: 'leaf', action: { id: 'cancel', tool: 'cancel', label: '取消', hotkey: '', group: 4 } },
];

export function resolveActiveCommandLeafId(state: ActiveToolState): string {
  if (state.activeTool === 'build') return state.activeBuildDefId === 'bed_wood' ? 'build_bed' : 'build_wall';
  if (state.activeTool === 'designate') return state.activeDesignationType ?? 'mine';
  if (state.activeTool === 'zone') return state.activeZoneType === 'growing' ? 'zone_growing' : 'zone_stockpile';
  return state.activeTool;
}

export function getVisibleCommandMenuEntries(
  path: string[],
  activeLeafId: string,
): CommandMenuEntryViewModel[] {
  const level = resolveLevel(path);
  const branchActiveSet = new Set(findActiveAncestorBranchIds(activeLeafId));
  const mapped = level.map((node, index) => ({
    id: node.id,
    label: node.label,
    shortcut: COMMAND_SHORTCUT_KEYS[index],
    kind: node.kind,
    active: node.kind === 'leaf' ? node.id === activeLeafId : branchActiveSet.has(node.id),
    branchId: node.kind === 'branch' ? node.id : undefined,
    action: node.action,
  }));

  return path.length === 0
    ? mapped
    : [{ id: '__back__', label: '返回', shortcut: 'Esc', kind: 'back', active: false }, ...mapped];
}
```

```ts
// src/ui/domains/build/build.selectors.ts
import type { EngineSnapshot } from '../../kernel/ui-types';
import type { CommandMenuViewModel } from './build.types';
import { getVisibleCommandMenuEntries, resolveActiveCommandLeafId } from './command-menu';

export function selectCommandMenuViewModel(snapshot: EngineSnapshot): CommandMenuViewModel {
  const activeLeafId = resolveActiveCommandLeafId({
    activeTool: snapshot.presentation.activeTool,
    activeDesignationType: snapshot.presentation.activeDesignationType,
    activeBuildDefId: snapshot.presentation.activeBuildDefId,
    activeZoneType: snapshot.presentation.activeZoneType,
  });

  return {
    path: snapshot.presentation.commandMenuPath,
    entries: getVisibleCommandMenuEntries(snapshot.presentation.commandMenuPath, activeLeafId),
  };
}
```

```ts
// src/ui/domains/build/build.schemas.ts
import type { SpeedButtonDef } from './build.types';

export const speedButtons: readonly SpeedButtonDef[] = [
  { value: 0, label: 'II' },
  { value: 1, label: '>' },
  { value: 2, label: '>>' },
  { value: 3, label: '>>>>' },
];
```

- [ ] **Step 4: 重跑纯菜单与 selector 测试**

Run: `npx vitest run src/ui/domains/build/command-menu.test.ts src/ui/domains/build/build.selectors.test.ts`

Expected: PASS，根层 / 子层 / `返回` / 快捷键 / 祖先高亮都正确。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/domains/build/command-menu.ts src/ui/domains/build/command-menu.test.ts src/ui/domains/build/build.types.ts src/ui/domains/build/build.schemas.ts src/ui/domains/build/build.selectors.ts src/ui/domains/build/build.selectors.test.ts
git commit -m "feat: add hierarchical command menu model"
```

### Task 3: 重写 ToolModeBar、AppShell 和命令栏样式

**Files:**
- Modify: `src/ui/domains/build/components/tool-mode-bar.tsx`
- Modify: `src/ui/domains/build/components/tool-mode-bar.test.tsx`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/app/app-shell.test.tsx`
- Modify: `src/ui/styles/app.css`

- [ ] **Step 1: 先写失败的组件测试，锁定“统一列表 + 返回 + 叶子不退层”**

```tsx
// src/ui/domains/build/components/tool-mode-bar.test.tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { ToolModeBar } from './tool-mode-bar';
import type { CommandMenuViewModel } from '../build.types';

function renderBar(menu: CommandMenuViewModel, overrides: Partial<Parameters<typeof ToolModeBar>[0]> = {}) {
  return render(
    <ToolModeBar
      menu={menu}
      onActivate={vi.fn()}
      onEnterBranch={vi.fn()}
      onBack={vi.fn()}
      {...overrides}
    />,
  );
}

it('renders root entries as square command tiles with shortcut hints', () => {
  renderBar({
    path: [],
    entries: [
      { id: 'select', label: '选择', shortcut: 'Z', kind: 'leaf', active: true, action: { id: 'select', tool: 'select', label: '选择', hotkey: '', group: 0 } },
      { id: 'build', label: '建造', shortcut: 'X', kind: 'branch', active: false, branchId: 'build' },
    ],
  });

  expect(screen.getByRole('button', { name: '选择' })).toBeInTheDocument();
  expect(screen.getByText('Z')).toBeInTheDocument();
  expect(screen.getByText('X')).toBeInTheDocument();
});

it('calls onEnterBranch for branch tiles', () => {
  const onEnterBranch = vi.fn();
  renderBar(
    {
      path: [],
      entries: [{ id: 'build', label: '建造', shortcut: 'X', kind: 'branch', active: false, branchId: 'build' }],
    },
    { onEnterBranch },
  );

  fireEvent.click(screen.getByRole('button', { name: '建造' }));
  expect(onEnterBranch).toHaveBeenCalledWith('build');
});

it('calls onBack for 返回 tiles', () => {
  const onBack = vi.fn();
  renderBar(
    {
      path: ['build'],
      entries: [{ id: '__back__', label: '返回', shortcut: 'Esc', kind: 'back', active: false }],
    },
    { onBack },
  );

  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('calls onActivate for leaf tiles without requiring local menu state', () => {
  const onActivate = vi.fn();
  renderBar(
    {
      path: ['build', 'structure'],
      entries: [{ id: 'build_wall', label: '墙', shortcut: 'Z', kind: 'leaf', active: true, action: { id: 'build_wall', tool: 'build', label: '墙', hotkey: '', buildDefId: 'wall_wood', group: 1 } }],
    },
    { onActivate },
  );

  fireEvent.click(screen.getByRole('button', { name: '墙' }));
  expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 'build_wall', buildDefId: 'wall_wood' }));
});
```

- [ ] **Step 2: 跑组件测试，确认它先失败**

Run: `npx vitest run src/ui/domains/build/components/tool-mode-bar.test.tsx src/ui/app/app-shell.test.tsx`

Expected: FAIL，因为 `ToolModeBar` 仍然依赖 `activeToolId/activeTool` 和本地 dropdown state，`AppShell` 也还没传入菜单视图模型和导航回调。

- [ ] **Step 3: 最小实现统一命令栏组件与 AppShell 接线**

```tsx
// src/ui/domains/build/components/tool-mode-bar.tsx
import type { CommandMenuViewModel, ToolActionDef } from '../build.types';

interface ToolModeBarProps {
  menu: CommandMenuViewModel;
  onActivate: (action: ToolActionDef) => void;
  onEnterBranch: (branchId: string) => void;
  onBack: () => void;
}

export function ToolModeBar({ menu, onActivate, onEnterBranch, onBack }: ToolModeBarProps) {
  return (
    <nav class="tool-command-bar" aria-label="命令栏">
      {menu.entries.map(entry => (
        <button
          key={entry.id}
          type="button"
          class={`tool-command-bar__entry${entry.active ? ' is-active' : ''}`}
          onClick={() => {
            if (entry.kind === 'back') {
              onBack();
              return;
            }
            if (entry.kind === 'branch' && entry.branchId) {
              onEnterBranch(entry.branchId);
              return;
            }
            if (entry.kind === 'leaf' && entry.action) {
              onActivate(entry.action);
            }
          }}
          aria-label={entry.label}
        >
          <span class="tool-command-bar__hint">{entry.shortcut}</span>
          <span class="tool-command-bar__label">{entry.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

```tsx
// src/ui/app/app-shell.tsx
import { selectTopStatusBar, selectCommandMenuViewModel } from '../domains/build/build.selectors';

export function AppShell({ snapshot, uiState, dispatch, ports }: AppShellProps) {
  // ...
  const commandMenu = selectCommandMenuViewModel(snapshot);

  return (
    <div class="app-shell" data-testid="app-shell">
      {/* ... */}
      <ToolModeBar
        menu={commandMenu}
        onActivate={(action) => activateToolAction(ports, action)}
        onEnterBranch={(branchId) => ports.enterCommandMenu(branchId)}
        onBack={() => {
          ports.backCommandMenu();
        }}
      />
    </div>
  );
}
```

```css
/* src/ui/styles/app.css */
.tool-command-bar {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  gap: 10px;
  padding: 10px;
  background: rgba(24, 22, 18, 0.9);
  border: 1px solid rgba(180, 156, 104, 0.35);
  border-radius: 14px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.34);
  pointer-events: auto;
}

.tool-command-bar__entry {
  width: 84px;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px;
  border: 1px solid rgba(205, 184, 140, 0.22);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(74, 58, 38, 0.92), rgba(42, 33, 22, 0.96));
  color: var(--text-color);
  cursor: pointer;
}

.tool-command-bar__entry:hover {
  border-color: rgba(220, 197, 142, 0.55);
  transform: translateY(-1px);
}

.tool-command-bar__entry.is-active {
  border-color: rgba(255, 214, 122, 0.9);
  box-shadow: inset 0 0 0 1px rgba(255, 233, 178, 0.55), 0 0 18px rgba(255, 196, 74, 0.18);
}

.tool-command-bar__hint {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgba(245, 227, 188, 0.78);
}

.tool-command-bar__label {
  font-size: var(--font-size);
  line-height: 1.2;
  font-weight: 600;
}
```

- [ ] **Step 4: 重跑组件测试**

Run: `npx vitest run src/ui/domains/build/components/tool-mode-bar.test.tsx src/ui/app/app-shell.test.tsx`

Expected: PASS，`ToolModeBar` 不再依赖本地 dropdown，`AppShell` 能把菜单视图模型和导航 ports 正确接进去。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/ui/domains/build/components/tool-mode-bar.tsx src/ui/domains/build/components/tool-mode-bar.test.tsx src/ui/app/app-shell.tsx src/ui/app/app-shell.test.tsx src/ui/styles/app.css
git commit -m "refactor: unify command bar menu rendering"
```

### Task 4: 重写键盘绑定为动态菜单快捷键

**Files:**
- Modify: `src/adapter/input/keyboard-bindings.ts`
- Create: `src/adapter/input/keyboard-bindings.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 Esc 和 Z/X/C/V/B/N/M 的动态行为**

```ts
// src/adapter/input/keyboard-bindings.test.ts
import { describe, expect, it } from 'vitest';
import { setupKeyboardBindings } from './keyboard-bindings';
import {
  ToolType,
  createPresentationState,
  enterCommandMenuBranch,
} from '../../presentation/presentation-state';

function createFakeScene() {
  const listeners: Record<string, Array<(event?: any) => void>> = {};
  return {
    input: {
      keyboard: {
        on(event: string, handler: (event?: any) => void) {
          listeners[event] ??= [];
          listeners[event].push(handler);
        },
      },
    },
    __listeners: listeners,
  };
}

it('pops commandMenuPath on Esc before resetting tool', () => {
  const scene = createFakeScene();
  const world = { commandQueue: [], speed: 1 } as any;
  const presentation = createPresentationState();
  presentation.activeTool = ToolType.Build;
  presentation.activeBuildDefId = 'wall_wood' as any;
  enterCommandMenuBranch(presentation, 'build');
  enterCommandMenuBranch(presentation, 'structure');

  setupKeyboardBindings(scene as any, world, presentation);
  scene.__listeners['keydown-ESC'][0]();

  expect(presentation.commandMenuPath).toEqual(['build']);
  expect(presentation.activeTool).toBe(ToolType.Build);
});

it('resets to select on root Esc', () => {
  const scene = createFakeScene();
  const world = { commandQueue: [], speed: 1 } as any;
  const presentation = createPresentationState();
  presentation.activeTool = ToolType.Build;
  presentation.activeBuildDefId = 'wall_wood' as any;

  setupKeyboardBindings(scene as any, world, presentation);
  scene.__listeners['keydown-ESC'][0]();

  expect(presentation.commandMenuPath).toEqual([]);
  expect(presentation.activeTool).toBe(ToolType.Select);
});

it('uses visible menu shortcuts instead of legacy fixed tool hotkeys', () => {
  const scene = createFakeScene();
  const world = { commandQueue: [], speed: 1 } as any;
  const presentation = createPresentationState();
  enterCommandMenuBranch(presentation, 'build');

  setupKeyboardBindings(scene as any, world, presentation);
  scene.__listeners['keydown-Z'][0]();

  expect(presentation.commandMenuPath).toEqual(['build', 'structure']);
  expect(presentation.activeTool).toBe(ToolType.Select);
});

it('activates leaf entries from the current level without changing menu path', () => {
  const scene = createFakeScene();
  const world = { commandQueue: [], speed: 1 } as any;
  const presentation = createPresentationState();
  enterCommandMenuBranch(presentation, 'designate');

  setupKeyboardBindings(scene as any, world, presentation);
  scene.__listeners['keydown-X'][0]();

  expect(presentation.commandMenuPath).toEqual(['designate']);
  expect(presentation.activeTool).toBe(ToolType.Designate);
  expect(presentation.activeDesignationType).toBe('harvest');
});
```

- [ ] **Step 2: 跑键盘绑定测试，确认它先失败**

Run: `npx vitest run src/adapter/input/keyboard-bindings.test.ts`

Expected: FAIL，因为当前 `keyboard-bindings.ts` 还是固定 `Q/B/M/H/X/Z/C` 工具热键，没有读取 `commandMenuPath`，`Esc` 也不会优先退层。

- [ ] **Step 3: 最小实现动态快捷键与 Esc 退层**

```ts
// src/adapter/input/keyboard-bindings.ts
import {
  ToolType,
  applyToolSelection,
  popCommandMenuLevel,
  resetCommandMenuPath,
} from '../../presentation/presentation-state';
import { getVisibleCommandMenuEntries, resolveActiveCommandLeafId } from '../../ui/domains/build/command-menu';

function triggerVisibleEntryShortcut(
  presentation: PresentationState,
  shortcut: string,
): void {
  const activeLeafId = resolveActiveCommandLeafId({
    activeTool: presentation.activeTool,
    activeDesignationType: presentation.activeDesignationType,
    activeBuildDefId: presentation.activeBuildDefId,
    activeZoneType: presentation.activeZoneType,
  });

  const entry = getVisibleCommandMenuEntries(presentation.commandMenuPath, activeLeafId)
    .find(candidate => candidate.shortcut === shortcut);
  if (!entry) return;

  if (entry.kind === 'branch' && entry.branchId) {
    presentation.commandMenuPath = [...presentation.commandMenuPath, entry.branchId];
    return;
  }

  if (entry.kind === 'leaf' && entry.action) {
    applyToolSelection(presentation, {
      tool: entry.action.tool as ToolType,
      designationType: (entry.action.designationType ?? null) as any,
      buildDefId: (entry.action.buildDefId ?? null) as any,
      zoneType: (entry.action.zoneType ?? null) as any,
    });
  }
}

kb.on('keydown-ESC', () => {
  if (popCommandMenuLevel(presentation)) {
    return;
  }
  applyToolSelection(presentation, { tool: ToolType.Select });
  resetCommandMenuPath(presentation);
  presentation.placementPreview = null;
  presentation.selectedObjectIds.clear();
});

for (const key of ['Z', 'X', 'C', 'V', 'B', 'N', 'M'] as const) {
  kb.on(`keydown-${key}`, () => {
    triggerVisibleEntryShortcut(presentation, key);
  });
}
```

- [ ] **Step 4: 重跑键盘绑定测试**

Run: `npx vitest run src/adapter/input/keyboard-bindings.test.ts`

Expected: PASS，非根层 `Esc` 只退一级，根层 `Esc` 切回 `选择`，字母快捷键按照当前可见层级动态生效。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/adapter/input/keyboard-bindings.ts src/adapter/input/keyboard-bindings.test.ts
git commit -m "feat: add dynamic command menu hotkeys"
```

### Task 5: 运行聚焦验证并做最终收口

**Files:**
- Modify: none
- Test: `src/presentation/presentation-state.test.ts`
- Test: `src/ui/kernel/snapshot-reader.test.ts`
- Test: `src/ui/domains/build/command-menu.test.ts`
- Test: `src/ui/domains/build/build.selectors.test.ts`
- Test: `src/ui/domains/build/components/tool-mode-bar.test.tsx`
- Test: `src/ui/app/app-shell.test.tsx`
- Test: `src/adapter/input/keyboard-bindings.test.ts`

- [ ] **Step 1: 跑完整的命令栏聚焦测试集**

Run: `npx vitest run src/presentation/presentation-state.test.ts src/ui/kernel/snapshot-reader.test.ts src/ui/domains/build/command-menu.test.ts src/ui/domains/build/build.selectors.test.ts src/ui/domains/build/components/tool-mode-bar.test.tsx src/ui/app/app-shell.test.tsx src/adapter/input/keyboard-bindings.test.ts`

Expected: PASS，状态、快照、纯菜单、selector、组件和键盘行为全部通过。

- [ ] **Step 2: 跑全量类型检查**

Run: `npx tsc --noEmit`

Expected: PASS，没有因为新增 `commandMenuPath`、`UiPorts` 方法或新视图模型而引入类型错误。

- [ ] **Step 3: 检查工作区是否干净**

Run: `git status --short`

Expected: 只剩下用户已有的未跟踪文件，且本次实现文件都已提交，没有额外漏改。

---

## 覆盖检查

- 分层菜单树与统一列表样式：Task 2 + Task 3。
- 非根层自动补 `返回`，并由 `Esc` 返回：Task 2 + Task 4。
- 叶子项点击后不关闭、不退层：Task 3 + Task 4。
- 动态 `Z/X/C/V/B/N/M` 快捷键：Task 2 + Task 4。
- 根层 `Esc` 切回 `选择` 并回到根层高亮：Task 4。
- `Build/Zone` 去掉独立 dropdown 特判：Task 3。
- 命令栏状态由 `PresentationState` 持有并通过快照共享：Task 1。

## 自检结论

- 计划已覆盖 spec 里的信息架构、状态归属、UI 行为、快捷键模型和验收标准。
- 计划没有使用 “TODO / TBD / 后续再补” 一类占位描述。
- 关键命名在各任务中保持一致：`commandMenuPath`、`enterCommandMenuBranch()`、`popCommandMenuLevel()`、`resetCommandMenuPath()`、`selectCommandMenuViewModel()`。
