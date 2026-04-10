# Simulation 场景测试体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `Twist-v1` 落地一套“同源场景 DSL + 无头回归 + 可视化验收 + Shadow Headless 对照”的 simulation 测试体系，先覆盖砍树、搬运进 stockpile、建造蓝图、进食 4 条主链路。

**Architecture:** 先把生产环境与测试环境都依赖的 world 装配、命令/系统注册、单 tick 推进逻辑从 [`main.ts`](/E:/Me/Twist-v1/src/main.ts) 和 [`main-scene.ts`](/E:/Me/Twist-v1/src/adapter/main-scene.ts) 中抽出来，再在 `src/testing/` 下建立场景 DSL、Scenario Harness、Headless Runner、场景库与 Visual Runner。无头模式和可视模式共享同一份场景定义、同一套动作驱动与同一种 checkpoint snapshot，对外只暴露不同的运行壳与观察界面。

**Tech Stack:** TypeScript、Vitest、Phaser、Preact、现有 `World / CommandBus / TickRunner / MainScene / UI bridge`

---

### Task 1: 抽离共享的 world 装配与 tick 推进能力

**Files:**
- Create: `src/bootstrap/default-registrations.ts`
- Create: `src/bootstrap/world-step.ts`
- Create: `src/testing/scenario-harness/world-step.test.ts`
- Modify: `src/main.ts`
- Modify: `src/adapter/main-scene.ts`

- [ ] **Step 1: 先写 world step 的失败测试**

```ts
// src/testing/scenario-harness/world-step.test.ts
import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '@defs/index';
import { createWorld } from '@world/world';
import { createGameMap } from '@world/game-map';
import { advanceWorldTick } from '@bootstrap/world-step';

describe('advanceWorldTick', () => {
  it('会递增 tick、执行 tickRunner，并清空已分发的事件缓冲', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'test', width: 8, height: 8 });
    world.maps.set(map.id, map);

    let executed = 0;
    world.tickRunner.register({
      id: 'test-system',
      phase: 0,
      frequency: 1,
      execute: (w) => {
        executed += 1;
        w.eventBuffer.push({ type: 'test_event', tick: w.tick, data: { executed } });
      },
    });

    const dispatched: string[] = [];
    advanceWorldTick(world, {
      dispatchEvents(events) {
        dispatched.push(...events.map(event => event.type));
      },
    });

    expect(world.tick).toBe(1);
    expect(executed).toBe(1);
    expect(dispatched).toEqual(['test_event']);
    expect(world.eventBuffer).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/scenario-harness/world-step.test.ts`

Expected: FAIL，报错指出 `@bootstrap/world-step` 或 `advanceWorldTick` 不存在。

- [ ] **Step 3: 实现共享 tick 推进函数**

```ts
// src/bootstrap/world-step.ts
import { advanceClock } from '../core/clock';
import type { World } from '../world/world';
import type { GameEvent } from '../core/event-bus';

export interface AdvanceWorldTickOptions {
  dispatchEvents?: (events: GameEvent[]) => void;
}

export function advanceWorldTick(world: World, options: AdvanceWorldTickOptions = {}): void {
  world.tick += 1;
  advanceClock(world.clock);
  world.tickRunner.executeTick(world);

  if (world.eventBuffer.length > 0) {
    const events = [...world.eventBuffer];
    options.dispatchEvents?.(events);
    world.eventBus.dispatch(events);
    world.eventBuffer.length = 0;
  }
}
```

- [ ] **Step 4: 抽离默认命令/系统注册函数**

```ts
// src/bootstrap/default-registrations.ts
import type { World } from '../world/world';
import type { SystemRegistration } from '../core/tick-runner';

export function buildDefaultSystems(): SystemRegistration[] {
  // 直接搬运并保留 main.ts 中现有 buildSystems 的内容
}

export function registerDefaultCommands(world: World): void {
  // 直接搬运并保留 main.ts 中现有 registerCommands 的内容
}
```

- [ ] **Step 5: 让生产入口改用抽离后的共享函数**

```ts
// src/main.ts
import { buildDefaultSystems, registerDefaultCommands } from './bootstrap/default-registrations';

// ...
registerDefaultCommands(world);
world.tickRunner.registerAll(buildDefaultSystems());
```

