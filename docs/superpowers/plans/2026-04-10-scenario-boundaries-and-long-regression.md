# Scenario Boundaries And Long Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the scenario testing framework so `setup`, `script`, and `expect` have clear capability boundaries, then add long-form regression scenarios that cover `zone / stockpile / pickup / reservation` end-to-end.

**Architecture:** Replace the generic `scenario-actions` layer with three explicit layers: `scenario-fixtures`, `scenario-commands`, and `scenario-probes`. Split DSL step contexts the same way so only fixtures can mutate world state directly, commands can only issue production commands plus tick the world, and probes can only observe. Once the boundary is in place, migrate the existing four scenarios and add three long-form regression scenarios centered on zone lifecycle, quantity-aware hauling, and interrupted haul recovery.

**Tech Stack:** TypeScript, Vitest, existing `src/testing` scenario DSL/harness/headless runner/visual runner, `World / CommandBus / TickRunner`, zone and pawn command handlers

---

## File Structure

### Create

- `src/testing/scenario-fixtures/world-fixtures.ts` - setup-only fixture helpers that create pawns, items, plants, and initial need values
- `src/testing/scenario-commands/zone-commands.ts` - script-time helpers that issue `zone_set_cells`, `zone_remove_cells`, and `zone_delete`
- `src/testing/scenario-commands/player-commands.ts` - script-time helpers that issue build, cut, draft, and force-job commands
- `src/testing/scenario-probes/query-api.ts` - read-only query API built on top of `ScenarioHarness`
- `src/testing/scenario-probes/pawn-probes.ts` - pawn-related waits and assertions
- `src/testing/scenario-probes/item-probes.ts` - item placement, stack, and total-count probes
- `src/testing/scenario-probes/reservation-probes.ts` - reservation release probes
- `src/testing/scenario-probes/building-probes.ts` - blueprint and building completion probes
- `src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts` - long-form zone lifecycle scenario
- `src/testing/scenarios/quantity-haul-stack-chain.scenario.ts` - long-form quantity-and-stack scenario
- `src/testing/scenarios/interrupted-haul-reservation-recovery.scenario.ts` - long-form interruption and cleanup scenario
- `src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts` - per-scenario headless regression test
- `src/testing/headless/quantity-haul-stack-chain.scenario.test.ts` - per-scenario headless regression test
- `src/testing/headless/interrupted-haul-reservation-recovery.scenario.test.ts` - per-scenario headless regression test

### Modify

- `src/testing/scenario-dsl/scenario.types.ts` - split action contexts into setup/command/probe capability types
- `src/testing/scenario-dsl/scenario.builders.ts` - add `createSetupStep` and `createCommandStep`
- `src/testing/scenario-harness/scenario-harness.ts` - expose `ScenarioQueryApi`, alias storage, and context-aware step execution
- `src/testing/scenario-harness/checkpoint-snapshot.ts` - include any snapshot fields needed by the new probes
- `src/testing/scenario-harness/scenario-harness.test.ts` - cover the new context split and alias/query behavior
- `src/testing/scenarios/woodcutting.scenario.ts` - migrate to fixtures/commands/probes
- `src/testing/scenarios/stockpile-haul.scenario.ts` - migrate to fixtures/commands/probes
- `src/testing/scenarios/eating.scenario.ts` - migrate to fixtures/commands/probes
- `src/testing/scenarios/blueprint-construction.scenario.ts` - migrate to fixtures/commands/probes
- `src/testing/scenario-registry.ts` - register the three new long scenarios
- `src/testing/headless/woodcutting.scenario.test.ts` - keep aligned with migrated scenario
- `src/testing/headless/stockpile-haul.scenario.test.ts` - keep aligned with migrated scenario
- `src/testing/headless/eating.scenario.test.ts` - keep aligned with migrated scenario
- `src/testing/headless/blueprint-construction.scenario.test.ts` - keep aligned with migrated scenario
- `src/testing/headless/scenario-regression.test.ts` - keep suite output stable as the registry grows
- `src/testing/visual-runner/visual-scenario-controller.ts` - compile against the new typed step contexts

### Delete

- `src/testing/scenario-actions/setup-actions.ts`
- `src/testing/scenario-actions/player-actions.ts`
- `src/testing/scenario-actions/wait-conditions.ts`

---

### Task 1: Split Scenario DSL Contexts And Add A Read-Only Query API

**Files:**
- Create: `src/testing/scenario-probes/query-api.ts`
- Modify: `src/testing/scenario-dsl/scenario.types.ts`
- Modify: `src/testing/scenario-dsl/scenario.builders.ts`
- Modify: `src/testing/scenario-harness/scenario-harness.ts`
- Test: `src/testing/scenario-harness/scenario-harness.test.ts`

- [ ] **Step 1: Write a failing harness test that proves command steps cannot rely on mutable setup context**

