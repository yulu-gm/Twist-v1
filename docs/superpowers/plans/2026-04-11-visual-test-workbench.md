# Visual Test Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `visual-test` into a single-page scenario workbench that loads a selected scenario into a manual-start `ready` state, exposes visible time controls, supports stepping to the next gate, and lets users restart or return to scenario selection without page reload.

**Architecture:** Keep the existing `scenario-select.html` entry and `scenario-select-main.ts` bootstrap, but split responsibilities more clearly. Move page-shell orchestration into a testable workbench bootstrap module, upgrade the visual scenario controller from a one-shot runner into a full session lifecycle owner, and evolve the HUD into a right-side control panel with explicit actions and speed controls. Preserve the existing shadow-runner comparison model and Phaser bootstrap path, but make `Phaser.Game` teardown part of the controller contract.

**Tech Stack:** TypeScript, Preact, Phaser 3, Vitest, existing `src/testing/visual-runner` workbench files, `createScenarioHarness`, `bootstrapPhaser`, DOM-based selector page

---

## File Structure

### Create

- `src/testing/visual-runner/scenario-workbench-app.ts` - testable page-shell bootstrap for selector mode, workbench mode, URL sync, and controller wiring
- `src/testing/visual-runner/scenario-workbench-app.test.tsx` - jsdom tests for route loading, ready-state entry, and exit-to-selector behavior
- `src/testing/visual-runner/visual-scenario-controller.test.ts` - controller lifecycle tests for start, destroy, restart, stepping, and next-gate behavior

### Modify

- `src/testing/visual-runner/scenario-select-main.ts` - reduce to a thin entrypoint that calls the workbench app bootstrap
- `src/testing/visual-runner/visual-scenario-controller.ts` - expand from one-shot `run()` controller into a session lifecycle owner with explicit states and debug controls
- `src/testing/visual-runner/scenario-hud.tsx` - add workbench controls, richer status display, and callback-driven action props
- `src/testing/visual-runner/scenario-hud.test.tsx` - cover `ready/running/paused/completed/failed` states and debug-control enablement
- `scenario-select.html` - adjust layout to support a richer right-side workbench panel without breaking selector mode
- `docs/testing/scenario-testing.md` - document the new ready-state flow, workbench controls, and back-to-selector behavior

### Keep As-Is Unless Verification Forces Changes

- `src/adapter/bootstrap.ts` - already returns `Phaser.Game`; no planned behavior change, but the controller must now retain and destroy that return value
- `src/testing/visual-runner/shadow-runner.ts` - reused as-is for divergence reporting

---

### Task 1: Upgrade The HUD Into A Workbench Control Panel

**Files:**
- Modify: `src/testing/visual-runner/scenario-hud.tsx`
- Modify: `src/testing/visual-runner/scenario-hud.test.tsx`

- [ ] **Step 1: Write failing HUD tests for the new workbench states and controls**

