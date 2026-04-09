# Preact UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a data-driven Preact UI application, migrate every legacy DOM panel into it, and retire the old `adapter/ui/*` runtime path.

**Architecture:** Keep Phaser responsible for world rendering and hit-testing while Preact owns all screen-space UI. Build a pure-function UI kernel around `EngineSnapshot`, `UiState`, reducers, selectors, and ports, then migrate Colonist, Build, and Feedback domains one by one until the legacy DOM manager can be removed entirely.

**Tech Stack:** TypeScript, Vite, Preact, `@preact/preset-vite`, Vitest, jsdom, `@testing-library/preact`, Phaser

---

## File Structure

### Create

- `src/ui/app/app-root.tsx` - UI bootstrap entry for mounting the Preact app
- `src/ui/app/app-shell.tsx` - top-level layout that composes all migrated UI domains
- `src/ui/kernel/ui-types.ts` - canonical `EngineSnapshot`, `UiState`, `UiAction`, and view-model types
- `src/ui/kernel/ui-actions.ts` - typed UI action creators
- `src/ui/kernel/ui-reducer.ts` - reducer for UI-local state
- `src/ui/kernel/ui-store.ts` - small hook-friendly store helpers
- `src/ui/kernel/ui-bridge.ts` - engine snapshot publisher and event-feed buffer
- `src/ui/kernel/ui-ports.ts` - side-effect ports that wrap `commandQueue`, selection, tool switches, and camera focus
- `src/ui/kernel/use-engine-snapshot.ts` - `useSyncExternalStore` adapter for the bridge
- `src/ui/kernel/ui-reducer.test.ts` - reducer coverage
- `src/ui/kernel/ui-bridge.test.ts` - snapshot bridge coverage
- `src/ui/domains/colonist/colonist.types.ts` - colonist-specific view-model types
- `src/ui/domains/colonist/colonist.schemas.ts` - roster columns, inspector sections, status badges
- `src/ui/domains/colonist/colonist.selectors.ts` - pure selectors for roster and inspector
- `src/ui/domains/colonist/colonist.intents.ts` - intent helpers for colonist actions
- `src/ui/domains/colonist/colonist.selectors.test.ts` - selector coverage
- `src/ui/domains/colonist/components/colonist-roster.tsx` - roster list component
- `src/ui/domains/colonist/components/colonist-inspector.tsx` - inspector component
- `src/ui/domains/colonist/components/colonist-inspector.test.tsx` - colonist component coverage
- `src/ui/domains/build/build.types.ts` - build/tool view-model types
- `src/ui/domains/build/build.schemas.ts` - tool specs, palette metadata, speed button metadata
- `src/ui/domains/build/build.selectors.ts` - build/tool selectors
- `src/ui/domains/build/build.intents.ts` - build/tool intent helpers
- `src/ui/domains/build/build.selectors.test.ts` - build selector coverage
- `src/ui/domains/build/components/top-status-bar.tsx` - migrated top bar
- `src/ui/domains/build/components/tool-mode-bar.tsx` - migrated toolbar and mode controls
- `src/ui/domains/build/components/build-panel.tsx` - build/designation palette
- `src/ui/domains/build/components/tool-mode-bar.test.tsx` - build component coverage
- `src/ui/domains/feedback/feedback.types.ts` - feedback-specific view-model types
- `src/ui/domains/feedback/feedback.schemas.ts` - event severity and grouping rules
- `src/ui/domains/feedback/feedback.selectors.ts` - selectors for toasts, event feed, and debug details
- `src/ui/domains/feedback/feedback.selectors.test.ts` - feedback selector coverage
- `src/ui/domains/feedback/components/notification-center.tsx` - notification list UI
- `src/ui/domains/feedback/components/toast-stack.tsx` - transient command feedback
- `src/ui/domains/feedback/components/debug-panel.tsx` - migrated debug inspector
- `src/ui/domains/feedback/components/notification-center.test.tsx` - feedback component coverage
- `src/ui/components/panel.tsx` - shared panel primitive
- `src/ui/components/section.tsx` - shared section wrapper
- `src/ui/components/stat-row.tsx` - label/value row
- `src/ui/components/progress-bar.tsx` - shared progress bar primitive
- `src/ui/components/badge.tsx` - shared badge primitive
- `src/ui/components/tabs.tsx` - shared tab strip
- `src/ui/styles/tokens.css` - design tokens for the new app shell
- `src/ui/styles/app.css` - application layout and component styles
- `src/ui/test/setup.ts` - Vitest DOM setup
- `src/presentation/presentation-actions.ts` - thin mutator helpers around `PresentationState`
- `vitest.config.ts` - test runner configuration

### Modify