```ts
// src/testing/scenario-harness/scenario-harness.test.ts
import { describe, expect, it } from 'vitest';
import {
  createAssertStep,
  createCommandStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '@testing/scenario-dsl/scenario.builders';
import { createScenarioHarness } from '@testing/scenario-harness/scenario-harness';

describe('ScenarioHarness', () => {
  it('runs setup, command, wait, and assert steps with split contexts', async () => {
    const harness = createScenarioHarness();
    let setupRan = false;
    let commandRan = false;

    const scenario = createScenario({
      id: 'context-split',
      title: 'context split',
      setup: [
        createSetupStep('mark setup', ({ harness }) => {
          setupRan = Boolean(harness.map);
        }),
      ],
      script: [
        createCommandStep('mark command', ({ stepTicks }) => {
          stepTicks(1);
          commandRan = true;
        }),
        createWaitForStep('wait for markers', () => setupRan && commandRan, { timeoutTicks: 1 }),
      ],
      expect: [
        createAssertStep('both markers set', () => setupRan && commandRan),
      ],
    });

    const result = await harness.runScenario(scenario);

    expect(result.status).toBe('passed');
    expect(result.steps.map(step => step.status)).toEqual(['passed', 'passed', 'passed', 'passed']);
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm the new builder names and context split do not exist yet**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/scenario-harness/scenario-harness.test.ts`

Expected: FAIL with missing exports such as `createSetupStep` and `createCommandStep`, or type errors because the old `ScenarioStepContext` shape is still in use

- [ ] **Step 3: Replace the single mutable context with explicit setup, command, and probe contexts**

```ts
// src/testing/scenario-dsl/scenario.types.ts
import type { Command } from '@core/command-bus';
import type { CellCoord, ZoneType } from '@core/types';
import type { Item } from '@features/item/item.types';
import type { Pawn } from '@features/pawn/pawn.types';
import type { Zone } from '@features/zone/zone.types';

export type ScenarioStepKind = 'setup' | 'command' | 'waitFor' | 'assert';
export type ScenarioStepStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface SetupContext {
  harness: import('../scenario-harness/scenario-harness').ScenarioHarness;
}

export interface ScenarioQueryApi {
  findPawnByName(name: string): Pawn | null;
  findItemAt(defId: string, cell: CellCoord): Item | null;
  findItemsByDef(defId: string): Item[];
  getZoneAt(cell: CellCoord): Zone | null;
  getZonesByType(zoneType: ZoneType): Zone[];
  isReserved(targetId: string): boolean;
  resolveAlias(alias: string): string | null;
  totalItemCountInCells(defId: string, cells: CellCoord[]): number;
  findBuildingAt(defId: string, cell: CellCoord): unknown | null;
  findBlueprintsByTargetDef(defId: string): unknown[];
  findPlantAt(cell: CellCoord): unknown | null;
}

export interface CommandContext {
  issueCommand(command: Command): void;
  stepTicks(count?: number): void;
  query: ScenarioQueryApi;
}

export interface ProbeContext {
  query: ScenarioQueryApi;
}
```

- [ ] **Step 4: Add new builders that make the step type obvious in scenario files**

```ts
// src/testing/scenario-dsl/scenario.builders.ts
export function createSetupStep(title, run, detail?) {
  return { kind: 'setup', title, detail, run };
}

export function createCommandStep(title, run, detail?) {
  return { kind: 'command', title, detail, run };
}
```

- [ ] **Step 5: Add the shared read-only query API and alias registry inside the harness**

```ts
// src/testing/scenario-probes/query-api.ts
import { ObjectKind } from '@core/types';

export function createScenarioQueryApi(harness, aliases) {
  return {
    findPawnByName(name) {
      return harness.map.objects.allOfKind(ObjectKind.Pawn).find(pawn => pawn.name === name) ?? null;
    },
    findItemAt(defId, cell) {
      return harness.map.objects.allOfKind(ObjectKind.Item).find(item => {
        return item.defId === defId && item.cell.x === cell.x && item.cell.y === cell.y;
      }) ?? null;
    },
    findItemsByDef(defId) {
      return harness.map.objects.allOfKind(ObjectKind.Item).filter(item => item.defId === defId);
    },
    getZoneAt(cell) {
      const key = `${cell.x},${cell.y}`;
      return harness.map.zones.all().find(zone => zone.cells.has(key)) ?? null;
    },
    getZonesByType(zoneType) {
      return harness.map.zones.all().filter(zone => zone.zoneType === zoneType);
    },
    isReserved(targetId) {
      return harness.map.reservations.isReserved(targetId);
    },
    resolveAlias(alias) { return aliases.get(alias) ?? null; },
    totalItemCountInCells(defId, cells) {
      const keys = new Set(cells.map(cell => `${cell.x},${cell.y}`));
      return harness.map.objects
        .allOfKind(ObjectKind.Item)
        .filter(item => item.defId === defId && keys.has(`${item.cell.x},${item.cell.y}`))
        .reduce((sum, item) => sum + item.stackCount, 0);
    },
    findBuildingAt(defId, cell) {
      return harness.map.objects.allOfKind(ObjectKind.Building).find(building => {
        return building.defId === defId && building.cell.x === cell.x && building.cell.y === cell.y;
      }) ?? null;
    },
    findBlueprintsByTargetDef(defId) {
      return harness.map.objects.allOfKind(ObjectKind.Blueprint).filter(blueprint => blueprint.targetDefId === defId);
    },
    findPlantAt(cell) {
      return harness.map.objects.allOfKind(ObjectKind.Plant).find(plant => plant.cell.x === cell.x && plant.cell.y === cell.y) ?? null;
    },
  };
}
```

- [ ] **Step 6: Wire the harness to execute setup steps with mutable world access and command/wait/assert steps with restricted contexts**