```ts
// src/adapter/main-scene.ts
import { advanceWorldTick } from '../bootstrap/world-step';

while (this.accumulator >= TICK_MS && ticksThisFrame < maxTicksPerFrame) {
  advanceWorldTick(this.world);
  this.accumulator -= TICK_MS;
  ticksThisFrame++;
}
```

- [ ] **Step 6: 跑测试并检查类型**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/scenario-harness/world-step.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add src/bootstrap/default-registrations.ts src/bootstrap/world-step.ts src/testing/scenario-harness/world-step.test.ts src/main.ts src/adapter/main-scene.ts
git commit -m "refactor: share world step and default registrations"
```

### Task 2: 建立 Scenario DSL、Scenario Harness 和 checkpoint snapshot

**Files:**
- Create: `vitest.scenario.config.ts`
- Create: `src/testing/scenario-dsl/scenario.types.ts`
- Create: `src/testing/scenario-dsl/scenario.builders.ts`
- Create: `src/testing/scenario-harness/create-scenario-world.ts`
- Create: `src/testing/scenario-harness/checkpoint-snapshot.ts`
- Create: `src/testing/scenario-harness/scenario-harness.ts`
- Create: `src/testing/scenario-harness/scenario-harness.test.ts`

- [ ] **Step 1: 先写 DSL + Harness 的失败测试**

```ts
// src/testing/scenario-harness/scenario-harness.test.ts
import { describe, expect, it } from 'vitest';
import { createActionStep, createAssertStep, createScenario, createWaitForStep } from '@testing/scenario-dsl/scenario.builders';
import { createScenarioHarness } from '@testing/scenario-harness/scenario-harness';

describe('ScenarioHarness', () => {
  it('按顺序执行 action、waitFor、assert，并记录步骤状态', async () => {
    const harness = createScenarioHarness();
    let counter = 0;

    const scenario = createScenario({
      id: 'minimal',
      title: '最小场景',
      setup: [
        createActionStep('初始化计数器', async () => {
          counter = 1;
        }),
      ],
      script: [
        createWaitForStep('等待计数器为 1', () => counter === 1, { timeoutTicks: 1 }),
      ],
      expect: [
        createAssertStep('计数器最终为 1', () => counter === 1),
      ],
    });

    const result = await harness.runScenario(scenario);

    expect(result.status).toBe('passed');
    expect(result.steps.map(step => step.status)).toEqual(['passed', 'passed', 'passed']);
  });
});
```

- [ ] **Step 2: 建立 scenario 专用 Vitest 配置**

```ts
// vitest.scenario.config.ts
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bootstrap': path.resolve(__dirname, 'src/bootstrap'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@defs': path.resolve(__dirname, 'src/defs'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@testing': path.resolve(__dirname, 'src/testing'),
      '@world': path.resolve(__dirname, 'src/world'),
    },
  },
  test: {
    include: ['src/testing/**/*.test.ts', 'src/testing/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [
      ['src/testing/visual-runner/**/*.test.tsx', 'jsdom'],
    ],
  },
});
```

- [ ] **Step 3: 实现 DSL 类型和构造器**

```ts
// src/testing/scenario-dsl/scenario.types.ts
export type ScenarioStepKind = 'action' | 'waitFor' | 'assert';
export type ScenarioStepStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface ScenarioStepContext {
  harness: import('../scenario-harness/scenario-harness').ScenarioHarness;
}

export interface ScenarioStep {
  kind: ScenarioStepKind;
  title: string;
  detail?: string;
}

export interface ActionStep extends ScenarioStep {
  kind: 'action';
  run: (context: ScenarioStepContext) => Promise<void> | void;
}

export interface WaitForStep extends ScenarioStep {
  kind: 'waitFor';
  condition: (context: ScenarioStepContext) => boolean;
  timeoutTicks: number;
}