```ts
// src/testing/visual-runner/scenario-hud.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { h } from 'preact';
import { fireEvent, render } from '@testing-library/preact';
import { SimSpeed } from '../../core/types';
import { ScenarioHud } from './scenario-hud';

describe('ScenarioHud', () => {
  it('shows the ready-state start action without step buttons enabled', () => {
    const onStart = vi.fn();
    const { getByRole, queryByRole, getByText } = render(
      h(ScenarioHud, {
        scenarioId: 'woodcutting',
        title: '砍树',
        sessionStatus: 'ready',
        currentTick: 0,
        currentSpeed: SimSpeed.Paused,
        currentSpeedLabel: 'Paused',
        currentStepTitle: '',
        visualSteps: [],
        shadowSteps: [],
        divergence: null,
        onStart,
      }),
    );

    fireEvent.click(getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(queryByRole('button', { name: '+1 tick' })).toBeNull();
    expect(getByText('Status: ready')).toBeTruthy();
  });

  it('shows paused debug controls and enables stepping callbacks', () => {
    const onStepTicks = vi.fn();
    const onRunToNextGate = vi.fn();
    const onResume = vi.fn();
    const { getByRole, getByText } = render(
      h(ScenarioHud, {
        scenarioId: 'stockpile-haul',
        title: '搬运进 Stockpile',
        sessionStatus: 'paused',
        currentTick: 42,
        currentSpeed: SimSpeed.Paused,
        currentSpeedLabel: 'Paused',
        currentStepTitle: '等待木材进入 stockpile',
        visualSteps: [{ title: '等待木材进入 stockpile', status: 'running' }],
        shadowSteps: [{ title: '等待木材进入 stockpile', status: 'passed' }],
        divergence: null,
        onResume,
        onStepTicks,
        onRunToNextGate,
      }),
    );

    fireEvent.click(getByRole('button', { name: '+1 tick' }));
    fireEvent.click(getByRole('button', { name: '+10 ticks' }));
    fireEvent.click(getByRole('button', { name: 'Run to Next Gate' }));
    fireEvent.click(getByRole('button', { name: 'Resume' }));

    expect(onStepTicks).toHaveBeenNthCalledWith(1, 1);
    expect(onStepTicks).toHaveBeenNthCalledWith(2, 10);
    expect(onRunToNextGate).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(getByText('Tick: 42')).toBeTruthy();
    expect(getByText('Speed: Paused')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the targeted HUD test file to confirm the current component is missing the workbench controls**

Run: `npx vitest run src/testing/visual-runner/scenario-hud.test.tsx`

Expected: FAIL with missing props such as `sessionStatus` and missing buttons such as `Start` or `Run to Next Gate`

- [ ] **Step 3: Expand the HUD props and render the workbench control sections**

```tsx
// src/testing/visual-runner/scenario-hud.tsx
import { h } from 'preact';
import { SimSpeed } from '../../core/types';
import type { ScenarioStepStatus } from '../scenario-dsl/scenario.types';
import type { DivergenceRecord } from './shadow-runner';
import type { ControllerSessionStatus } from './visual-scenario-controller';

export interface StepSummary {
  title: string;
  status: ScenarioStepStatus;
}

export interface ScenarioHudProps {
  scenarioId?: string;
  title: string;
  sessionStatus: ControllerSessionStatus;
  currentTick?: number;
  currentSpeed: SimSpeed;
  currentSpeedLabel: string;
  currentStepTitle?: string;
  visualSteps: StepSummary[];
  shadowSteps: StepSummary[];
  divergence: DivergenceRecord | null;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onBackToScenarios?: () => void;
  onSetSpeed?: (speed: SimSpeed) => void;
  onStepTicks?: (count: number) => void;
  onRunToNextGate?: () => void;
}

function ActionBar(props: ScenarioHudProps) {
  const { sessionStatus, onStart, onPause, onResume, onRestart, onBackToScenarios } = props;

  return (
    <section style={{ padding: '12px', borderBottom: '1px solid #333' }}>
      {sessionStatus === 'ready' && <button onClick={onStart}>Start</button>}
      {sessionStatus === 'running' && <button onClick={onPause}>Pause</button>}
      {sessionStatus === 'paused' && <button onClick={onResume}>Resume</button>}
      {(sessionStatus === 'paused' || sessionStatus === 'completed' || sessionStatus === 'failed') && (
        <button onClick={onRestart}>Restart</button>
      )}
      <button onClick={onBackToScenarios}>Back to Scenarios</button>
    </section>
  );
}

function TimeControls(props: ScenarioHudProps) {
  const { sessionStatus, currentSpeed, onSetSpeed, onStepTicks, onRunToNextGate } = props;
  const canStep = sessionStatus === 'paused';
  const canChangeSpeed = sessionStatus !== 'ready';

  return (
    <section style={{ padding: '12px', borderBottom: '1px solid #333' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.Paused} onClick={() => onSetSpeed?.(SimSpeed.Paused)}>Pause</button>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.Normal} onClick={() => onSetSpeed?.(SimSpeed.Normal)}>1x</button>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.Fast} onClick={() => onSetSpeed?.(SimSpeed.Fast)}>2x</button>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.UltraFast} onClick={() => onSetSpeed?.(SimSpeed.UltraFast)}>3x</button>
      </div>
      {canStep && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => onStepTicks?.(1)}>+1 tick</button>
          <button onClick={() => onStepTicks?.(10)}>+10 ticks</button>
          <button onClick={onRunToNextGate}>Run to Next Gate</button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Update the header and summary display so the workbench state is visible at a glance**