```ts
// src/testing/scenario-harness/scenario-harness.ts
const aliases = new Map<string, string>();
const query = createScenarioQueryApi(harness, aliases);
const setupContext = { harness };
const commandContext = { issueCommand, stepTicks, query };
const probeContext = { query };
```

- [ ] **Step 7: Run the targeted tests and TypeScript to verify the DSL split is complete**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/scenario-harness/scenario-harness.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 8: Commit the DSL and harness boundary change**

```bash
git add src/testing/scenario-dsl/scenario.types.ts src/testing/scenario-dsl/scenario.builders.ts src/testing/scenario-probes/query-api.ts src/testing/scenario-harness/scenario-harness.ts src/testing/scenario-harness/scenario-harness.test.ts
git commit -m "refactor: split scenario contexts by responsibility"
```

### Task 2: Replace `scenario-actions` With Fixtures, Commands, And Probes

**Files:**
- Create: `src/testing/scenario-fixtures/world-fixtures.ts`
- Create: `src/testing/scenario-commands/zone-commands.ts`
- Create: `src/testing/scenario-commands/player-commands.ts`
- Create: `src/testing/scenario-probes/pawn-probes.ts`
- Create: `src/testing/scenario-probes/item-probes.ts`
- Create: `src/testing/scenario-probes/reservation-probes.ts`
- Create: `src/testing/scenario-probes/building-probes.ts`
- Delete: `src/testing/scenario-actions/setup-actions.ts`
- Delete: `src/testing/scenario-actions/player-actions.ts`
- Delete: `src/testing/scenario-actions/wait-conditions.ts`
- Test: `src/testing/scenario-harness/scenario-harness.test.ts`

- [ ] **Step 1: Write a failing probe-focused test that uses aliases and reservation observation**

```ts
// append to src/testing/scenario-harness/scenario-harness.test.ts
it('tracks aliases and exposes them through the query api', async () => {
  const harness = createScenarioHarness();
  harness.registerAlias('sourceWood', 'item_1');

  const scenario = createScenario({
    id: 'alias-probe',
    title: 'alias probe',
    setup: [],
    script: [],
    expect: [
      createAssertStep('alias resolves', ({ query }) => query.resolveAlias('sourceWood') === 'item_1'),
    ],
  });

  const result = await harness.runScenario(scenario);
  expect(result.status).toBe('passed');
});
```

- [ ] **Step 2: Implement setup-only fixtures and support optional aliases**

```ts
// src/testing/scenario-fixtures/world-fixtures.ts
import { createSetupStep } from '@testing/scenario-dsl/scenario.builders';
import { createItem } from '@features/item/item.factory';
import { createPawn } from '@features/pawn/pawn.factory';
import { createPlant } from '@features/plant/plant.factory';
import { ObjectKind } from '@core/types';

export function spawnPawnFixture(cell, name = 'Tester') {
  return createSetupStep(`生成 pawn：${name}`, ({ harness }) => {
    const pawn = createPawn({ name, cell, mapId: harness.map.id, factionId: 'player', rng: harness.world.rng });
    harness.map.objects.add(pawn);
  });
}

export function spawnItemFixture(defId, cell, count = 1, options) {
  return createSetupStep(`生成物品：${defId} x${count}`, ({ harness }) => {
    const item = createItem({ defId, cell, mapId: harness.map.id, stackCount: count, defs: harness.world.defs });
    harness.map.objects.add(item);
    if (options?.alias) harness.registerAlias(options.alias, item.id);
  });
}

export function setPawnFoodFixture(pawnName, food) {
  return createSetupStep(`设置 ${pawnName} 饥饿值为 ${food}`, ({ harness }) => {
    const pawn = harness.map.objects.allOfKind(ObjectKind.Pawn).find(entry => entry.name === pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    pawn.needs.food = food;
  });
}

export function placeTreeFixture(cell, defId = 'tree_oak') {
  return createSetupStep(`place tree: ${defId}`, ({ harness }) => {
    const plant = createPlant({ defId, cell, mapId: harness.map.id, growthProgress: 1, defs: harness.world.defs });
    harness.map.objects.add(plant);
  });
}
```

- [ ] **Step 3: Implement production-command helpers that always push commands and tick once**

```ts
// src/testing/scenario-commands/zone-commands.ts
import { createCommandStep } from '@testing/scenario-dsl/scenario.builders';

export function createZoneCommand(zoneType, cells) {
  return createCommandStep('创建 stockpile 区域', ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'zone_set_cells', payload: { mapId: 'scenario', zoneType, cells } });
    stepTicks(1);
  });
}

export function removeZoneCellsCommand(cells) {
  return createCommandStep('移除指定 zone 格子', ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'zone_remove_cells', payload: { mapId: 'scenario', cells } });
    stepTicks(1);
  });
}
```