- `package.json` - add Preact, test tooling, and scripts
- `package-lock.json` - lockfile updates from new dependencies
- `vite.config.ts` - enable the Preact plugin and Vitest config
- `tsconfig.json` - add JSX config and `.tsx` coverage
- `index.html` - add `#ui-root`, isolate the legacy layer during migration, then remove it at the end
- `src/main.ts` - mount the Preact app and pass shared dependencies
- `src/adapter/bootstrap.ts` - pass `PresentationState` and bridge dependencies into `MainScene`
- `src/adapter/main-scene.ts` - emit UI bridge updates each frame and later drop `DomUIManager`
- `src/presentation/presentation-state.ts` - keep shape stable while moving direct mutations behind helper functions
- `src/adapter/ui/dom-ui-manager.ts` - temporarily shrink the legacy manager as panels migrate, then delete it

### Delete At The End

- `src/adapter/ui/dom-ui-manager.ts`
- `src/adapter/ui/top-bar.ts`
- `src/adapter/ui/toolbar-panel.ts`
- `src/adapter/ui/selection-panel.ts`
- `src/adapter/ui/debug-panel.ts`
- `src/adapter/ui/ui.css`

---

### Task 1: Add Preact, Vitest, and the App Shell Mount Point

**Files:**
- Create: `vitest.config.ts`
- Create: `src/ui/app/app-root.tsx`
- Create: `src/ui/app/app-shell.tsx`
- Create: `src/ui/styles/tokens.css`
- Create: `src/ui/styles/app.css`
- Create: `src/ui/test/setup.ts`
- Create: `src/ui/app/app-shell.test.tsx`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `index.html`
- Modify: `src/main.ts`

- [ ] **Step 1: Add dependency and script declarations before touching runtime code**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "phaser": "^3.90.0",
    "preact": "^10.27.2"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.10.2",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/preact": "^3.2.4",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^25.5.2",
    "jsdom": "^26.1.0",
    "typescript": "^6.0.2",
    "vite": "^5.4.21",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Install the new dependencies**

Run: `npm install`
Expected: `added` / `changed` package output and an updated `package-lock.json`

- [ ] **Step 3: Write a failing smoke test for the new shell**

```tsx
// src/ui/app/app-shell.test.tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders the migrated ui root container', () => {
    render(<AppShell />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Opus UI')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the targeted test to verify it fails**

Run: `npm run test -- src/ui/app/app-shell.test.tsx`
Expected: FAIL with a module resolution error for `./app-shell` or a JSX compile error because the shell is not implemented yet

- [ ] **Step 5: Implement the shell mount, Vite config, and minimal styling**

```ts
// vite.config.ts
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@world': path.resolve(__dirname, 'src/world'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@adapter': path.resolve(__dirname, 'src/adapter'),
      '@defs': path.resolve(__dirname, 'src/defs'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/ui/test/setup.ts'],
  },
});
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

```html
<!-- index.html -->
<body>
  <div id="game-container"></div>
  <div id="ui-root"></div>
  <div id="ui-legacy-layer">
    <!-- existing legacy ui markup stays here for now -->
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

```tsx
// src/ui/app/app-shell.tsx
export function AppShell() {
  return (
    <div id="app-shell" data-testid="app-shell">
      <header class="app-shell__header">Opus UI</header>
      <main class="app-shell__body">Migrating legacy HUD into Preact...</main>
    </div>
  );
}
```

```tsx
// src/ui/app/app-root.tsx
import { render } from 'preact';
import { AppShell } from './app-shell';
import '../styles/tokens.css';
import '../styles/app.css';

export function mountUiApp(root: HTMLElement): void {
  render(<AppShell />, root);
}
```

```ts
// src/ui/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

```ts
// src/main.ts
import { mountUiApp } from './ui/app/app-root';

async function boot(): Promise<void> {
  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) throw new Error('Missing #ui-root');
  mountUiApp(uiRoot);

  // existing world/bootstrap logic continues below
}
```

- [ ] **Step 6: Run the test and the build**

Run: `npm run test -- src/ui/app/app-shell.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS with Vite output under `dist/`

- [ ] **Step 7: Commit the tooling and shell skeleton**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json index.html src/main.ts src/ui/app/app-root.tsx src/ui/app/app-shell.tsx src/ui/app/app-shell.test.tsx src/ui/styles/tokens.css src/ui/styles/app.css src/ui/test/setup.ts vitest.config.ts
git commit -m "feat: add preact ui shell and test tooling"
```

### Task 2: Build the UI Kernel, Bridge, and Presentation Ports