```tsx
// inside ScenarioHud()
<header
  style={{
    padding: '12px',
    borderBottom: '1px solid #333',
    backgroundColor: 'rgba(30,30,60,0.9)',
  }}
>
  <h1 style={{ fontSize: '16px', margin: 0 }}>Scenario: {title}</h1>
  {scenarioId && <p style={{ margin: '4px 0 0', color: '#93c5fd' }}>ID: {scenarioId}</p>}
  <p style={{ margin: '4px 0 0', color: '#aaa' }}>Status: {sessionStatus}</p>
  <p style={{ margin: '4px 0 0', color: '#aaa' }}>Tick: {currentTick ?? 0}</p>
  <p style={{ margin: '4px 0 0', color: '#aaa' }}>Speed: {currentSpeedLabel}</p>
  {currentStepTitle && (
    <p style={{ margin: '4px 0 0', color: '#3b82f6' }}>当前步骤: {currentStepTitle}</p>
  )}
</header>
```

- [ ] **Step 5: Re-run the HUD tests**

Run: `npx vitest run src/testing/visual-runner/scenario-hud.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit the HUD workbench controls**

```bash
git add src/testing/visual-runner/scenario-hud.tsx src/testing/visual-runner/scenario-hud.test.tsx
git commit -m "feat: add visual workbench hud controls"
```

---

### Task 2: Turn The Visual Controller Into A Session Lifecycle Owner

**Files:**
- Create: `src/testing/visual-runner/visual-scenario-controller.test.ts`
- Modify: `src/testing/visual-runner/visual-scenario-controller.ts`

- [ ] **Step 1: Write failing controller tests for ready state, bootstrap, destroy, and restart**

```ts
// src/testing/visual-runner/visual-scenario-controller.test.ts
import { describe, expect, it, vi } from 'vitest';
import { SimSpeed } from '../../core/types';
import { createScenario } from '../scenario-dsl/scenario.builders';
import { createVisualScenarioController } from './visual-scenario-controller';

describe('createVisualScenarioController', () => {
  it('starts in ready state and does not bootstrap Phaser until start() is called', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const scenario = createScenario({
      id: 'ready-state',
      title: 'ready state',
      setup: [],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });

    expect(controller.getState().sessionStatus).toBe('ready');
    expect(bootstrapGame).not.toHaveBeenCalled();

    await controller.start();

    expect(bootstrapGame).toHaveBeenCalledTimes(1);
    expect(controller.getState().sessionStatus).toBe('completed');
  });

  it('destroy() tears down the Phaser game and restart() resets the session state', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const scenario = createScenario({
      id: 'restartable',
      title: 'restartable',
      setup: [],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });
    await controller.start();

    await controller.restart();
    expect(fakeGame.destroy).toHaveBeenCalledWith(true);
    expect(controller.getState().sessionStatus).toBe('ready');
    expect(controller.getState().currentTick).toBe(0);
    expect(controller.getState().result).toBeNull();

    await controller.destroy();
  });
});
```

- [ ] **Step 2: Run the controller test file to verify the current one-shot controller does not satisfy the lifecycle contract**

Run: `npx vitest run src/testing/visual-runner/visual-scenario-controller.test.ts`

Expected: FAIL with missing `sessionStatus`, missing `start()/restart()/destroy()`, and no dependency injection point for `bootstrapGame`

- [ ] **Step 3: Add explicit controller state, dependency injection, and retained Phaser teardown**

```ts
// src/testing/visual-runner/visual-scenario-controller.ts
import type Phaser from 'phaser';
import { bootstrapPhaser } from '../../adapter/bootstrap';
import { SimSpeed } from '../../core/types';