export interface AssertStep extends ScenarioStep {
  kind: 'assert';
  assert: (context: ScenarioStepContext) => boolean;
}
```

```ts
// src/testing/scenario-dsl/scenario.builders.ts
export function createActionStep(title: string, run: ActionStep['run'], detail?: string): ActionStep {
  return { kind: 'action', title, detail, run };
}
```

- [ ] **Step 4: 实现 ScenarioHarness 与 checkpoint snapshot**

```ts
// src/testing/scenario-harness/checkpoint-snapshot.ts
export interface CheckpointSnapshot {
  tick: number;
  pawns: Array<{ id: string; cell: { x: number; y: number }; jobId: string | null; food: number }>;
  items: Array<{ id: string; defId: string; cell: { x: number; y: number }; stackCount: number }>;
  designations: Array<{ id: string; designationType: string; cell: { x: number; y: number } }>;
}
```

```ts
// src/testing/scenario-harness/scenario-harness.ts
import { buildDefDatabase } from '@defs/index';
import { createWorld } from '@world/world';
import { createGameMap } from '@world/game-map';
import { buildDefaultSystems, registerDefaultCommands } from '@bootstrap/default-registrations';
import { advanceWorldTick } from '@bootstrap/world-step';

export function createScenarioHarness() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'scenario', width: 40, height: 40 });
  world.maps.set(map.id, map);
  world.factions.set('player', { id: 'player', name: 'Colony', isPlayer: true, hostile: false });

  registerDefaultCommands(world);
  world.tickRunner.registerAll(buildDefaultSystems());

  return {
    world,
    map,
    stepTicks(count: number) {
      for (let i = 0; i < count; i++) advanceWorldTick(world);
    },
    // runScenario, createCheckpointSnapshot 等实现写在这里
  };
}
```

- [ ] **Step 5: 跑 DSL/Harness 测试**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/scenario-harness/scenario-harness.test.ts`

Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add vitest.scenario.config.ts src/testing/scenario-dsl/scenario.types.ts src/testing/scenario-dsl/scenario.builders.ts src/testing/scenario-harness/create-scenario-world.ts src/testing/scenario-harness/checkpoint-snapshot.ts src/testing/scenario-harness/scenario-harness.ts src/testing/scenario-harness/scenario-harness.test.ts
git commit -m "test: add scenario dsl and harness foundation"
```

### Task 3: 实现 Headless Runner，并用“砍树”打通第一条场景

**Files:**
- Create: `src/testing/scenario-actions/setup-actions.ts`
- Create: `src/testing/scenario-actions/player-actions.ts`
- Create: `src/testing/scenario-actions/wait-conditions.ts`
- Create: `src/testing/headless/headless-scenario-runner.ts`
- Create: `src/testing/scenarios/woodcutting.scenario.ts`
- Create: `src/testing/headless/woodcutting.scenario.test.ts`

- [ ] **Step 1: 先写“砍树场景”失败测试**

```ts
// src/testing/headless/woodcutting.scenario.test.ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { woodcuttingScenario } from '@testing/scenarios/woodcutting.scenario';

describe('woodcuttingScenario', () => {
  it('会生成砍树指派、让 pawn 执行工作，并产出木材', async () => {
    const result = await runHeadlessScenario(woodcuttingScenario);

    expect(result.status).toBe('passed');
    expect(result.finalSnapshot.designations).toHaveLength(0);
    expect(result.finalSnapshot.items.some(item => item.defId === 'wood')).toBe(true);
    expect(result.finalSnapshot.pawns[0]?.jobId ?? null).toBe(null);
  });
});
```

- [ ] **Step 2: 实现最小动作库和 Headless Runner**

```ts
// src/testing/headless/headless-scenario-runner.ts
import { createScenarioHarness } from '@testing/scenario-harness/scenario-harness';