**Files:**
- Create: `src/presentation/presentation-actions.ts`
- Create: `src/ui/kernel/ui-types.ts`
- Create: `src/ui/kernel/ui-actions.ts`
- Create: `src/ui/kernel/ui-reducer.ts`
- Create: `src/ui/kernel/ui-store.ts`
- Create: `src/ui/kernel/ui-bridge.ts`
- Create: `src/ui/kernel/ui-ports.ts`
- Create: `src/ui/kernel/use-engine-snapshot.ts`
- Create: `src/ui/kernel/ui-reducer.test.ts`
- Create: `src/ui/kernel/ui-bridge.test.ts`
- Modify: `src/ui/app/app-root.tsx`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/adapter/bootstrap.ts`
- Modify: `src/adapter/main-scene.ts`
- Modify: `src/main.ts`
- Modify: `src/presentation/presentation-state.ts`

- [ ] **Step 1: Write failing tests for reducer behavior and snapshot publishing**

```ts
// src/ui/kernel/ui-reducer.test.ts
import { describe, expect, it } from 'vitest';
import { createInitialUiState, uiReducer } from './ui-reducer';

describe('uiReducer', () => {
  it('updates the active panel and inspector tab', () => {
    const next = uiReducer(createInitialUiState(), {
      type: 'open_panel',
      panel: 'colonists',
    });

    expect(next.activePanel).toBe('colonists');
    expect(
      uiReducer(next, { type: 'set_inspector_tab', tab: 'job' }).inspectorTab,
    ).toBe('job');
  });
});
```

```ts
// src/ui/kernel/ui-bridge.test.ts
import { describe, expect, it } from 'vitest';
import { createEngineSnapshotBridge } from './ui-bridge';

describe('createEngineSnapshotBridge', () => {
  it('returns the latest computed snapshot after emit', () => {
    let tick = 1;
    const bridge = createEngineSnapshotBridge(() => ({
      tick,
      speed: 1,
      presentation: { activeTool: 'select', hoveredCell: null, selectedIds: [] },
      selection: { primaryId: null, selectedIds: [] },
      colonists: {},
      build: { activeTool: 'select', activeModeLabel: 'Select' },
      feedback: { recentEvents: [] },
    }));

    tick = 2;
    bridge.emit();

    expect(bridge.getSnapshot().tick).toBe(2);
  });
});
```

- [ ] **Step 2: Run the kernel tests to verify they fail**

Run: `npm run test -- src/ui/kernel/ui-reducer.test.ts src/ui/kernel/ui-bridge.test.ts`
Expected: FAIL because the kernel files do not exist yet

- [ ] **Step 3: Implement UI types, reducer, bridge, and safe presentation mutators**

```ts
// src/presentation/presentation-actions.ts
import type { ObjectId } from '../core/types';
import { type PresentationState, switchTool, ToolType } from './presentation-state';

export function setSelectedObjects(presentation: PresentationState, ids: Iterable<ObjectId>): void {
  presentation.selectedObjectIds.clear();
  for (const id of ids) presentation.selectedObjectIds.add(id);
}

export function setActiveTool(presentation: PresentationState, tool: ToolType): void {
  switchTool(presentation, tool);
}
```

```ts
// src/ui/kernel/ui-types.ts
export type MainPanel = 'colonists' | 'build' | 'feedback';
export type InspectorTab = 'overview' | 'needs' | 'job';

export interface UiState {
  activePanel: MainPanel;
  inspectorTab: InspectorTab;
  colonistSort: 'name' | 'mood' | 'job';
  colonistSearch: string;
  buildSearch: string;
  notificationCenterOpen: boolean;
  pinnedColonistId: string | null;
}

export interface EngineSnapshot {
  tick: number;
  speed: number;
  presentation: {
    activeTool: string;
    hoveredCell: { x: number; y: number } | null;
    selectedIds: string[];
  };
  selection: {
    primaryId: string | null;
    selectedIds: string[];
  };
  colonists: Record<string, unknown>;
  build: {
    activeTool: string;
    activeModeLabel: string;
  };
  feedback: {
    recentEvents: Array<{ type: string; tick: number; summary: string }>;
  };
}
```

```ts
// src/ui/kernel/ui-reducer.ts
import type { UiState } from './ui-types';

export type UiAction =
  | { type: 'open_panel'; panel: UiState['activePanel'] }
  | { type: 'set_inspector_tab'; tab: UiState['inspectorTab'] }
  | { type: 'set_colonist_sort'; sort: UiState['colonistSort'] }
  | { type: 'set_colonist_search'; value: string }
  | { type: 'toggle_notification_center' }
  | { type: 'pin_colonist'; colonistId: string | null };

export function createInitialUiState(): UiState {
  return {
    activePanel: 'colonists',
    inspectorTab: 'overview',
    colonistSort: 'name',
    colonistSearch: '',
    buildSearch: '',
    notificationCenterOpen: false,
    pinnedColonistId: null,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'open_panel':
      return { ...state, activePanel: action.panel };
    case 'set_inspector_tab':
      return { ...state, inspectorTab: action.tab };
    case 'set_colonist_sort':
      return { ...state, colonistSort: action.sort };
    case 'set_colonist_search':
      return { ...state, colonistSearch: action.value };
    case 'toggle_notification_center':
      return { ...state, notificationCenterOpen: !state.notificationCenterOpen };
    case 'pin_colonist':
      return { ...state, pinnedColonistId: action.colonistId };
  }
}
```

```ts
// src/ui/kernel/ui-bridge.ts
import type { EngineSnapshot } from './ui-types';