export type ControllerSessionStatus = 'ready' | 'running' | 'paused' | 'completed' | 'failed';

export interface ControllerState {
  scenarioId: string;
  title: string;
  sessionStatus: ControllerSessionStatus;
  currentTick: number;
  currentSpeed: SimSpeed;
  currentSpeedLabel: string;
  currentStepTitle: string;
  visualSteps: StepSummary[];
  shadowSteps: StepSummary[];
  divergence: DivergenceRecord | null;
  done: boolean;
  result: ScenarioResult | null;
}

export interface VisualScenarioControllerDeps {
  bootstrapGame?: typeof bootstrapPhaser;
  clearGameContainer?: (parentId: string) => void;
}

function formatSpeedLabel(speed: SimSpeed): string {
  return speed === SimSpeed.Paused ? 'Paused'
    : speed === SimSpeed.Normal ? '1x'
    : speed === SimSpeed.Fast ? '2x'
    : '3x';
}

export function createVisualScenarioController(
  scenario: ScenarioDefinition,
  onStateChange: (state: ControllerState) => void,
  deps: VisualScenarioControllerDeps = {},
) {
  const bootstrapGame = deps.bootstrapGame ?? bootstrapPhaser;
  const clearGameContainer = deps.clearGameContainer ?? ((parentId: string) => {
    const el = document.getElementById(parentId);
    if (el) el.innerHTML = '';
  });

  let game: Phaser.Game | null = null;
  let disposed = false;
  let visualHarness = createScenarioHarness({ seed: 12345 });
  let shadowHarness = createScenarioHarness({ seed: 12345 });
  const state: ControllerState = {
    scenarioId: scenario.id,
    title: scenario.title,
    sessionStatus: 'ready',
    currentTick: 0,
    currentSpeed: SimSpeed.Paused,
    currentSpeedLabel: formatSpeedLabel(SimSpeed.Paused),
    currentStepTitle: '',
    visualSteps,
    shadowSteps,
    divergence: null,
    done: false,
    result: null,
  };
}
```

- [ ] **Step 4: Replace the old one-shot `run()` surface with lifecycle methods**

```ts
// return shape from createVisualScenarioController()
async function start(): Promise<void> {
  if (disposed || state.sessionStatus === 'running') return;
  if (!game) {
    game = bootstrapGame(visualHarness.world, undefined, undefined, 'scenario-game-container');
  }
  state.sessionStatus = 'running';
  visualHarness.world.speed = state.currentSpeed === SimSpeed.Paused ? SimSpeed.Normal : state.currentSpeed;
  emit();
  await runScenarioLoop('continuous');
}

function pause(): void {
  if (state.sessionStatus !== 'running') return;
  visualHarness.world.speed = SimSpeed.Paused;
  state.currentSpeed = SimSpeed.Paused;
  state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Paused);
  state.sessionStatus = 'paused';
  emit();
}

function resume(): void {
  if (state.sessionStatus !== 'paused') return;
  state.currentSpeed = state.currentSpeed === SimSpeed.Paused ? SimSpeed.Normal : state.currentSpeed;
  state.currentSpeedLabel = formatSpeedLabel(state.currentSpeed);
  state.sessionStatus = 'running';
  visualHarness.world.speed = state.currentSpeed;
  emit();
  void runScenarioLoop('continuous');
}

function setSpeed(speed: SimSpeed): void {
  if (state.sessionStatus === 'ready' || state.sessionStatus === 'completed' || state.sessionStatus === 'failed') return;
  state.currentSpeed = speed;
  state.currentSpeedLabel = formatSpeedLabel(speed);
  visualHarness.world.speed = speed;
  state.sessionStatus = speed === SimSpeed.Paused ? 'paused' : 'running';
  emit();
}

async function destroy(): Promise<void> {
  disposed = true;
  game?.destroy(true);
  game = null;
  clearGameContainer('scenario-game-container');
}

async function restart(): Promise<void> {
  await destroy();
  return rebuildFreshSession();
}
```

- [ ] **Step 5: Re-run the controller tests**

Run: `npx vitest run src/testing/visual-runner/visual-scenario-controller.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the controller lifecycle refactor**