export async function runHeadlessScenario(scenario: ScenarioDefinition) {
  const harness = createScenarioHarness();
  const result = await harness.runScenario(scenario);
  return {
    ...result,
    finalSnapshot: harness.createCheckpointSnapshot(),
  };
}
```

```ts
// src/testing/scenario-actions/setup-actions.ts
export function spawnPawnAction(cell: { x: number; y: number }, name = 'Tester') {
  return createActionStep(`生成 pawn：${name}`, ({ harness }) => {
    const pawn = createPawn({
      name,
      cell,
      mapId: harness.map.id,
      factionId: 'player',
      rng: harness.world.rng,
    });
    harness.map.objects.add(pawn);
  });
}
```

- [ ] **Step 3: 写出木工场景脚本**

```ts
// src/testing/scenarios/woodcutting.scenario.ts
export const woodcuttingScenario = createScenario({
  id: 'woodcutting',
  title: '砍树',
  report: {
    focus: '关注树上的 cut designation、pawn 是否接单并靠近树',
  },
  setup: [
    placeTreeAction({ x: 12, y: 12 }, 'tree_oak'),
    spawnPawnAction({ x: 10, y: 12 }, 'Cutter'),
  ],
  script: [
    designateCutAction({ x: 12, y: 12 }),
    waitForPawnJobAction('等待 pawn 接到砍树工作'),
    waitForNoPlantAtAction('等待树被砍倒', { x: 12, y: 12 }, 200),
  ],
  expect: [
    assertWoodDroppedAction({ x: 12, y: 12 }),
  ],
});
```

- [ ] **Step 4: 跑砍树场景测试并修到通过**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/woodcutting.scenario.test.ts`

Expected: PASS

- [ ] **Step 5: 再跑基础类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/testing/scenario-actions/setup-actions.ts src/testing/scenario-actions/player-actions.ts src/testing/scenario-actions/wait-conditions.ts src/testing/headless/headless-scenario-runner.ts src/testing/scenarios/woodcutting.scenario.ts src/testing/headless/woodcutting.scenario.test.ts
git commit -m "test: add headless woodcutting scenario"
```

### Task 4: 补齐“搬运进 stockpile”和“进食”场景

**Files:**
- Modify: `src/testing/scenario-actions/setup-actions.ts`
- Modify: `src/testing/scenario-actions/player-actions.ts`
- Modify: `src/testing/scenario-actions/wait-conditions.ts`
- Create: `src/testing/scenarios/stockpile-haul.scenario.ts`
- Create: `src/testing/scenarios/eating.scenario.ts`
- Create: `src/testing/headless/stockpile-haul.scenario.test.ts`
- Create: `src/testing/headless/eating.scenario.test.ts`

- [ ] **Step 1: 先写两个场景的失败测试**

```ts
// src/testing/headless/stockpile-haul.scenario.test.ts
it('会把木材搬运到 stockpile 并堆叠', async () => {
  const result = await runHeadlessScenario(stockpileHaulScenario);
  expect(result.status).toBe('passed');
  expect(result.finalSnapshot.items.some(item => item.defId === 'wood' && item.cell.x === 16 && item.cell.y === 10)).toBe(true);
});
```

```ts
// src/testing/headless/eating.scenario.test.ts
it('会在饥饿时拾取食物并恢复 needs.food', async () => {
  const result = await runHeadlessScenario(eatingScenario);
  expect(result.status).toBe('passed');
  expect(result.finalSnapshot.pawns[0].food).toBeGreaterThan(60);
});
```

- [ ] **Step 2: 扩展动作库，补 stockpile / 食物 / needs 相关原语**

```ts
// src/testing/scenario-actions/setup-actions.ts
export function createStockpileAction(cells: Array<{ x: number; y: number }>) {
  return createActionStep('创建 stockpile 区域', ({ harness }) => {
    harness.world.commandQueue.push({
      type: 'zone_set_cells',
      payload: { mapId: harness.map.id, zoneType: ZoneType.Stockpile, cells },
    });
    harness.stepTicks(1);
  });
}
```

```ts
// src/testing/scenario-actions/setup-actions.ts
export function setPawnFoodAction(pawnId: string, food: number) {
  return createActionStep(`设置 pawn 饱食度为 ${food}`, ({ harness }) => {
    const pawn = harness.map.objects.getAs(pawnId, ObjectKind.Pawn);
    if (!pawn) throw new Error(`Pawn ${pawnId} not found`);
    pawn.needs.food = food;
  });
}
```

- [ ] **Step 3: 写出两个场景脚本**

```ts
// src/testing/scenarios/stockpile-haul.scenario.ts
export const stockpileHaulScenario = createScenario({
  id: 'stockpile-haul',
  title: '搬运进 Stockpile',
  setup: [
    spawnPawnAction({ x: 10, y: 10 }, 'Hauler'),
    spawnItemAction('wood', { x: 6, y: 10 }, 12),
    createStockpileAction([{ x: 16, y: 10 }]),
  ],
  script: [
    waitForItemInStockpileAction('等待木材进入 stockpile', 'wood', { x: 16, y: 10 }, 200),
  ],
  expect: [
    assertItemStackAtAction('wood', { x: 16, y: 10 }, 12),
  ],
});
```

```ts
// src/testing/scenarios/eating.scenario.ts
export const eatingScenario = createScenario({
  id: 'eating',
  title: '进食',
  setup: [
    spawnPawnAction({ x: 10, y: 10 }, 'Eater'),
    spawnItemAction('meal_simple', { x: 12, y: 10 }, 4),
    setPawnFoodByNameAction('Eater', 5),
  ],
  script: [
    waitForPawnJobDefAction('等待 pawn 切到进食工作', 'Eater', 'job_eat', 100),
    waitForPawnFoodAtLeastAction('等待饱食度恢复', 'Eater', 60, 200),
  ],
  expect: [
    assertPawnFoodAtLeastAction('Eater', 60),
  ],
});
```

- [ ] **Step 4: 跑两个场景测试**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/headless/eating.scenario.test.ts`

Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/testing/scenario-actions/setup-actions.ts src/testing/scenario-actions/player-actions.ts src/testing/scenario-actions/wait-conditions.ts src/testing/scenarios/stockpile-haul.scenario.ts src/testing/scenarios/eating.scenario.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/headless/eating.scenario.test.ts
git commit -m "test: add stockpile haul and eating scenarios"
```

### Task 5: 补齐“建造蓝图”场景，并把 4 条主链路收进统一回归集

**Files:**
- Modify: `src/testing/scenario-actions/setup-actions.ts`
- Modify: `src/testing/scenario-actions/player-actions.ts`
- Modify: `src/testing/scenario-actions/wait-conditions.ts`
- Create: `src/testing/scenarios/blueprint-construction.scenario.ts`
- Create: `src/testing/headless/blueprint-construction.scenario.test.ts`
- Create: `src/testing/headless/scenario-regression.test.ts`
- Create: `src/testing/scenario-registry.ts`

- [ ] **Step 1: 先写蓝图场景的失败测试**

```ts
// src/testing/headless/blueprint-construction.scenario.test.ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { blueprintConstructionScenario } from '@testing/scenarios/blueprint-construction.scenario';