```ts
// src/testing/scenario-commands/player-commands.ts
import { createCommandStep } from '@testing/scenario-dsl/scenario.builders';

export function placeBlueprintCommand(defId, cell) {
  return createCommandStep(`放置蓝图：${defId}`, ({ issueCommand, stepTicks }) => {
    issueCommand({ type: 'place_blueprint', payload: { defId, cell, rotation: 0, mapId: 'scenario' } });
    stepTicks(1);
  });
}

export function draftPawnCommand(pawnName) {
  return createCommandStep(`征召 ${pawnName}`, ({ issueCommand, query, stepTicks }) => {
    const pawn = query.findPawnByName(pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);
    issueCommand({ type: 'draft_pawn', payload: { pawnId: pawn.id } });
    stepTicks(1);
  });
}

export function designateCutCommand(cell) {
  return createCommandStep(`designate cut (${cell.x}, ${cell.y})`, ({ issueCommand, query, stepTicks }) => {
    const tree = query.findPlantAt(cell);
    if (!tree) throw new Error(`No tree found at (${cell.x}, ${cell.y})`);
    issueCommand({ type: 'designate_cut', payload: { targetObjectId: tree.id, mapId: 'scenario' } });
    stepTicks(1);
  });
}
```

- [ ] **Step 4: Implement pure probes for waits and assertions**

```ts
// src/testing/scenario-probes/item-probes.ts
import { createAssertStep, createWaitForStep } from '@testing/scenario-dsl/scenario.builders';

export function waitForItemAt(title, defId, cell, timeoutTicks = 200) {
  return createWaitForStep(title, ({ query }) => query.findItemAt(defId, cell) !== null, {
    timeoutTicks,
    timeoutMessage: `${defId} did not appear at (${cell.x}, ${cell.y})`,
  });
}

export function waitForNoPlantAt(title, cell, timeoutTicks = 200) {
  return createWaitForStep(title, ({ query }) => query.findPlantAt(cell) === null, {
    timeoutTicks,
    timeoutMessage: `plant remained at (${cell.x}, ${cell.y})`,
  });
}

export function assertNoItemAt(defId, cell) {
  return createAssertStep(`${defId} 不应位于 (${cell.x}, ${cell.y})`, ({ query }) => query.findItemAt(defId, cell) === null, {
    failureMessage: `${defId} unexpectedly remained at (${cell.x}, ${cell.y})`,
  });
}

export function assertTotalItemCountInCells(defId, cells, expected) {
  return createAssertStep(`${defId} 在目标格中的总数为 ${expected}`, ({ query }) => {
    return query.totalItemCountInCells(defId, cells) === expected;
  }, {
    failureMessage: `${defId} total count did not match expected ${expected}`,
  });
}

export function assertAnyItemStackAtLeast(defId, cells, minimum) {
  return createAssertStep(`${defId} has at least one stack >= ${minimum}`, ({ query }) => {
    return cells.some(cell => {
      const item = query.findItemAt(defId, cell);
      return (item?.stackCount ?? 0) >= minimum;
    });
  }, {
    failureMessage: `${defId} never formed a stack of at least ${minimum}`,
  });
}

export function assertItemCountConserved(defId, expected) {
  return createAssertStep(`${defId} total count remains ${expected}`, ({ query }) => {
    return query.findItemsByDef(defId).reduce((sum, item) => sum + item.stackCount, 0) === expected;
  }, {
    failureMessage: `${defId} total count drifted away from ${expected}`,
  });
}

export function assertWoodDropped(cell) {
  return createAssertStep(`wood exists near (${cell.x}, ${cell.y})`, ({ query }) => {
    return query.findItemsByDef('wood').some(item => {
      return Math.abs(item.cell.x - cell.x) <= 3 && Math.abs(item.cell.y - cell.y) <= 3;
    });
  }, {
    failureMessage: `no wood appeared near (${cell.x}, ${cell.y})`,
  });
}
```

```ts
// src/testing/scenario-probes/reservation-probes.ts
import { createAssertStep, createWaitForStep } from '@testing/scenario-dsl/scenario.builders';

function resolveTargetId(query, aliasOrId) {
  return query.resolveAlias(aliasOrId) ?? aliasOrId;
}

export function waitForReservationReleased(title, aliasOrId, timeoutTicks = 120) {
  return createWaitForStep(title, ({ query }) => {
    const targetId = resolveTargetId(query, aliasOrId);
    return !query.isReserved(targetId);
  }, {
    timeoutTicks,
    timeoutMessage: `${aliasOrId} remained reserved`,
  });
}

export function assertReservationReleased(aliasOrId) {
  return createAssertStep(`${aliasOrId} reservation released`, ({ query }) => {
    const targetId = resolveTargetId(query, aliasOrId);
    return !query.isReserved(targetId);
  }, {
    failureMessage: `${aliasOrId} remained reserved after scenario completion`,
  });
}
```

```ts
// src/testing/scenario-probes/pawn-probes.ts
import { createAssertStep, createWaitForStep } from '@testing/scenario-dsl/scenario.builders';

export function waitForPawnJobDef(title, pawnName, jobDefId, timeoutTicks = 100) {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.ai?.currentJob?.defId === jobDefId;
  }, {
    timeoutTicks,
    timeoutMessage: `${pawnName} did not switch to ${jobDefId}`,
  });
}

export function waitForPawnFoodAtLeast(title, pawnName, minimum, timeoutTicks = 200) {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return (pawn?.needs?.food ?? 0) >= minimum;
  }, {
    timeoutTicks,
    timeoutMessage: `${pawnName} food never reached ${minimum}`,
  });
}

export function assertPawnFoodAtLeast(pawnName, minimum) {
  return createAssertStep(`${pawnName} food >= ${minimum}`, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return (pawn?.needs?.food ?? 0) >= minimum;
  }, {
    failureMessage: `${pawnName} food stayed below ${minimum}`,
  });
}
```