```bash
git add src/testing/visual-runner/visual-scenario-controller.ts src/testing/visual-runner/visual-scenario-controller.test.ts
git commit -m "refactor: add visual scenario session lifecycle"
```

---

### Task 3: Add Paused Stepping And Run-To-Next-Gate Behavior

**Files:**
- Modify: `src/testing/visual-runner/visual-scenario-controller.ts`
- Modify: `src/testing/visual-runner/visual-scenario-controller.test.ts`

- [ ] **Step 1: Add failing controller tests for paused stepping and next-gate progression**

```ts
// append to src/testing/visual-runner/visual-scenario-controller.test.ts
import { createWaitForStep } from '../scenario-dsl/scenario.builders';

it('only allows manual stepTicks while paused', async () => {
  const scenario = createScenario({
    id: 'step-control',
    title: 'step control',
    setup: [],
    script: [createWaitForStep('wait forever until stepped', ({ query }) => Boolean(query.resolveAlias('done')), { timeoutTicks: 10 })],
    expect: [],
  });

  const controller = createVisualScenarioController(scenario, () => {});

  await controller.stepTicks(1);
  expect(controller.getState().currentTick).toBe(0);

  await controller.start();
  controller.pause();
  await controller.stepTicks(1);
  expect(controller.getState().currentTick).toBeGreaterThanOrEqual(1);
});

it('runUntilNextGate stops when the next wait condition becomes satisfied', async () => {
  let gateOpen = false;
  const scenario = createScenario({
    id: 'next-gate',
    title: 'next gate',
    setup: [],
    script: [
      createWaitForStep('wait for gate', () => gateOpen, { timeoutTicks: 50 }),
    ],
    expect: [],
  });

  const controller = createVisualScenarioController(scenario, () => {});
  await controller.start();
  controller.pause();

  setTimeout(() => {
    gateOpen = true;
  }, 0);

  await controller.runUntilNextGate();

  expect(controller.getState().sessionStatus).not.toBe('running');
  expect(controller.getState().currentStepTitle).toBe('wait for gate');
});
```

- [ ] **Step 2: Run the controller tests again to confirm stepping and next-gate logic is still missing**

Run: `npx vitest run src/testing/visual-runner/visual-scenario-controller.test.ts`

Expected: FAIL with missing `stepTicks()` semantics and missing `runUntilNextGate()` behavior

- [ ] **Step 3: Split scenario advancement into a reusable loop that can run continuously or until a gate**

```ts
// src/testing/visual-runner/visual-scenario-controller.ts
type RunMode = 'continuous' | 'next-gate';

async function runScenarioLoop(mode: RunMode): Promise<void> {
  while (!disposed && nextStepIndex < allSteps.length) {
    const step = allSteps[nextStepIndex];

    if (step.kind === 'setup' || step.kind === 'command') {
      const result = await executeVisualStep(step, contexts, nextStepIndex);
      consumeStepResult(result, nextStepIndex);
      nextStepIndex++;
      if (result.status === 'failed') return finalizeFailed(result);
      if (mode === 'next-gate' && step.kind === 'command') return parkPaused();
      continue;
    }

    if (step.kind === 'waitFor') {
      const result = await executeWaitForStep(step, nextStepIndex, mode);
      if (result.status === 'failed') return finalizeFailed(result);
      consumeStepResult(result, nextStepIndex);
      nextStepIndex++;
      return parkPaused();
    }

    const result = await executeVisualStep(step, contexts, nextStepIndex);
    consumeStepResult(result, nextStepIndex);
    nextStepIndex++;
    if (result.status === 'failed') return finalizeFailed(result);
  }

  finalizeCompleted();
}
```

- [ ] **Step 4: Implement paused-only stepping and next-gate parking**