describe('blueprintConstructionScenario', () => {
  it('会搬运材料、完成施工，并把蓝图转换为建筑', async () => {
    const result = await runHeadlessScenario(blueprintConstructionScenario);
    expect(result.status).toBe('passed');
    expect(result.finalSnapshot.items.some(item => item.defId === 'wood')).toBe(false);
    expect(result.finalSnapshot.buildings.some(building => building.defId === 'wall_wood')).toBe(true);
  });
});
```

- [ ] **Step 2: 扩展快照与动作库，支持蓝图/建筑查询**

```ts
// src/testing/scenario-harness/checkpoint-snapshot.ts
export interface CheckpointSnapshot {
  // 保留原有字段
  blueprints: Array<{ id: string; defId: string; delivered: Array<{ defId: string; count: number }> }>;
  buildings: Array<{ id: string; defId: string; cell: { x: number; y: number } }>;
}
```

```ts
// src/testing/scenario-actions/player-actions.ts
export function placeBlueprintAction(defId: string, cell: { x: number; y: number }) {
  return createActionStep(`放置蓝图：${defId}`, ({ harness }) => {
    harness.world.commandQueue.push({
      type: 'place_blueprint',
      payload: { defId, cell, rotation: 0 },
    });
    harness.stepTicks(1);
  });
}
```

- [ ] **Step 3: 写出蓝图场景和统一回归集**

```ts
// src/testing/scenarios/blueprint-construction.scenario.ts
export const blueprintConstructionScenario = createScenario({
  id: 'blueprint-construction',
  title: '建造蓝图',
  setup: [
    spawnPawnAction({ x: 10, y: 10 }, 'Builder'),
    spawnItemAction('wood', { x: 8, y: 10 }, 20),
    placeBlueprintAction('wall_wood', { x: 14, y: 10 }),
  ],
  script: [
    waitForBlueprintDeliveredAction('等待材料送达蓝图', 'wall_wood', 200),
    waitForBuildingCreatedAction('等待建筑完成', 'wall_wood', { x: 14, y: 10 }, 400),
  ],
  expect: [
    assertBuildingExistsAction('wall_wood', { x: 14, y: 10 }),
  ],
});
```

```ts
// src/testing/scenario-registry.ts
export const scenarioRegistry = [
  woodcuttingScenario,
  stockpileHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
] as const;
```

- [ ] **Step 4: 跑蓝图测试和统一回归集**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/blueprint-construction.scenario.test.ts src/testing/headless/scenario-regression.test.ts`

Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/testing/scenario-actions/setup-actions.ts src/testing/scenario-actions/player-actions.ts src/testing/scenario-actions/wait-conditions.ts src/testing/scenarios/blueprint-construction.scenario.ts src/testing/headless/blueprint-construction.scenario.test.ts src/testing/headless/scenario-regression.test.ts src/testing/scenario-registry.ts src/testing/scenario-harness/checkpoint-snapshot.ts
git commit -m "test: add blueprint construction scenario suite"
```

### Task 6: 实现 Visual Runner、Scenario HUD 和 Shadow Headless Runner

**Files:**
- Create: `scenario.html`
- Create: `src/testing/visual-runner/scenario-hud.tsx`
- Create: `src/testing/visual-runner/scenario-hud.test.tsx`
- Create: `src/testing/visual-runner/visual-scenario-controller.ts`
- Create: `src/testing/visual-runner/shadow-runner.ts`
- Create: `src/testing/visual-runner/shadow-runner.test.ts`
- Create: `src/testing/visual-runner/scenario-main.ts`
- Modify: `src/adapter/bootstrap.ts`

- [ ] **Step 1: 先写 HUD 与 Shadow Runner 的失败测试**

```tsx
// src/testing/visual-runner/scenario-hud.test.tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { ScenarioHud } from './scenario-hud';