```ts
// src/testing/scenario-probes/building-probes.ts
import { createAssertStep, createWaitForStep } from '@testing/scenario-dsl/scenario.builders';

export function waitForBlueprintDelivered(title, defId, timeoutTicks = 300) {
  return createWaitForStep(title, ({ query }) => {
    const blueprints = query.findBlueprintsByTargetDef(defId);
    return blueprints.length > 0 && blueprints.every(blueprint => {
      return blueprint.materialsRequired.every(requirement => {
        const delivered = blueprint.materialsDelivered.find(item => item.defId === requirement.defId)?.count ?? 0;
        return delivered >= requirement.count;
      });
    });
  }, {
    timeoutTicks,
    timeoutMessage: `${defId} blueprint materials were not fully delivered`,
  });
}

export function waitForBuildingCreated(title, defId, cell, timeoutTicks = 400) {
  return createWaitForStep(title, ({ query }) => query.findBuildingAt(defId, cell) !== null, {
    timeoutTicks,
    timeoutMessage: `${defId} was not created at (${cell.x}, ${cell.y})`,
  });
}

export function assertBuildingExists(defId, cell) {
  return createAssertStep(`${defId} exists at (${cell.x}, ${cell.y})`, ({ query }) => {
    return query.findBuildingAt(defId, cell) !== null;
  }, {
    failureMessage: `${defId} was not present at (${cell.x}, ${cell.y})`,
  });
}
```

- [ ] **Step 5: Delete the old mixed helper files once every replacement module compiles**

Run: `git rm src/testing/scenario-actions/setup-actions.ts src/testing/scenario-actions/player-actions.ts src/testing/scenario-actions/wait-conditions.ts`

Expected: the old helpers are removed from the tree and all remaining imports now point at `scenario-fixtures`, `scenario-commands`, or `scenario-probes`

- [ ] **Step 6: Run the harness tests and TypeScript again**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/scenario-harness/scenario-harness.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit the helper-layer split**

```bash
git add src/testing/scenario-fixtures src/testing/scenario-commands src/testing/scenario-probes src/testing/scenario-harness/scenario-harness.test.ts
git rm src/testing/scenario-actions/setup-actions.ts src/testing/scenario-actions/player-actions.ts src/testing/scenario-actions/wait-conditions.ts
git commit -m "refactor: split scenario helpers by boundary"
```

### Task 3: Rewrite The Four Existing Scenarios To Use The New Boundaries

**Files:**
- Modify: `src/testing/scenarios/woodcutting.scenario.ts`
- Modify: `src/testing/scenarios/stockpile-haul.scenario.ts`
- Modify: `src/testing/scenarios/eating.scenario.ts`
- Modify: `src/testing/scenarios/blueprint-construction.scenario.ts`
- Modify: `src/testing/headless/woodcutting.scenario.test.ts`
- Modify: `src/testing/headless/stockpile-haul.scenario.test.ts`
- Modify: `src/testing/headless/eating.scenario.test.ts`
- Modify: `src/testing/headless/blueprint-construction.scenario.test.ts`
- Modify: `src/testing/visual-runner/visual-scenario-controller.ts`

- [ ] **Step 1: Rewrite one existing scenario and its per-scenario test as the migration template**

```ts
// src/testing/scenarios/stockpile-haul.scenario.ts
import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand } from '../scenario-commands/zone-commands';
import { assertTotalItemCountInCells, waitForItemAt } from '../scenario-probes/item-probes';

export const stockpileHaulScenario = createScenario({
  id: 'stockpile-haul',
  title: '搬运进 Stockpile',
  description: '验证 stockpile 创建后，AI 会将木材搬入区域',
  report: {
    focus: '关注 pawn 是否在创建 stockpile 后识别出地面木材并搬运入库',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 6, y: 10 }, 5),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }]),
    waitForItemAt('等待木材进入 stockpile', 'wood', { x: 16, y: 10 }, 300),
  ],
  expect: [
    assertTotalItemCountInCells('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 5),
  ],
});
```

```ts
// src/testing/headless/stockpile-haul.scenario.test.ts
it('moves wood into the stockpile region', async () => {
  const result = await runHeadlessScenario(stockpileHaulScenario);
  expect(result.status).toBe('passed');
});
```