```ts
// src/testing/visual-runner/visual-scenario-controller.ts
async function stepTicks(count: number): Promise<void> {
  if (state.sessionStatus !== 'paused' || count <= 0) return;
  visualHarness.stepTicks(count);
  state.currentTick = visualHarness.world.tick;
  emit();
}

async function runUntilNextGate(): Promise<void> {
  if (state.sessionStatus !== 'paused') return;
  state.sessionStatus = 'running';
  visualHarness.world.speed = state.currentSpeed === SimSpeed.Paused ? SimSpeed.Normal : state.currentSpeed;
  emit();
  await runScenarioLoop('next-gate');
}

function parkPaused(): void {
  visualHarness.world.speed = SimSpeed.Paused;
  state.currentSpeed = SimSpeed.Paused;
  state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Paused);
  state.sessionStatus = 'paused';
  emit();
}
```

- [ ] **Step 5: Re-run the controller lifecycle test file**

Run: `npx vitest run src/testing/visual-runner/visual-scenario-controller.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the stepping and next-gate behavior**

```bash
git add src/testing/visual-runner/visual-scenario-controller.ts src/testing/visual-runner/visual-scenario-controller.test.ts
git commit -m "feat: add visual scenario stepping controls"
```

---

### Task 4: Extract A Testable Workbench App And Wire Selector/URL Behavior

**Files:**
- Create: `src/testing/visual-runner/scenario-workbench-app.ts`
- Create: `src/testing/visual-runner/scenario-workbench-app.test.tsx`
- Modify: `src/testing/visual-runner/scenario-select-main.ts`
- Modify: `scenario-select.html`

- [ ] **Step 1: Write failing page-shell tests for ready-state loading and exit-to-selector URL cleanup**

```ts
// src/testing/visual-runner/scenario-workbench-app.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole } from '@testing-library/dom';
import { bootstrapScenarioWorkbench } from './scenario-workbench-app';