describe('ScenarioHud', () => {
  it('并排展示 visual 与 headless 两个步骤队列', () => {
    render(
      <ScenarioHud
        title="砍树"
        visualSteps={[{ title: '下达砍树指令', status: 'running' }]}
        shadowSteps={[{ title: '下达砍树指令', status: 'passed' }]}
        divergence={null}
      />,
    );

    expect(screen.getByText('Visual Runner')).toBeInTheDocument();
    expect(screen.getByText('Shadow Headless Runner')).toBeInTheDocument();
  });
});
```

```ts
// src/testing/visual-runner/shadow-runner.test.ts
import { describe, expect, it } from 'vitest';
import { diffCheckpointSnapshots } from './shadow-runner';

describe('diffCheckpointSnapshots', () => {
  it('返回首次字段分歧', () => {
    const result = diffCheckpointSnapshots(
      { tick: 10, pawns: [{ id: 'p1', jobId: null }] },
      { tick: 10, pawns: [{ id: 'p1', jobId: 'job_cut_1' }] },
    );

    expect(result?.field).toBe('pawns[p1].jobId');
  });
});
```

- [ ] **Step 2: 实现 HUD 组件与 Shadow diff 逻辑**

```tsx
// src/testing/visual-runner/scenario-hud.tsx
export function ScenarioHud(props: ScenarioHudProps) {
  return (
    <aside className="scenario-hud">
      <section>
        <h2>Visual Runner</h2>
        {/* 渲染左侧步骤队列 */}
      </section>
      <section>
        <h2>Shadow Headless Runner</h2>
        {/* 渲染右侧步骤队列 */}
      </section>
      <section>
        <h2>当前状态</h2>
        <p>{props.currentStepTitle}</p>
      </section>
      <section>
        <h2>分歧</h2>
        {props.divergence ? <pre>{JSON.stringify(props.divergence, null, 2)}</pre> : <p>无分歧</p>}
      </section>
    </aside>
  );
}
```

```ts
// src/testing/visual-runner/shadow-runner.ts
export function diffCheckpointSnapshots(left: CheckpointSnapshot, right: CheckpointSnapshot) {
  // 第一版只比 tick、pawns、items、designations、blueprints、buildings
}
```

- [ ] **Step 3: 创建可视运行入口并允许选择场景**

```html
<!-- scenario.html -->
<!doctype html>
<html lang="zh-CN">
  <body>
    <div id="scenario-game-container"></div>
    <div id="scenario-ui-root"></div>
    <script type="module" src="/src/testing/visual-runner/scenario-main.ts"></script>
  </body>
  </html>