- [ ] **Step 2: Run the migrated stockpile test to verify the new helper imports work before touching the other scenarios**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/stockpile-haul.scenario.test.ts`

Expected: PASS

- [ ] **Step 3: Migrate the remaining three baseline scenarios using the same boundary rules**

```ts
// woodcutting.scenario.ts
//   setup  -> placeTreeFixture + spawnPawnFixture
//   script -> designateCutCommand + waitForNoPlantAt
//   expect -> assertWoodDropped
// eating.scenario.ts
//   setup  -> spawnPawnFixture + spawnItemFixture + setPawnFoodFixture
//   script -> waitForPawnJobDef + waitForPawnFoodAtLeast
//   expect -> assertPawnFoodAtLeast
// blueprint-construction.scenario.ts
//   setup  -> spawnPawnFixture + spawnItemFixture
//   script -> placeBlueprintCommand + waitForBlueprintDelivered + waitForBuildingCreated
//   expect -> assertBuildingExists
```

- [ ] **Step 4: Update the visual controller compile errors caused by the new step kinds**

```ts
// src/testing/visual-runner/visual-scenario-controller.ts
switch (step.kind) {
  case 'setup':
  case 'command':
    await step.run(step.kind === 'setup' ? setupContext : commandContext);
    break;
  case 'waitFor':
    while (!step.condition(probeContext)) {
      await waitForTick(visualHarness.world);
    }
    break;
  case 'assert':
    if (!step.assert(probeContext)) throw new Error(step.failureMessage ?? step.title);
    break;
}
```

- [ ] **Step 5: Run the baseline headless suite and TypeScript after all four scenarios are migrated**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/woodcutting.scenario.test.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/headless/eating.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit the baseline-scenario migration**

```bash
git add src/testing/scenarios/woodcutting.scenario.ts src/testing/scenarios/stockpile-haul.scenario.ts src/testing/scenarios/eating.scenario.ts src/testing/scenarios/blueprint-construction.scenario.ts src/testing/headless/woodcutting.scenario.test.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/headless/eating.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts src/testing/visual-runner/visual-scenario-controller.ts
git commit -m "refactor: migrate baseline scenarios to split helpers"
```

### Task 4: Add Long Regression Scenarios For Zone Lifecycle And Quantity-Aware Stacking

**Files:**
- Create: `src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts`
- Create: `src/testing/scenarios/quantity-haul-stack-chain.scenario.ts`
- Create: `src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts`
- Create: `src/testing/headless/quantity-haul-stack-chain.scenario.test.ts`
- Modify: `src/testing/scenario-registry.ts`

- [ ] **Step 1: Write the two new headless tests first**

```ts
// src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { zoneStockpileLifecycleScenario } from '@testing/scenarios/zone-stockpile-lifecycle.scenario';

describe('zoneStockpileLifecycleScenario', () => {
  it('keeps hauling into valid stockpile cells after expansion and partial removal', async () => {
    const result = await runHeadlessScenario(zoneStockpileLifecycleScenario);
    expect(result.status).toBe('passed');
  });
});
```

```ts
// src/testing/headless/quantity-haul-stack-chain.scenario.test.ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { quantityHaulStackChainScenario } from '@testing/scenarios/quantity-haul-stack-chain.scenario';

describe('quantityHaulStackChainScenario', () => {
  it('preserves total item count while hauling and stacking multiple piles into stockpile cells', async () => {
    const result = await runHeadlessScenario(quantityHaulStackChainScenario);
    expect(result.status).toBe('passed');
  });
});
```

- [ ] **Step 2: Run the two tests to confirm they fail before the scenarios exist**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts src/testing/headless/quantity-haul-stack-chain.scenario.test.ts`

Expected: FAIL with missing module errors for the new scenario files

- [ ] **Step 3: Implement the zone lifecycle scenario with expansion and removal in a single long script**

```ts
// src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts
import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand, removeZoneCellsCommand } from '../scenario-commands/zone-commands';
import { assertNoItemAt, assertTotalItemCountInCells, waitForItemAt } from '../scenario-probes/item-probes';

export const zoneStockpileLifecycleScenario = createScenario({
  id: 'zone-stockpile-lifecycle',
  title: 'Stockpile 区域生命周期',
  description: '验证 zone 创建、扩展、局部移除后，AI 仍能持续把木材送入有效格',
  report: {
    focus: '关注 zone 变化后，搬运目标格是否仍然合法且被移除的格子不再接收新物品',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 6, y: 10 }, 4),
    spawnItemFixture('wood', { x: 6, y: 12 }, 3),
    spawnItemFixture('wood', { x: 6, y: 14 }, 2),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }]),
    waitForItemAt('等待第一批木材进入 stockpile', 'wood', { x: 16, y: 10 }, 300),
    createZoneCommand('stockpile', [{ x: 18, y: 10 }, { x: 18, y: 11 }]),
    waitForItemAt('等待第二批木材进入扩展区域', 'wood', { x: 18, y: 10 }, 300),
    removeZoneCellsCommand([{ x: 16, y: 10 }]),
    waitForItemAt('等待第三批木材进入剩余有效格', 'wood', { x: 17, y: 10 }, 300),
  ],
  expect: [
    assertTotalItemCountInCells('wood', [{ x: 17, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 11 }], 9),
    assertNoItemAt('wood', { x: 6, y: 10 }),
    assertNoItemAt('wood', { x: 6, y: 12 }),
    assertNoItemAt('wood', { x: 6, y: 14 }),
  ],
});
```

- [ ] **Step 4: Implement the quantity-and-stack scenario with flexible but meaningful assertions**