describe('bootstrapScenarioWorkbench', () => {
  it('loads a scenario from the URL into ready state without auto-starting', () => {
    const controller = {
      getState: () => ({
        scenarioId: 'woodcutting',
        title: '砍树',
        sessionStatus: 'ready',
        currentTick: 0,
        currentSpeed: 0,
        currentSpeedLabel: 'Paused',
        currentStepTitle: '',
        visualSteps: [],
        shadowSteps: [],
        divergence: null,
        done: false,
        result: null,
      }),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setSpeed: vi.fn(),
      stepTicks: vi.fn(),
      runUntilNextGate: vi.fn(),
      restart: vi.fn(),
      destroy: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    document.body.innerHTML = `
      <div id="select-root"></div>
      <div id="runner-root"><div id="scenario-game-container"></div><div id="scenario-ui-root"></div></div>
    `;

    bootstrapScenarioWorkbench({
      windowObject: new URL('http://localhost/scenario-select.html?scenario=woodcutting') as any,
      createController: () => controller as any,
    });

    expect(controller.start).not.toHaveBeenCalled();
    expect(document.getElementById('runner-root')?.classList.contains('active')).toBe(true);
  });

  it('returns to selector mode and clears the scenario query when Back to Scenarios is clicked', async () => {
    const controller = {
      getState: () => ({
        scenarioId: 'woodcutting',
        title: '砍树',
        sessionStatus: 'ready',
        currentTick: 0,
        currentSpeed: 0,
        currentSpeedLabel: 'Paused',
        currentStepTitle: '',
        visualSteps: [],
        shadowSteps: [],
        divergence: null,
        done: false,
        result: null,
      }),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setSpeed: vi.fn(),
      stepTicks: vi.fn(),
      runUntilNextGate: vi.fn(),
      restart: vi.fn(),
      destroy: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const historyPushState = vi.fn();
    document.body.innerHTML = `
      <div id="select-root"></div>
      <div id="runner-root"><div id="scenario-game-container"></div><div id="scenario-ui-root"></div></div>
    `;

    bootstrapScenarioWorkbench({
      windowObject: {
        location: new URL('http://localhost/scenario-select.html?scenario=woodcutting'),
        history: { pushState: historyPushState },
      } as any,
      createController: () => controller as any,
    });

    fireEvent.click(getByRole(document.body, 'button', { name: 'Back to Scenarios' }));

    expect(controller.destroy).toHaveBeenCalledTimes(1);
    expect(historyPushState).toHaveBeenLastCalledWith({}, '', 'http://localhost/scenario-select.html');
    expect(document.getElementById('select-root')?.classList.contains('active')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new workbench app tests to confirm there is no extracted page-shell module yet**

Run: `npx vitest run src/testing/visual-runner/scenario-workbench-app.test.tsx`

Expected: FAIL with missing module `./scenario-workbench-app`

- [ ] **Step 3: Create the workbench app bootstrap and move orchestration out of the side-effect entry file**

```ts
// src/testing/visual-runner/scenario-workbench-app.ts
import { h, render } from 'preact';
import { scenarioRegistry } from '../scenario-registry';
import { ScenarioHud } from './scenario-hud';
import { createVisualScenarioController } from './visual-scenario-controller';

export function bootstrapScenarioWorkbench({
  documentObject = document,
  windowObject = window,
  createController = createVisualScenarioController,
} = {}) {
  let activeController: ReturnType<typeof createVisualScenarioController> | null = null;

  function setScenarioQuery(id: string | null) {
    const url = new URL(windowObject.location.href);
    if (id) url.searchParams.set('scenario', id);
    else url.searchParams.delete('scenario');
    windowObject.history.pushState({}, '', url.toString());
  }

  function enterSelector(errorMsg: string | null = null) {
    activeController?.destroy();
    activeController = null;
    setScenarioQuery(null);
    showSelectPage(errorMsg);
  }

  function enterWorkbench(scenario) {
    setScenarioQuery(scenario.id);
    activeController?.destroy();
    activeController = createController(scenario, renderHud);
    toggleMode('workbench');
    renderHud(activeController.getState());
  }

  function renderHud(state) {
    render(
      h(ScenarioHud, {
        ...state,
        onStart: () => void activeController?.start(),
        onPause: () => activeController?.pause(),
        onResume: () => activeController?.resume(),
        onRestart: () => void activeController?.restart(),
        onBackToScenarios: () => void enterSelector(),
        onSetSpeed: (speed) => activeController?.setSpeed(speed),
        onStepTicks: (count) => void activeController?.stepTicks(count),
        onRunToNextGate: () => void activeController?.runUntilNextGate(),
      }),
      documentObject.getElementById('scenario-ui-root')!,
    );
  }

  function toggleMode(mode: 'selector' | 'workbench') {
    documentObject.getElementById('select-root')?.classList.toggle('active', mode === 'selector');
    documentObject.getElementById('runner-root')?.classList.toggle('active', mode === 'workbench');
  }

  function showSelectPage(errorMsg: string | null = null) {
    toggleMode('selector');
    const selectRoot = documentObject.getElementById('select-root')!;
    selectRoot.innerHTML = '';
    const wrapper = documentObject.createElement('div');
    wrapper.textContent = errorMsg ?? 'Scenario Visual Testing';
    selectRoot.appendChild(wrapper);
    render(null, documentObject.getElementById('scenario-ui-root')!);
  }

  const initialId = new URL(windowObject.location.href).searchParams.get('scenario');
  if (initialId) {
    const scenario = scenarioRegistry.find((entry) => entry.id === initialId);
    if (scenario) enterWorkbench(scenario);
    else enterSelector(`场景 "${initialId}" 不存在`);
  } else {
    enterSelector();
  }
}
```

- [ ] **Step 4: Reduce the entry file to a one-liner bootstrap**

```ts
// src/testing/visual-runner/scenario-select-main.ts
import { bootstrapScenarioWorkbench } from './scenario-workbench-app';

bootstrapScenarioWorkbench();
```

- [ ] **Step 5: Adjust the selector HTML layout so the larger workbench panel still fits**

```html
<!-- scenario-select.html -->
<style>
  body { background: #1a1a2e; color: #eee; font-family: monospace; min-height: 100vh; }
  #runner-root.active { display: flex; width: 100vw; height: 100vh; overflow: hidden; }
  #scenario-game-container { flex: 1; min-width: 0; height: 100vh; }
  #scenario-ui-root { width: 420px; flex: 0 0 420px; height: 100vh; }
</style>
```

- [ ] **Step 6: Run the shell and HUD tests together**

Run: `npx vitest run src/testing/visual-runner/scenario-workbench-app.test.tsx src/testing/visual-runner/scenario-hud.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit the workbench shell extraction**

```bash
git add src/testing/visual-runner/scenario-workbench-app.ts src/testing/visual-runner/scenario-workbench-app.test.tsx src/testing/visual-runner/scenario-select-main.ts scenario-select.html
git commit -m "feat: add visual scenario workbench shell"
```

---

### Task 5: Refresh The User-Facing Docs And Run Final Verification

**Files:**
- Modify: `docs/testing/scenario-testing.md`
- Test: `src/testing/visual-runner/scenario-hud.test.tsx`
- Test: `src/testing/visual-runner/visual-scenario-controller.test.ts`
- Test: `src/testing/visual-runner/scenario-workbench-app.test.tsx`

- [ ] **Step 1: Update the scenario testing doc so it matches the new manual-start workbench**

```md
<!-- docs/testing/scenario-testing.md -->
## 打开可视化验收

```bash
visual-test.bat
npm run scenario:visual:select
```

进入 `scenario-select.html` 后：

1. 先选择场景
2. 进入 `ready` 状态的工作台
3. 手动点击 `Start` 开始运行
4. 可在右侧工作台使用：
   - `Pause`
   - `1x / 2x / 3x`
   - `+1 tick`
   - `+10 ticks`
   - `Run to Next Gate`
   - `Restart`
   - `Back to Scenarios`
```

- [ ] **Step 2: Run the three targeted visual-runner test files**

Run: `npx vitest run src/testing/visual-runner/scenario-hud.test.tsx src/testing/visual-runner/visual-scenario-controller.test.ts src/testing/visual-runner/scenario-workbench-app.test.tsx`

Expected: PASS

- [ ] **Step 3: Run the project-wide typecheck**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 4: Run the existing scenario regression suite to make sure the workbench refactor did not break test infrastructure**

Run: `npm run test:scenario`

Expected: PASS

- [ ] **Step 5: Manually smoke the workbench entry**

Run: `npm run scenario:visual:select`

Expected:
- selector page opens
- choosing a scenario lands on a `ready` workbench rather than auto-running
- `Start` begins execution
- `Pause` stops the run
- `+1 tick`, `+10 ticks`, and `Run to Next Gate` are usable in `paused`
- `Back to Scenarios` returns to the selector without page reload
- selecting a second scenario does not reuse the old Phaser session

- [ ] **Step 6: Commit the docs update and final verification fixes**

```bash
git add docs/testing/scenario-testing.md src/testing/visual-runner
git commit -m "docs: update visual test workbench flow"
```

---

## Self-Review

### 1. Spec Coverage

- Single-page workbench flow: covered by Task 4
- Ready-not-auto-run behavior: covered by Task 2 and Task 4
- Visible time controls: covered by Task 1
- `+1 tick / +10 ticks / Run to Next Gate`: covered by Task 1 and Task 3
- Explicit controller lifecycle with `start/pause/resume/setSpeed/restart/destroy`: covered by Task 2 and Task 3
- URL sync and back-to-selector behavior: covered by Task 4
- Phaser teardown safety: covered by Task 2
- Testing strategy: covered by Tasks 1 through 5
- User docs refresh: covered by Task 5

### 2. Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes concrete files, commands, and expected outcomes.
- Code-changing steps include explicit snippets rather than vague descriptions.

### 3. Type Consistency

- Controller status is consistently named `ControllerSessionStatus`
- HUD props consistently use `sessionStatus`, `currentSpeed`, `currentSpeedLabel`
- Workbench callbacks consistently use `onStart`, `onPause`, `onResume`, `onRestart`, `onBackToScenarios`, `onSetSpeed`, `onStepTicks`, `onRunToNextGate`
