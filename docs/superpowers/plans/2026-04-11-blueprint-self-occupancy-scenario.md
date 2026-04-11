# Blueprint Self-Occupancy Scenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared construction scenario that tests whether the delivering pawn's own occupancy blocks blueprint promotion.

**Architecture:** Reuse the existing scenario DSL and headless runner. Add one narrowly-scoped query helper for construction-site lookup, then build a scenario and a headless regression test around that helper.

**Tech Stack:** TypeScript, Vitest, shared testing scenario DSL

---

### Task 1: Add the Failing Regression Test

**Files:**
- Create: `src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`
- Test: `src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { blueprintSelfOccupancyPromoteScenario } from '@testing/scenarios/blueprint-self-occupancy-promote.scenario';

describe('blueprintSelfOccupancyPromoteScenario', () => {
  it('shows whether self-occupancy blocks blueprint promotion after final delivery', async () => {
    const result = await runHeadlessScenario(blueprintSelfOccupancyPromoteScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    if (result.status !== 'passed') {
      console.log('FINAL SNAPSHOT', JSON.stringify(result.finalSnapshot, null, 2));
    }

    expect(result.status).toBe('passed');
    expect(result.finalSnapshot.buildings.some(b => b.defId === 'wall_wood')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

Expected: FAIL because the scenario module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the missing scenario module and any tiny query support required by that scenario. Do not change production construction behavior in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

Expected: PASS

### Task 2: Add Shared Scenario Observability

**Files:**
- Modify: `src/testing/scenario-dsl/scenario.types.ts`
- Modify: `src/testing/scenario-probes/query-api.ts`

- [ ] **Step 1: Write the failing test**

Use the same new headless regression test from Task 1 so the missing query capability is exercised by real scenario code.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

Expected: FAIL with a missing query method or scenario runtime error while checking for the construction site.

- [ ] **Step 3: Write minimal implementation**

Add a `findConstructionSiteAt(targetDefId, cell)` method to the shared query API shape and implement it against `ObjectKind.ConstructionSite`.

```ts
findConstructionSiteAt(targetDefId: string, cell: CellCoord): unknown | null;
```

```ts
findConstructionSiteAt(targetDefId, cell) {
  return harness.map.objects.allOfKind(ObjectKind.ConstructionSite).find((site: any) => {
    return site.targetDefId === targetDefId && site.cell.x === cell.x && site.cell.y === cell.y;
  }) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

Expected: either PASS or fail later in scenario execution for the next missing piece.

### Task 3: Implement the Shared Scenario and Register It

**Files:**
- Create: `src/testing/scenarios/blueprint-self-occupancy-promote.scenario.ts`
- Modify: `src/testing/scenario-registry.ts`
- Test: `src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

- [ ] **Step 1: Write the failing test**

Keep the same regression test. The red signal here is that the scenario is still missing from imports or does not yet satisfy the observed steps.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

Expected: FAIL because the scenario file or registry wiring is still incomplete.

- [ ] **Step 3: Write minimal implementation**

Create a scenario with:

- one builder at `{ x: 10, y: 10 }`
- one wood stack of `5` at `{ x: 8, y: 10 }`
- one wall blueprint at `{ x: 12, y: 10 }`
- waits for:
  - builder carrying wood
  - builder standing on blueprint cell while still carrying wood
  - construction site appearing at the blueprint cell
  - final building appearing at the same cell

Also register the scenario in `src/testing/scenario-registry.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`

Expected: PASS

### Task 4: Verify Against Existing Construction Coverage

**Files:**
- Test: `src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts`
- Test: `src/testing/headless/blueprint-construction.scenario.test.ts`

- [ ] **Step 1: Run the targeted regression suite**

Run: `npm test -- --run src/testing/headless/blueprint-self-occupancy-promote.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts`

Expected: PASS with both tests green.

- [ ] **Step 2: Record the interpretation**

If the new scenario passes, report that self-occupancy is not the cause because the delivering pawn can still trigger blueprint promotion while occupying the target cell.

If it fails, report the exact failing step and stop before proposing any fix.