```ts
// src/testing/scenarios/quantity-haul-stack-chain.scenario.ts
import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand } from '../scenario-commands/zone-commands';
import {
  assertAnyItemStackAtLeast,
  assertNoItemAt,
  assertTotalItemCountInCells,
  waitForItemAt,
} from '../scenario-probes/item-probes';

export const quantityHaulStackChainScenario = createScenario({
  id: 'quantity-haul-stack-chain',
  title: '数量搬运与堆叠链路',
  description: '验证多堆木材在入库后总量守恒、源地清空，并在 stockpile 中形成合理堆叠',
  report: {
    focus: '关注 pickup、deliver、drop 之后的最终总量与堆叠结果，而不是固定落点',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 4, y: 10 }, 3),
    spawnItemFixture('wood', { x: 5, y: 10 }, 5),
    spawnItemFixture('wood', { x: 6, y: 10 }, 7),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }]),
    waitForItemAt('等待第一批木材入库', 'wood', { x: 16, y: 10 }, 300),
    waitForItemAt('等待第二批木材入库', 'wood', { x: 17, y: 10 }, 300),
    waitForItemAt('等待第三批木材入库', 'wood', { x: 18, y: 10 }, 300),
  ],
  expect: [
    assertTotalItemCountInCells('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 15),
    assertAnyItemStackAtLeast('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 3),
    assertNoItemAt('wood', { x: 4, y: 10 }),
    assertNoItemAt('wood', { x: 5, y: 10 }),
    assertNoItemAt('wood', { x: 6, y: 10 }),
  ],
});
```

- [ ] **Step 5: Register both scenarios in the shared registry after the baseline four**

```ts
// src/testing/scenario-registry.ts
import { zoneStockpileLifecycleScenario } from './scenarios/zone-stockpile-lifecycle.scenario';
import { quantityHaulStackChainScenario } from './scenarios/quantity-haul-stack-chain.scenario';

export const scenarioRegistry = [
  woodcuttingScenario,
  stockpileHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
  zoneStockpileLifecycleScenario,
  quantityHaulStackChainScenario,
] as const;
```

- [ ] **Step 6: Run the two new tests, then the registry suite**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts src/testing/headless/quantity-haul-stack-chain.scenario.test.ts`

Expected: PASS

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/scenario-regression.test.ts`

Expected: PASS with six scenarios in the registry

- [ ] **Step 7: Commit the first wave of long-form scenarios**

```bash
git add src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts src/testing/scenarios/quantity-haul-stack-chain.scenario.ts src/testing/headless/zone-stockpile-lifecycle.scenario.test.ts src/testing/headless/quantity-haul-stack-chain.scenario.test.ts src/testing/scenario-registry.ts
git commit -m "test: add long zone and stacking regression scenarios"
```

### Task 5: Add The Interrupted Haul Recovery Scenario And Final Regression Coverage

**Files:**
- Create: `src/testing/scenarios/interrupted-haul-reservation-recovery.scenario.ts`
- Create: `src/testing/headless/interrupted-haul-reservation-recovery.scenario.test.ts`
- Modify: `src/testing/scenario-registry.ts`
- Modify: `src/testing/scenario-probes/pawn-probes.ts`
- Modify: `src/testing/scenario-probes/item-probes.ts`
- Modify: `src/testing/scenario-probes/reservation-probes.ts`
- Modify: `src/testing/scenario-probes/building-probes.ts`
- Modify: `src/testing/headless/scenario-regression.test.ts`

- [ ] **Step 1: Write the failing headless test for interrupted haul recovery**

```ts
// src/testing/headless/interrupted-haul-reservation-recovery.scenario.test.ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { interruptedHaulReservationRecoveryScenario } from '@testing/scenarios/interrupted-haul-reservation-recovery.scenario';

describe('interruptedHaulReservationRecoveryScenario', () => {
  it('releases reservations after interruption and allows another pawn to finish the delivery chain', async () => {
    const result = await runHeadlessScenario(interruptedHaulReservationRecoveryScenario);
    expect(result.status).toBe('passed');
  });
});
```

- [ ] **Step 2: Run the test to confirm the scenario and supporting probes do not exist yet**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/interrupted-haul-reservation-recovery.scenario.test.ts`

Expected: FAIL with missing-module errors for the scenario or helper exports such as `waitForPawnCarrying`

- [ ] **Step 3: Add the remaining probe helpers the complex scenario needs**

```ts
// src/testing/scenario-probes/pawn-probes.ts
export function waitForPawnJobDef(title, pawnName, jobDefId, timeoutTicks = 100) {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.ai?.currentJob?.defId === jobDefId;
  }, { timeoutTicks, timeoutMessage: `${pawnName} did not switch to ${jobDefId}` });
}

export function waitForPawnCarrying(title, pawnName, defId, minCount = 1, timeoutTicks = 100) {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.inventory.carrying?.defId === defId && (pawn.inventory.carrying?.count ?? 0) >= minCount;
  }, { timeoutTicks, timeoutMessage: `${pawnName} never carried ${defId}` });
}

export function assertPawnNotCarrying(pawnName) {
  return createAssertStep(`${pawnName} should not be carrying anything`, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.inventory.carrying == null;
  }, {
    failureMessage: `${pawnName} still has carried inventory`,
  });
}
```

```ts
// src/testing/scenario-probes/building-probes.ts
export function waitForBlueprintDelivered(title, defId, timeoutTicks = 300) {
  return createWaitForStep(title, ({ query }) => {
    const blueprints = query.findBlueprintsByTargetDef(defId);
    return blueprints.length > 0 && blueprints.every(blueprint => {
      return blueprint.materialsRequired.every(requirement => {
        const delivered = blueprint.materialsDelivered.find(item => item.defId === requirement.defId)?.count ?? 0;
        return delivered >= requirement.count;
      });
    });
  }, {
    timeoutTicks,
    timeoutMessage: `${defId} blueprint materials were not fully delivered`,
  });
}