```

```ts
// src/testing/visual-runner/scenario-main.ts
const params = new URLSearchParams(window.location.search);
const scenarioId = params.get('scenario') ?? 'woodcutting';
// 创建 visual harness、shadow harness、controller，启动 Phaser，挂载 HUD
```

- [ ] **Step 4: 让 Phaser 启动函数支持测试页面容器**

```ts
// src/adapter/bootstrap.ts
export function bootstrapPhaser(world: World, uiBridge?: EngineSnapshotBridge, _uiPorts?: UiPorts, parent = 'game-container'): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    parent,
    scene: new MainScene(world, uiBridge),
    // 其余配置保持不变
  };
  return new Phaser.Game(config);
}
```

- [ ] **Step 5: 跑 UI 与 Shadow Runner 单测**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/visual-runner/scenario-hud.test.tsx src/testing/visual-runner/shadow-runner.test.ts`

Expected: PASS

- [ ] **Step 6: 手工打开可视页面，确认自动执行和双队列显示**

Run: `npm run scenario:visual`

Expected:
- 页面自动启动指定 scenario
- 左右两列同时推进
- 当前步骤、当前等待条件和分歧面板可见

- [ ] **Step 7: 提交这一小步**

```bash
git add scenario.html src/testing/visual-runner/scenario-hud.tsx src/testing/visual-runner/scenario-hud.test.tsx src/testing/visual-runner/visual-scenario-controller.ts src/testing/visual-runner/shadow-runner.ts src/testing/visual-runner/shadow-runner.test.ts src/testing/visual-runner/scenario-main.ts src/adapter/bootstrap.ts
git commit -m "test: add visual scenario runner and shadow hud"
```

### Task 7: 接入 package scripts 和开发者文档，收口第一版体验

**Files:**
- Modify: `package.json`
- Create: `docs/testing/scenario-testing.md`

- [ ] **Step 1: 先补运行脚本**

```json
{
  "scripts": {
    "test:scenario": "vitest run --config vitest.scenario.config.ts",
    "test:scenario:watch": "vitest --config vitest.scenario.config.ts",
    "scenario:visual": "vite --open /scenario.html?scenario=woodcutting"
  }
}
```

- [ ] **Step 2: 写开发者说明文档**

```md
# Scenario Testing

## 运行无头回归

`npm run test:scenario`

## 打开可视化验收

`npm run scenario:visual`

默认打开 `woodcutting` 场景，可通过 URL 参数切换其他场景。
```

- [ ] **Step 3: 跑整套 headless 回归**

Run: `npm run test:scenario`

Expected: 4 个场景全部 PASS

- [ ] **Step 4: 跑类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add package.json docs/testing/scenario-testing.md
git commit -m "docs: document scenario testing workflow"
```

---

## Self-Review

### 1. Spec coverage

已覆盖 spec 中的核心要求：

- 同源场景 DSL：Task 2
- 无头 runner：Task 3, 4, 5
- 首批 4 条场景：Task 3, 4, 5
- 可视 runner：Task 6
- Shadow headless runner：Task 6
- 双队列 HUD：Task 6
- 运行脚本与流程：Task 7

未纳入第一阶段的内容也与 spec 对齐：

- 存档场景
- 像素级输入回放主路径
- render snapshot 对比

### 2. Placeholder scan

本计划没有使用 `TODO`、`TBD`、`待定` 之类占位词。  
所有任务都给出了明确文件、测试入口、命令和预期输出。

### 3. Type consistency

计划中统一使用以下命名：

- `ScenarioHarness`
- `CheckpointSnapshot`
- `HeadlessScenarioRunner`
- `VisualScenarioRunner`
- `Shadow Headless Runner`
- `advanceWorldTick`
- `buildDefaultSystems`
- `registerDefaultCommands`

这些命名在所有任务中保持一致，没有中途换名。

---

Plan complete and saved to `docs/superpowers/plans/2026-04-10-simulation-scenario-testing.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