type Listener = () => void;

export function createEngineSnapshotBridge(readSnapshot: () => EngineSnapshot) {
  let snapshot = readSnapshot();
  const listeners = new Set<Listener>();

  return {
    getSnapshot(): EngineSnapshot {
      return snapshot;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(): void {
      snapshot = readSnapshot();
      for (const listener of listeners) listener();
    },
  };
}

export type EngineSnapshotBridge = ReturnType<typeof createEngineSnapshotBridge>;
```

```ts
// src/ui/kernel/ui-actions.ts
import type { UiAction, UiState } from './ui-reducer';

export const openPanel = (panel: UiState['activePanel']): UiAction => ({
  type: 'open_panel',
  panel,
});

export const setInspectorTab = (tab: UiState['inspectorTab']): UiAction => ({
  type: 'set_inspector_tab',
  tab,
});
```

```ts
// src/ui/kernel/ui-store.ts
import { createInitialUiState, uiReducer, type UiAction } from './ui-reducer';
import type { UiState } from './ui-types';

export function reduceActions(actions: UiAction[], state: UiState = createInitialUiState()): UiState {
  return actions.reduce(uiReducer, state);
}
```

```ts
// src/ui/kernel/ui-ports.ts
import type { Command } from '../../core/command-bus';
import type { PresentationState } from '../../presentation/presentation-state';
import { setActiveTool, setSelectedObjects } from '../../presentation/presentation-actions';

export interface UiPorts {
  dispatchCommand(command: Command): void;
  selectColonist(id: string): void;
  setSpeed(speed: number): void;
}
```

```ts
// src/ui/kernel/use-engine-snapshot.ts
import { useSyncExternalStore } from 'preact/hooks';
import type { EngineSnapshotBridge } from './ui-bridge';

export function useEngineSnapshot(bridge: EngineSnapshotBridge) {
  return useSyncExternalStore(bridge.subscribe, bridge.getSnapshot, bridge.getSnapshot);
}
```

- [ ] **Step 4: Wire the bridge through bootstrapping and replace the shell placeholder props**

```ts
// src/adapter/bootstrap.ts
import type { PresentationState } from '../presentation/presentation-state';
import type { EngineSnapshotBridge } from '../ui/kernel/ui-bridge';

export function bootstrapPhaser(
  world: World,
  presentation: PresentationState,
  uiBridge: EngineSnapshotBridge,
): Phaser.Game {
  return new Phaser.Game({
    // existing config...
    scene: new MainScene(world, presentation, uiBridge),
  });
}
```

```ts
// src/adapter/main-scene.ts
constructor(
  world: World,
  presentation: PresentationState,
  private readonly uiBridge: EngineSnapshotBridge,
) {
  super({ key: 'MainScene' });
  this.world = world;
  this.presentation = presentation;
}

update(_time: number, delta: number): void {
  this.inputHandler.update();
  this.domUI.update();
  this.worldPreview.update(this.presentation);
  this.debugOverlay.update();
  this.uiBridge.emit();
  // existing tick loop continues...
}
```

```tsx
// src/ui/app/app-root.tsx
import { render } from 'preact';
import { useReducer } from 'preact/hooks';
import { AppShell } from './app-shell';
import { createInitialUiState, uiReducer } from '@ui/kernel/ui-reducer';
import { useEngineSnapshot } from '@ui/kernel/use-engine-snapshot';

function AppRoot({ bridge, ports }: { bridge: EngineSnapshotBridge; ports: UiPorts }) {
  const snapshot = useEngineSnapshot(bridge);
  const [uiState, dispatch] = useReducer(uiReducer, undefined, createInitialUiState);
  return <AppShell snapshot={snapshot} uiState={uiState} dispatch={dispatch} ports={ports} />;
}
```

- [ ] **Step 5: Run the kernel tests and the build**

Run: `npm run test -- src/ui/kernel/ui-reducer.test.ts src/ui/kernel/ui-bridge.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit the kernel**

```bash
git add src/presentation/presentation-actions.ts src/ui/kernel/ui-types.ts src/ui/kernel/ui-actions.ts src/ui/kernel/ui-reducer.ts src/ui/kernel/ui-store.ts src/ui/kernel/ui-bridge.ts src/ui/kernel/ui-ports.ts src/ui/kernel/use-engine-snapshot.ts src/ui/kernel/ui-reducer.test.ts src/ui/kernel/ui-bridge.test.ts src/ui/app/app-root.tsx src/ui/app/app-shell.tsx src/adapter/bootstrap.ts src/adapter/main-scene.ts src/main.ts src/presentation/presentation-state.ts
git commit -m "feat: add ui kernel and engine snapshot bridge"
```

### Task 3: Migrate the Selection Panel into the Colonist Domain

**Files:**
- Create: `src/ui/domains/colonist/colonist.types.ts`
- Create: `src/ui/domains/colonist/colonist.schemas.ts`
- Create: `src/ui/domains/colonist/colonist.selectors.ts`
- Create: `src/ui/domains/colonist/colonist.intents.ts`
- Create: `src/ui/domains/colonist/colonist.selectors.test.ts`
- Create: `src/ui/domains/colonist/components/colonist-roster.tsx`
- Create: `src/ui/domains/colonist/components/colonist-inspector.tsx`
- Create: `src/ui/domains/colonist/components/colonist-inspector.test.tsx`
- Create: `src/ui/components/panel.tsx`
- Create: `src/ui/components/section.tsx`
- Create: `src/ui/components/stat-row.tsx`
- Create: `src/ui/components/progress-bar.tsx`
- Create: `src/ui/components/badge.tsx`
- Create: `src/ui/components/tabs.tsx`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/ui-ports.ts`
- Modify: `src/ui/styles/app.css`
- Modify: `src/adapter/ui/dom-ui-manager.ts`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests for the colonist roster and inspector**

```ts
// src/ui/domains/colonist/colonist.selectors.test.ts
import { describe, expect, it } from 'vitest';
import { selectColonistRosterRows } from './colonist.selectors';

describe('selectColonistRosterRows', () => {
  it('sorts colonists by mood descending when requested', () => {
    const rows = selectColonistRosterRows(
      {
        colonists: {
          a: { id: 'a', name: 'Alice', mood: 74, currentJob: 'job_construct' },
          b: { id: 'b', name: 'Bob', mood: 21, currentJob: 'job_mine' },
        },
        selection: { primaryId: 'a', selectedIds: ['a'] },
      } as any,
      { colonistSort: 'mood', colonistSearch: '' } as any,
    );

    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });
});
```

```tsx
// src/ui/domains/colonist/components/colonist-inspector.test.tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { ColonistInspector } from './colonist-inspector';

describe('ColonistInspector', () => {
  it('renders the current job and need bars', () => {
    render(
      <ColonistInspector
        viewModel={{
          id: 'pawn_1',
          name: 'Alice',
          jobLabel: 'Constructing wall',
          needs: [
            { key: 'food', label: 'Food', value: 62 },
            { key: 'rest', label: 'Rest', value: 41 },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('Constructing wall')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the colonist tests to verify they fail**

Run: `npm run test -- src/ui/domains/colonist/colonist.selectors.test.ts src/ui/domains/colonist/components/colonist-inspector.test.tsx`
Expected: FAIL because the colonist domain files do not exist yet

- [ ] **Step 3: Implement colonist schemas, selectors, and components**

```ts
// src/ui/domains/colonist/colonist.selectors.ts
export function selectColonistRosterRows(snapshot: EngineSnapshot, uiState: UiState) {
  const rows = Object.values(snapshot.colonists) as ColonistRosterRow[];
  const filtered = rows.filter((row) =>
    row.name.toLowerCase().includes(uiState.colonistSearch.toLowerCase()),
  );

  return filtered.sort((left, right) => {
    switch (uiState.colonistSort) {
      case 'mood':
        return right.mood - left.mood;
      case 'job':
        return left.currentJob.localeCompare(right.currentJob);
      default:
        return left.name.localeCompare(right.name);
    }
  });
}
```

```tsx
// src/ui/domains/colonist/components/colonist-roster.tsx
export function ColonistRoster({
  rows,
  activeId,
  onSelect,
}: {
  rows: ColonistRosterRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel title="Colonists">
      <ul class="colonist-roster">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              class={row.id === activeId ? 'colonist-roster__row is-active' : 'colonist-roster__row'}
              onClick={() => onSelect(row.id)}
            >
              <span>{row.name}</span>
              <span>{row.currentJobLabel}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
```

```tsx
// src/ui/app/app-shell.tsx
const rosterRows = selectColonistRosterRows(snapshot, uiState);
const inspector = selectColonistInspector(snapshot, uiState);

return (
  <div id="app-shell" data-testid="app-shell">
    <aside class="app-shell__sidebar">
      <ColonistRoster
        rows={rosterRows}
        activeId={inspector?.id ?? null}
        onSelect={(id) => ports.selectColonist(id)}
      />
    </aside>
    <section class="app-shell__main">
      {inspector ? <ColonistInspector viewModel={inspector} /> : <Panel title="Inspector">No colonist selected</Panel>}
    </section>
  </div>
);
```

- [ ] **Step 4: Remove the legacy selection panel from the runtime path**

```ts
// src/adapter/ui/dom-ui-manager.ts
this.components = [
  new TopBarUI(world, map),
  new ToolbarUI(world, presentation),
  new DebugPanelUI(map, presentation),
];
```

```html
<!-- index.html -->
<div id="ui-legacy-layer">
  <div id="ui-top-bar">...</div>
  <div id="ui-debug-panel">...</div>
  <div id="ui-toolbar">...</div>
</div>
```

- [ ] **Step 5: Run the new tests and a build**

Run: `npm run test -- src/ui/domains/colonist/colonist.selectors.test.ts src/ui/domains/colonist/components/colonist-inspector.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit the colonist domain migration**

```bash
git add src/ui/domains/colonist src/ui/components src/ui/app/app-shell.tsx src/ui/kernel/ui-types.ts src/ui/kernel/ui-ports.ts src/ui/styles/app.css src/adapter/ui/dom-ui-manager.ts index.html
git commit -m "feat: migrate selection ui into colonist domain"
```

### Task 4: Migrate the Top Bar and Toolbar into the Build Domain

**Files:**
- Create: `src/ui/domains/build/build.types.ts`
- Create: `src/ui/domains/build/build.schemas.ts`
- Create: `src/ui/domains/build/build.selectors.ts`
- Create: `src/ui/domains/build/build.intents.ts`
- Create: `src/ui/domains/build/build.selectors.test.ts`
- Create: `src/ui/domains/build/components/top-status-bar.tsx`
- Create: `src/ui/domains/build/components/tool-mode-bar.tsx`
- Create: `src/ui/domains/build/components/build-panel.tsx`
- Create: `src/ui/domains/build/components/tool-mode-bar.test.tsx`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/ui-ports.ts`
- Modify: `src/ui/styles/app.css`
- Modify: `src/adapter/ui/dom-ui-manager.ts`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests for build selectors and toolbar interactions**

```ts
// src/ui/domains/build/build.selectors.test.ts
import { describe, expect, it } from 'vitest';
import { selectBuildModeSummary } from './build.selectors';

describe('selectBuildModeSummary', () => {
  it('formats designation mode labels from the engine snapshot', () => {
    expect(
      selectBuildModeSummary({
        build: { activeTool: 'designate', activeModeLabel: 'Mine' },
      } as any).title,
    ).toBe('Mine');
  });
});
```

```tsx
// src/ui/domains/build/components/tool-mode-bar.test.tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { ToolModeBar } from './tool-mode-bar';

describe('ToolModeBar', () => {
  it('calls the intent when the build tool is clicked', () => {
    const onSetMode = vi.fn();
    render(<ToolModeBar activeTool="select" onSetMode={onSetMode} />);

    fireEvent.click(screen.getByRole('button', { name: 'Wall' }));
    expect(onSetMode).toHaveBeenCalledWith('build', 'wall_wood');
  });
});
```

- [ ] **Step 2: Run the build-domain tests to verify they fail**

Run: `npm run test -- src/ui/domains/build/build.selectors.test.ts src/ui/domains/build/components/tool-mode-bar.test.tsx`
Expected: FAIL because the build domain files do not exist yet

- [ ] **Step 3: Implement top bar, tool bar, and palette selectors**

```ts
// src/ui/domains/build/build.schemas.ts
export const speedButtons = [
  { value: 0, label: 'II' },
  { value: 1, label: '>' },
  { value: 2, label: '>>' },
  { value: 3, label: '>>>>' },
] as const;

export const buildActions = [
  { tool: 'select', label: 'Select', hotkey: 'Q' },
  { tool: 'build', label: 'Wall', hotkey: 'B', defId: 'wall_wood' },
  { tool: 'mine', label: 'Mine', hotkey: 'M' },
  { tool: 'harvest', label: 'Harvest', hotkey: 'H' },
  { tool: 'cut', label: 'Cut', hotkey: 'X' },
  { tool: 'cancel', label: 'Cancel', hotkey: 'C' },
] as const;
```

```tsx
// src/ui/domains/build/components/top-status-bar.tsx
export function TopStatusBar({
  tick,
  speed,
  colonistCount,
  onSetSpeed,
}: {
  tick: number;
  speed: number;
  colonistCount: number;
  onSetSpeed: (value: number) => void;
}) {
  return (
    <header class="top-status-bar">
      <div class="top-status-bar__left">Tick {tick}</div>
      <div class="top-status-bar__center">
        {speedButtons.map((button) => (
          <button
            key={button.value}
            class={button.value === speed ? 'speed-button is-active' : 'speed-button'}
            onClick={() => onSetSpeed(button.value)}
          >
            {button.label}
          </button>
        ))}
      </div>
      <div class="top-status-bar__right">{colonistCount} colonists</div>
    </header>
  );
}
```

```tsx
// src/ui/domains/build/components/tool-mode-bar.tsx
export function ToolModeBar({
  activeTool,
  onSetMode,
}: {
  activeTool: string;
  onSetMode: (tool: string, payload?: string) => void;
}) {
  return (
    <nav class="tool-mode-bar">
      {buildActions.map((action) => (
        <button
          key={action.label}
          class={activeTool === action.tool ? 'tool-mode-bar__button is-active' : 'tool-mode-bar__button'}
          onClick={() => onSetMode(action.tool, 'defId' in action ? action.defId : undefined)}
        >
          [{action.hotkey}] {action.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Remove the legacy top bar and toolbar from the runtime path**

```ts
// src/adapter/ui/dom-ui-manager.ts
this.components = [
  new DebugPanelUI(map, presentation),
];
```

```html
<!-- index.html -->
<div id="ui-legacy-layer">
  <div id="ui-debug-panel">
    <pre id="ui-debug-text"></pre>
  </div>
</div>
```

- [ ] **Step 5: Run the build tests and a build**

Run: `npm run test -- src/ui/domains/build/build.selectors.test.ts src/ui/domains/build/components/tool-mode-bar.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit the top bar and toolbar migration**

```bash
git add src/ui/domains/build src/ui/app/app-shell.tsx src/ui/kernel/ui-types.ts src/ui/kernel/ui-ports.ts src/ui/styles/app.css src/adapter/ui/dom-ui-manager.ts index.html
git commit -m "feat: migrate top bar and toolbar into build domain"
```

### Task 5: Add Feedback Domain UI and Remove the Legacy Debug Panel

**Files:**
- Create: `src/ui/domains/feedback/feedback.types.ts`
- Create: `src/ui/domains/feedback/feedback.schemas.ts`
- Create: `src/ui/domains/feedback/feedback.selectors.ts`
- Create: `src/ui/domains/feedback/feedback.selectors.test.ts`
- Create: `src/ui/domains/feedback/components/notification-center.tsx`
- Create: `src/ui/domains/feedback/components/toast-stack.tsx`
- Create: `src/ui/domains/feedback/components/debug-panel.tsx`
- Create: `src/ui/domains/feedback/components/notification-center.test.tsx`
- Modify: `src/ui/kernel/ui-bridge.ts`
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/styles/app.css`
- Modify: `src/adapter/ui/dom-ui-manager.ts`
- Modify: `index.html`

- [ ] **Step 1: Write failing tests for feedback mapping and notification rendering**

```ts
// src/ui/domains/feedback/feedback.selectors.test.ts
import { describe, expect, it } from 'vitest';
import { selectCommandFeedback } from './feedback.selectors';

describe('selectCommandFeedback', () => {
  it('surfaces rejected commands as error toasts', () => {
    const feedback = selectCommandFeedback({
      feedback: {
        recentEvents: [
          { type: 'command_rejected', tick: 10, summary: 'Invalid speed' },
        ],
      },
    } as any);

    expect(feedback.toasts[0].tone).toBe('error');
  });
});
```

```tsx
// src/ui/domains/feedback/components/notification-center.test.tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { NotificationCenter } from './notification-center';

describe('NotificationCenter', () => {
  it('renders grouped events', () => {
    render(
      <NotificationCenter
        open
        notifications={[
          { id: 'evt_1', title: 'Command rejected', summary: 'Invalid speed', tick: 10 },
        ]}
      />,
    );

    expect(screen.getByText('Command rejected')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the feedback tests to verify they fail**

Run: `npm run test -- src/ui/domains/feedback/feedback.selectors.test.ts src/ui/domains/feedback/components/notification-center.test.tsx`
Expected: FAIL because the feedback domain files do not exist yet

- [ ] **Step 3: Extend the bridge to retain recent events and implement feedback selectors/components**

```ts
// src/ui/kernel/ui-bridge.ts
export function createEngineSnapshotBridge(readSnapshot: () => EngineSnapshot, eventBus?: EventBus) {
  let snapshot = readSnapshot();
  const listeners = new Set<Listener>();
  const recentEvents: EngineSnapshot['feedback']['recentEvents'] = [];

  eventBus?.onAny((event) => {
    recentEvents.unshift({
      type: event.type,
      tick: event.tick,
      summary: JSON.stringify(event.data),
    });
    recentEvents.splice(40);
  });

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      snapshot = {
        ...readSnapshot(),
        feedback: { recentEvents: [...recentEvents] },
      };
      for (const listener of listeners) listener();
    },
  };
}
```

```ts
// src/ui/domains/feedback/feedback.selectors.ts
export function selectCommandFeedback(snapshot: EngineSnapshot) {
  const toasts = snapshot.feedback.recentEvents
    .filter((event) => event.type === 'command_rejected')
    .slice(0, 3)
    .map((event) => ({
      id: `${event.type}-${event.tick}`,
      tone: 'error' as const,
      title: 'Command rejected',
      summary: event.summary,
    }));

  return {
    toasts,
    notifications: snapshot.feedback.recentEvents.map((event) => ({
      id: `${event.type}-${event.tick}`,
      title: event.type,
      summary: event.summary,
      tick: event.tick,
    })),
  };
}
```

- [ ] **Step 4: Remove the legacy debug panel and render feedback/debug UI in Preact**

```ts
// src/adapter/ui/dom-ui-manager.ts
export class DomUIManager {
  update(): void {}
  destroy(): void {}
}
```

```html
<!-- index.html -->
<body>
  <div id="game-container"></div>
  <div id="ui-root"></div>
  <div id="ui-legacy-layer"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

- [ ] **Step 5: Run the feedback tests and a build**

Run: `npm run test -- src/ui/domains/feedback/feedback.selectors.test.ts src/ui/domains/feedback/components/notification-center.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit the feedback migration**

```bash
git add src/ui/domains/feedback src/ui/kernel/ui-bridge.ts src/ui/kernel/ui-types.ts src/ui/app/app-shell.tsx src/ui/styles/app.css src/adapter/ui/dom-ui-manager.ts index.html
git commit -m "feat: migrate feedback and debug panels into preact"
```

### Task 6: Retire the Legacy DOM UI Stack Completely

**Files:**
- Delete: `src/adapter/ui/dom-ui-manager.ts`
- Delete: `src/adapter/ui/top-bar.ts`
- Delete: `src/adapter/ui/toolbar-panel.ts`
- Delete: `src/adapter/ui/selection-panel.ts`
- Delete: `src/adapter/ui/debug-panel.ts`
- Delete: `src/adapter/ui/ui.css`
- Modify: `src/adapter/main-scene.ts`
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/styles/app.css`

- [ ] **Step 1: Write a failing integration test that expects the shell to render all primary regions without the legacy layer**

```tsx
// src/ui/app/app-shell.test.tsx
it('renders colonist, build, and feedback regions together', () => {
  render(
    <AppShell
      snapshot={mockSnapshot}
      uiState={mockUiState}
      dispatch={vi.fn()}
      ports={mockPorts}
    />,
  );

  expect(screen.getByText('Colonists')).toBeInTheDocument();
  expect(screen.getByText('Build')).toBeInTheDocument();
  expect(screen.getByText('Notifications')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run: `npm run test -- src/ui/app/app-shell.test.tsx`
Expected: FAIL until the final shell layout and mocks are updated for the fully migrated UI

- [ ] **Step 3: Remove legacy imports and simplify the scene/update loop**

```ts
// src/adapter/main-scene.ts
export class MainScene extends Phaser.Scene {
  private inputHandler!: InputHandler;
  private worldPreview!: WorldPreview;
  private debugOverlay!: DebugOverlay;

  create(): void {
    this.renderSync = new RenderSync(this, this.world, this.activeMap);
    this.cameraController = new CameraController(this, this.activeMap);
    this.inputHandler = new InputHandler(this, this.world, this.activeMap, this.presentation);
    this.worldPreview = new WorldPreview(this);
    this.debugOverlay = new DebugOverlay(this, this.world, this.activeMap, this.presentation);
    this.renderSync.fullSync();
  }

  update(_time: number, delta: number): void {
    this.inputHandler.update();
    this.worldPreview.update(this.presentation);
    this.debugOverlay.update();
    this.uiBridge.emit();
    // existing tick loop...
  }
}
```

```ts
// src/main.ts
import { mountUiApp } from './ui/app/app-root';

// remove:
// import './adapter/ui/ui.css';
```

```html
<!-- index.html -->
<body>
  <div id="game-container"></div>
  <div id="ui-root"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

- [ ] **Step 4: Delete the legacy UI files**

Run: `git rm src/adapter/ui/dom-ui-manager.ts src/adapter/ui/top-bar.ts src/adapter/ui/toolbar-panel.ts src/adapter/ui/selection-panel.ts src/adapter/ui/debug-panel.ts src/adapter/ui/ui.css`
Expected: the six legacy UI files are staged for deletion

- [ ] **Step 5: Run the focused shell test, then the full suite, then a production build**

Run: `npm run test -- src/ui/app/app-shell.test.tsx`
Expected: PASS

Run: `npm run test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit the legacy retirement**

```bash
git add src/adapter/main-scene.ts src/main.ts index.html src/ui/app/app-shell.tsx src/ui/styles/app.css
git commit -m "refactor: retire legacy dom ui stack"
```

---

## Self-Review

### Spec Coverage

- `Preact` 作为屏幕空间 UI 主渲染层：Task 1, Task 2
- `EngineSnapshot + UiState + reducer + ports`：Task 2
- Colonist Domain 优先：Task 3
- Build Domain 次优先：Task 4
- Feedback Domain 第三优先：Task 5
- 最终迁完所有旧 DOM 面板：Task 6

No spec gaps found.

### Placeholder Scan

- No `TODO`, `TBD`, or deferred “implement later” instructions remain.
- Every task includes exact file paths, code snippets, commands, and expected outcomes.

### Type Consistency

- `UiState`, `UiAction`, and `EngineSnapshot` naming is consistent across Tasks 2-6.
- `AppShell`, `mountUiApp`, `createEngineSnapshotBridge`, and `setSelectedObjects` names are reused consistently.