export function waitForBuildingCreated(title, defId, cell, timeoutTicks = 400) {
  return createWaitForStep(title, ({ query }) => query.findBuildingAt(defId, cell) !== null, {
    timeoutTicks,
    timeoutMessage: `${defId} was not created at (${cell.x}, ${cell.y})`,
  });
}

export function assertBuildingExists(defId, cell) {
  return createAssertStep(`${defId} exists at (${cell.x}, ${cell.y})`, ({ query }) => {
    return query.findBuildingAt(defId, cell) !== null;
  }, {
    failureMessage: `${defId} was not present at (${cell.x}, ${cell.y})`,
  });
}
```

- [ ] **Step 4: Implement the complex recovery scenario around production commands only**

```ts
// src/testing/scenarios/interrupted-haul-reservation-recovery.scenario.ts
import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand } from '../scenario-commands/zone-commands';
import { draftPawnCommand, placeBlueprintCommand } from '../scenario-commands/player-commands';
import { waitForBuildingCreated, waitForBlueprintDelivered, assertBuildingExists } from '../scenario-probes/building-probes';
import { assertItemCountConserved } from '../scenario-probes/item-probes';
import { waitForPawnCarrying, waitForPawnJobDef, assertPawnNotCarrying } from '../scenario-probes/pawn-probes';
import { assertReservationReleased, waitForReservationReleased } from '../scenario-probes/reservation-probes';

export const interruptedHaulReservationRecoveryScenario = createScenario({
  id: 'interrupted-haul-reservation-recovery',
  title: '中断搬运后的预约恢复',
  setup: [
    spawnPawnFixture({ x: 8, y: 10 }, 'Hauler-A'),
    spawnPawnFixture({ x: 8, y: 12 }, 'Hauler-B'),
    spawnItemFixture('wood', { x: 4, y: 10 }, 15, { alias: 'sourceWood' }),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 14, y: 9 }, { x: 14, y: 10 }, { x: 14, y: 11 }]),
    placeBlueprintCommand('wall_wood', { x: 16, y: 10 }),
    waitForPawnJobDef('等待 A 接到送材工作', 'Hauler-A', 'job_deliver_materials', 200),
    waitForPawnCarrying('等待 A 拿起木材', 'Hauler-A', 'wood', 1, 200),
    draftPawnCommand('Hauler-A'),
    waitForReservationReleased('等待源木材 reservation 释放', 'sourceWood', 120),
    waitForPawnJobDef('等待 B 接手送材工作', 'Hauler-B', 'job_deliver_materials', 200),
    waitForBlueprintDelivered('等待蓝图材料送达', 'wall_wood', 300),
    waitForBuildingCreated('等待建筑完成', 'wall_wood', { x: 16, y: 10 }, 600),
  ],
  expect: [
    assertBuildingExists('wall_wood', { x: 16, y: 10 }),
    assertPawnNotCarrying('Hauler-A'),
    assertReservationReleased('sourceWood'),
    assertItemCountConserved('wood', 15),
  ],
});
```

- [ ] **Step 5: Register the recovery scenario last and keep the regression output readable**

```ts
// src/testing/scenario-registry.ts
import { interruptedHaulReservationRecoveryScenario } from './scenarios/interrupted-haul-reservation-recovery.scenario';

export const scenarioRegistry = [
  woodcuttingScenario,
  stockpileHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
  zoneStockpileLifecycleScenario,
  quantityHaulStackChainScenario,
  interruptedHaulReservationRecoveryScenario,
] as const;
```

- [ ] **Step 6: Run the new scenario test, the full regression suite, and the scenario script command**

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/interrupted-haul-reservation-recovery.scenario.test.ts`

Expected: PASS

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/scenario-regression.test.ts`

Expected: PASS with seven scenarios in the registry

Run: `npm run test:scenario`

Expected: PASS

- [ ] **Step 7: Commit the final scenario and registry update**

```bash
git add src/testing/scenarios/interrupted-haul-reservation-recovery.scenario.ts src/testing/headless/interrupted-haul-reservation-recovery.scenario.test.ts src/testing/scenario-probes/pawn-probes.ts src/testing/scenario-probes/item-probes.ts src/testing/scenario-probes/reservation-probes.ts src/testing/scenario-probes/building-probes.ts src/testing/scenario-registry.ts src/testing/headless/scenario-regression.test.ts
git commit -m "test: add interrupted haul recovery scenario"
```

### Task 6: Final Verification And Visual Smoke Pass

**Files:**
- Modify: none required unless verification exposes bugs
- Test: `src/testing/headless/scenario-regression.test.ts`
- Test: `src/testing/visual-runner/scenario-main.ts`

- [ ] **Step 1: Run TypeScript and the full scenario regression suite one more time**

Run: `npx tsc --noEmit`

Expected: PASS

Run: `npx vitest run --config vitest.scenario.config.ts src/testing/headless/scenario-regression.test.ts`

Expected: PASS with seven scenario entries

- [ ] **Step 2: Launch the visual runner and manually smoke the complex recovery scenario**

Run: `npm run scenario:visual`

Expected: the scenario page opens, the HUD lists the split helper step titles cleanly, and the interrupted haul recovery scenario reaches a passing end state without divergence caused by missing step-context wiring

- [ ] **Step 3: If the visual smoke pass succeeds, commit any final fixups**

```bash
git add .
git commit -m "test: verify scenario boundary refactor end to end"
```
