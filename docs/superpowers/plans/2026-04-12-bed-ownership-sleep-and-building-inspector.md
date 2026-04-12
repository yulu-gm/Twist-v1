# Bed Ownership Sleep And Building Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sleep auto-claim with owner-driven bed usage, keep floor sleep as the slower fallback, and ship a building inspector system with a bed-specific owner assignment panel.

**Architecture:** Keep all bed ownership rules in simulation, expose bed state through the existing snapshot reader, and let the Preact building inspector dispatch commands through `UiPorts` instead of mutating world state directly. Extend the current `building` UI domain rather than creating a parallel inspector path, and remove auto-assign behavior from the sleep/job selection pipeline so owner-driven sleep is the only bed selection rule.

**Tech Stack:** TypeScript, Preact, Vitest, existing command bus + snapshot bridge + scenario harness

---

### Task 1: Lock sleep behavior to owner beds and remove auto-assign

**Files:**
- Modify: `src/features/ai/work-evaluators/needs.evaluator.ts`
- Modify: `src/features/ai/job-selector.ts`
- Modify: `src/features/building/building.queries.ts`
- Test: `src/features/ai/sleep.behavior.test.ts`
- Test: `src/features/ai/work-evaluators/evaluators.test.ts`

- [ ] **Step 1: Write the failing sleep behavior tests**

```ts
it('uses the pawn owned bed and never auto-claims an unowned bed', () => {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 1 });
  const map = createGameMap({ id: 'main', width: 20, height: 20 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'Sleeper',
    cell: { x: 10, y: 10 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  pawn.needs.food = 80;
  pawn.needs.rest = 10;

  const ownedBed = createBuilding({ defId: 'bed_wood', cell: { x: 12, y: 10 }, mapId: map.id, defs });
  ownedBed.bed!.ownerPawnId = pawn.name;
  const strayBed = createBuilding({ defId: 'bed_wood', cell: { x: 4, y: 4 }, mapId: map.id, defs });

  map.objects.add(pawn);
  map.objects.add(ownedBed);
  map.objects.add(strayBed);

  jobSelectionSystem.execute(world);

  expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
  expect(pawn.ai.currentJob?.targetId).toBe(ownedBed.id);
  expect(strayBed.bed?.ownerPawnId).toBeUndefined();
});

it('falls back to floor sleep when another pawn owns the only bed', () => {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 2 });
  const map = createGameMap({ id: 'main', width: 20, height: 20 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'FloorSleeper',
    cell: { x: 6, y: 6 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  pawn.needs.food = 80;
  pawn.needs.rest = 10;

  const foreignBed = createBuilding({ defId: 'bed_wood', cell: { x: 8, y: 6 }, mapId: map.id, defs });
  foreignBed.bed!.ownerPawnId = 'SomeoneElse';

  map.objects.add(pawn);
  map.objects.add(foreignBed);

  jobSelectionSystem.execute(world);

  expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
  expect(pawn.ai.currentJob?.targetId).toBeUndefined();
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx vitest run src/features/ai/sleep.behavior.test.ts src/features/ai/work-evaluators/evaluators.test.ts`
Expected: FAIL because the evaluator still considers auto-assignable empty beds and `assignJob()` still mutates `ownerPawnId` during sleep assignment.

- [ ] **Step 3: Implement owner-only sleep selection**

```ts
// src/features/ai/work-evaluators/needs.evaluator.ts
import { getBedByOwner, isBedAvailable } from '../../building/building.queries';
import { isReachable } from '../../pathfinding/path.service';

export const sleepWorkEvaluator: WorkEvaluator = {
  kind: 'sleep',
  label: '睡觉',
  priority: 95,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    if (pawn.needs.rest >= pawn.needsProfile.sleepSeekThreshold) {
      return blockedSleep(world.tick, 'need_not_triggered', '还不够困');
    }

    const ownedBed = getBedByOwner(map, pawn.name);
    if (ownedBed && isBedAvailable(ownedBed)) {
      const interactionCell = ownedBed.interaction?.interactionCell ?? ownedBed.cell;
      if (isReachable(map, pawn.cell, interactionCell)) {
        const dist = estimateDistance(pawn.cell, interactionCell);
        const score = 90 + sleepUrgency(pawn) * 140 - dist * 0.5;
        return {
          kind: 'sleep',
          label: '睡觉',
          priority: 95,
          score,
          failureReasonCode: 'none',
          failureReasonText: null,
          detail: ownedBed.id,
          jobDefId: 'job_sleep',
          evaluatedAtTick: world.tick,
          createJob: () => createSleepJob(pawn.id, { bedId: ownedBed.id, interactionCell }, pawn.cell),
        };
      }
    }

    return createFloorSleepEvaluation(pawn, world.tick);
  },
};
```

```ts
// src/features/ai/job-selector.ts
function assignJob(
  pawn: Pawn,
  job: Job,
  map: GameMap,
  world: World,
): void {
  pawn.ai.currentJob = job;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.ai.idleTicks = 0;

  log.info('ai', `Pawn ${pawn.id} assigned job ${job.id} (${job.defId})`, undefined, pawn.id);
  world.eventBuffer.push({
    type: 'job_assigned',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });
}
```

```ts
// src/features/building/building.queries.ts
export function isBedAvailable(building: Building): boolean {
  return building.bed !== undefined && building.bed.occupantPawnId === undefined && !building.destroyed;
}
```

- [ ] **Step 4: Re-run the targeted tests to verify they pass**

Run: `npx vitest run src/features/ai/sleep.behavior.test.ts src/features/ai/work-evaluators/evaluators.test.ts`
Expected: PASS with owner-only bed selection and floor fallback preserved.

- [ ] **Step 5: Commit**

```bash
git add src/features/ai/work-evaluators/needs.evaluator.ts src/features/ai/job-selector.ts src/features/building/building.queries.ts src/features/ai/sleep.behavior.test.ts src/features/ai/work-evaluators/evaluators.test.ts
git commit -m "refactor: make sleep jobs respect bed ownership"
```

### Task 2: Add bed ownership commands and command registration

**Files:**
- Create: `src/features/building/building.commands.ts`
- Modify: `src/bootstrap/default-registrations.ts`
- Test: `src/features/building/building.commands.test.ts`

- [ ] **Step 1: Write the failing command tests**

```ts
it('assign_bed_owner moves ownership from the old bed to the new bed', () => {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 1 });
  const map = createGameMap({ id: 'main', width: 20, height: 20 });
  world.maps.set(map.id, map);

  const pawn = createPawn({ name: 'Alice', cell: { x: 5, y: 5 }, mapId: map.id, factionId: 'player', rng: world.rng });
  const oldBed = createBuilding({ defId: 'bed_wood', cell: { x: 8, y: 5 }, mapId: map.id, defs });
  const newBed = createBuilding({ defId: 'bed_wood', cell: { x: 10, y: 5 }, mapId: map.id, defs });
  oldBed.bed!.ownerPawnId = pawn.name;

  map.objects.add(pawn);
  map.objects.add(oldBed);
  map.objects.add(newBed);

  const result = assignBedOwnerHandler.execute(world, {
    type: 'assign_bed_owner',
    payload: { bedId: newBed.id, pawnId: pawn.id },
  });

  expect(oldBed.bed?.ownerPawnId).toBeUndefined();
  expect(newBed.bed?.ownerPawnId).toBe(pawn.name);
  expect(result.events[0]?.type).toBe('bed_owner_assigned');
});

it('clear_bed_owner clears only the owner field', () => {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 1 });
  const map = createGameMap({ id: 'main', width: 20, height: 20 });
  world.maps.set(map.id, map);

  const bed = createBuilding({ defId: 'bed_wood', cell: { x: 8, y: 5 }, mapId: map.id, defs });
  bed.bed!.ownerPawnId = 'Alice';
  bed.bed!.occupantPawnId = 'pawn_sleeping';
  map.objects.add(bed);

  clearBedOwnerHandler.execute(world, {
    type: 'clear_bed_owner',
    payload: { bedId: bed.id },
  });

  expect(bed.bed?.ownerPawnId).toBeUndefined();
  expect(bed.bed?.occupantPawnId).toBe('pawn_sleeping');
});
```

- [ ] **Step 2: Run the command tests to verify they fail**

Run: `npx vitest run src/features/building/building.commands.test.ts`
Expected: FAIL because `building.commands.ts` and its handlers do not exist yet.

- [ ] **Step 3: Implement the command handlers and register them**

```ts
// src/features/building/building.commands.ts
import { ObjectKind } from '../../core/types';
import type { CommandHandler } from '../../core/command-bus';
import type { World } from '../../world/world';
import type { Building } from './building.types';

function findBed(world: World, bedId: string): Building | undefined {
  for (const [, map] of world.maps) {
    const building = map.objects.getAs(bedId, ObjectKind.Building);
    if (building?.bed) return building;
  }
  return undefined;
}

function findPawnName(world: World, pawnId: string): string | undefined {
  for (const [, map] of world.maps) {
    const pawn = map.objects.getAs(pawnId, ObjectKind.Pawn);
    if (pawn) return pawn.name;
  }
  return undefined;
}

export const assignBedOwnerHandler: CommandHandler = {
  type: 'assign_bed_owner',
  validate(world, cmd) {
    const bed = findBed(world, cmd.payload.bedId as string);
    if (!bed) return { valid: false, reason: 'Bed not found' };
    const pawnName = findPawnName(world, cmd.payload.pawnId as string);
    if (!pawnName) return { valid: false, reason: 'Pawn not found' };
    return { valid: true };
  },
  execute(world, cmd) {
    const bed = findBed(world, cmd.payload.bedId as string)!;
    const pawnId = cmd.payload.pawnId as string;
    const pawnName = findPawnName(world, pawnId)!;

    for (const [, map] of world.maps) {
      for (const candidate of map.objects.allOfKind(ObjectKind.Building) as Building[]) {
        if (candidate.bed?.ownerPawnId === pawnName && candidate.id !== bed.id) {
          candidate.bed.ownerPawnId = undefined;
        }
      }
    }

    bed.bed!.ownerPawnId = pawnName;
    bed.bed!.role = 'owned';
    return {
      events: [{ type: 'bed_owner_assigned', tick: world.tick, data: { bedId: bed.id, pawnId, pawnName } }],
    };
  },
};

export const clearBedOwnerHandler: CommandHandler = {
  type: 'clear_bed_owner',
  validate(world, cmd) {
    return findBed(world, cmd.payload.bedId as string)
      ? { valid: true }
      : { valid: false, reason: 'Bed not found' };
  },
  execute(world, cmd) {
    const bed = findBed(world, cmd.payload.bedId as string)!;
    bed.bed!.ownerPawnId = undefined;
    if (bed.bed!.role === 'owned') bed.bed!.role = 'public';
    return {
      events: [{ type: 'bed_owner_cleared', tick: world.tick, data: { bedId: bed.id } }],
    };
  },
};

export const buildingCommandHandlers: CommandHandler[] = [
  assignBedOwnerHandler,
  clearBedOwnerHandler,
];
```

```ts
// src/bootstrap/default-registrations.ts
import { buildingCommandHandlers } from '../features/building/building.commands';

export function registerDefaultCommands(world: World): void {
  // ...
  world.commandBus.registerAll(buildingCommandHandlers);
  world.commandBus.registerAll(constructionCommandHandlers);
  world.commandBus.registerAll(designationCommandHandlers);
  world.commandBus.registerAll(pawnCommandHandlers);
  world.commandBus.registerAll(zoneCommandHandlers);
  world.commandBus.registerAll(saveCommandHandlers);
}
```

- [ ] **Step 4: Re-run the command tests**

Run: `npx vitest run src/features/building/building.commands.test.ts`
Expected: PASS with one-pawn-one-bed reassignment behavior and non-destructive owner clearing.

- [ ] **Step 5: Commit**

```bash
git add src/features/building/building.commands.ts src/features/building/building.commands.test.ts src/bootstrap/default-registrations.ts
git commit -m "feat: add bed ownership commands"
```

### Task 3: Expand snapshot and building view models for typed inspectors

**Files:**
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Modify: `src/ui/domains/building/building.types.ts`
- Modify: `src/ui/domains/building/building.selectors.ts`
- Test: `src/ui/domains/building/building.selectors.test.ts`

- [ ] **Step 1: Write the failing selector tests for generic and bed inspectors**

```ts
it('returns a generic inspector for non-bed buildings', () => {
  const vm = selectBuildingInspector(makeSnapshot({
    selection: { primaryId: 'wall_1', selectedIds: ['wall_1'] },
    buildings: {
      wall_1: {
        id: 'wall_1',
        label: 'Wood Wall',
        defId: 'wall_wood',
        cell: { x: 4, y: 4 },
        footprint: { width: 1, height: 1 },
        category: 'structure',
      },
    },
  } as Partial<EngineSnapshot>), makeUiState());

  expect(vm?.kind).toBe('generic');
  expect(vm?.base.stats.find(row => row.label === 'Type')?.value).toBe('Structure');
});

it('returns a bed inspector with owner actions and colonist options', () => {
  const vm = selectBuildingInspector(makeSnapshot({
    selection: { primaryId: 'bed_1', selectedIds: ['bed_1'] },
    colonists: {
      pawn_1: {
        id: 'pawn_1',
        name: 'Alice',
        cell: { x: 5, y: 5 },
        factionId: 'player',
        currentJob: 'idle',
        currentJobLabel: 'Idle',
        needs: { food: 80, rest: 70, joy: 80, mood: 70 },
        health: { hp: 100, maxHp: 100 },
        workDecision: null,
      },
    },
    buildings: {
      bed_1: {
        id: 'bed_1',
        label: 'Wood Bed',
        defId: 'bed_wood',
        cell: { x: 8, y: 12 },
        category: 'furniture',
        usageType: 'bed',
        footprint: { width: 1, height: 2 },
        bed: { role: 'owned', ownerPawnId: 'Alice', occupantPawnId: null, autoAssignable: false },
      },
    },
  } as Partial<EngineSnapshot>), makeUiState());

  expect(vm?.kind).toBe('bed');
  expect(vm?.detail.ownerLabel).toBe('Alice');
  expect(vm?.detail.availableOwners.map(option => option.label)).toEqual(['Alice']);
});
```

- [ ] **Step 2: Run the selector test file**

Run: `npx vitest run src/ui/domains/building/building.selectors.test.ts`
Expected: FAIL because `BuildingInspectorViewModel` is still a flat `{ id, label, stats }` shape.

- [ ] **Step 3: Implement typed building inspector models**

```ts
// src/ui/domains/building/building.types.ts
export interface BuildingInspectorStat {
  label: string;
  value: string;
}

export interface BuildingInspectorBaseViewModel {
  id: string;
  label: string;
  stats: BuildingInspectorStat[];
}

export interface BedInspectorDetailViewModel {
  role: string;
  ownerLabel: string;
  occupantLabel: string;
  availableOwners: Array<{ id: string; label: string }>;
}

export type BuildingInspectorViewModel =
  | { kind: 'generic'; base: BuildingInspectorBaseViewModel }
  | { kind: 'bed'; base: BuildingInspectorBaseViewModel; detail: BedInspectorDetailViewModel };
```

```ts
// src/ui/domains/building/building.selectors.ts
export function selectBuildingInspector(
  snapshot: EngineSnapshot,
  _uiState: UiState,
): BuildingInspectorViewModel | null {
  const primaryId = snapshot.selection.primaryId;
  if (!primaryId) return null;

  const building = snapshot.buildings?.[primaryId];
  if (!building) return null;

  const base = {
    id: building.id,
    label: building.label,
    stats: buildStats(building),
  };

  if (!building.bed) {
    return { kind: 'generic', base };
  }

  const availableOwners = Object.values(snapshot.colonists)
    .map(colonist => ({ id: colonist.id, label: colonist.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    kind: 'bed',
    base,
    detail: {
      role: toTitleCase(building.bed.role),
      ownerLabel: building.bed.ownerPawnId ?? 'Unassigned',
      occupantLabel: building.bed.occupantPawnId ?? 'Empty',
      availableOwners,
    },
  };
}
```

- [ ] **Step 4: Re-run selector tests**

Run: `npx vitest run src/ui/domains/building/building.selectors.test.ts`
Expected: PASS with separate generic vs bed inspector output.

- [ ] **Step 5: Commit**

```bash
git add src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/domains/building/building.types.ts src/ui/domains/building/building.selectors.ts src/ui/domains/building/building.selectors.test.ts
git commit -m "refactor: add typed building inspector view models"
```

### Task 4: Wire bed inspector actions through UiPorts and render the owner panel

**Files:**
- Modify: `src/ui/kernel/ui-ports.ts`
- Modify: `src/ui/app/app-shell.tsx`
- Modify: `src/ui/domains/building/components/building-inspector.tsx`
- Create: `src/ui/domains/building/components/building-inspector.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
it('renders bed owner and occupant labels', () => {
  render(
    <BuildingInspector
      viewModel={{
        kind: 'bed',
        base: { id: 'bed_1', label: 'Wood Bed', stats: [{ label: 'Type', value: 'Bed' }] },
        detail: {
          role: 'Owned',
          ownerLabel: 'Alice',
          occupantLabel: 'Empty',
          availableOwners: [{ id: 'pawn_1', label: 'Alice' }],
        },
      }}
      onAssignOwner={vi.fn()}
      onClearOwner={vi.fn()}
    />,
  );

  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Empty')).toBeInTheDocument();
});

it('dispatches assign and clear actions from the bed inspector', async () => {
  const onAssignOwner = vi.fn();
  const onClearOwner = vi.fn();

  render(
    <BuildingInspector
      viewModel={{
        kind: 'bed',
        base: { id: 'bed_1', label: 'Wood Bed', stats: [] },
        detail: {
          role: 'Owned',
          ownerLabel: 'Unassigned',
          occupantLabel: 'Empty',
          availableOwners: [{ id: 'pawn_1', label: 'Alice' }],
        },
      }}
      onAssignOwner={onAssignOwner}
      onClearOwner={onClearOwner}
    />,
  );

  await userEvent.selectOptions(screen.getByLabelText('Bed Owner'), 'pawn_1');
  expect(onAssignOwner).toHaveBeenCalledWith('bed_1', 'pawn_1');

  await userEvent.click(screen.getByRole('button', { name: 'Clear Owner' }));
  expect(onClearOwner).toHaveBeenCalledWith('bed_1');
});
```

- [ ] **Step 2: Run the building inspector component tests**

Run: `npx vitest run src/ui/domains/building/components/building-inspector.test.tsx`
Expected: FAIL because the component only accepts `viewModel` and renders a static `stats` table.

- [ ] **Step 3: Add UiPorts helpers and render the bed inspector controls**

```ts
// src/ui/kernel/ui-ports.ts
export interface UiPorts {
  dispatchCommand(command: Command): void;
  setSpeed(speed: number): void;
  selectObjects(ids: ObjectId[]): void;
  selectColonist(id: string): void;
  assignBedOwner(bedId: string, pawnId: string): void;
  clearBedOwner(bedId: string): void;
  setTool(tool: string, designationType?: string | null, buildDefId?: string | null, zoneType?: string | null): void;
  jumpCameraTo(cell: { x: number; y: number }): void;
}

export function createUiPorts(commandQueue: Command[], presentation: PresentationState): UiPorts {
  return {
    // ...
    assignBedOwner(bedId: string, pawnId: string): void {
      commandQueue.push({ type: 'assign_bed_owner', payload: { bedId, pawnId } });
    },
    clearBedOwner(bedId: string): void {
      commandQueue.push({ type: 'clear_bed_owner', payload: { bedId } });
    },
  };
}
```

```tsx
// src/ui/domains/building/components/building-inspector.tsx
interface BuildingInspectorProps {
  viewModel: BuildingInspectorViewModel;
  onAssignOwner?: (bedId: string, pawnId: string) => void;
  onClearOwner?: (bedId: string) => void;
}

export function BuildingInspector({ viewModel, onAssignOwner, onClearOwner }: BuildingInspectorProps) {
  const base = viewModel.base;

  return (
    <div class="inspector-panel">
      <div class="inspector-panel__header">{base.label}</div>
      <div class="inspector-panel__body">
        <Section title="Info">
          {base.stats.map((stat) => (
            <StatRow key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </Section>

        {viewModel.kind === 'bed' && (
          <Section title="Bed">
            <StatRow label="Role" value={viewModel.detail.role} />
            <StatRow label="Owner" value={viewModel.detail.ownerLabel} />
            <StatRow label="Occupant" value={viewModel.detail.occupantLabel} />
            <label>
              <span>Bed Owner</span>
              <select onInput={(event) => onAssignOwner?.(base.id, (event.currentTarget as HTMLSelectElement).value)}>
                <option value="" disabled selected={viewModel.detail.ownerLabel === 'Unassigned'}>Assign owner</option>
                {viewModel.detail.availableOwners.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => onClearOwner?.(base.id)}>Clear Owner</button>
          </Section>
        )}
      </div>
    </div>
  );
}
```

```tsx
// src/ui/app/app-shell.tsx
{buildingInspector && (
  <BuildingInspector
    viewModel={buildingInspector}
    onAssignOwner={(bedId, pawnId) => ports.assignBedOwner(bedId, pawnId)}
    onClearOwner={(bedId) => ports.clearBedOwner(bedId)}
  />
)}
```

- [ ] **Step 4: Re-run the component tests**

Run: `npx vitest run src/ui/domains/building/components/building-inspector.test.tsx`
Expected: PASS with rendered owner controls and dispatch callbacks.

- [ ] **Step 5: Commit**

```bash
git add src/ui/kernel/ui-ports.ts src/ui/app/app-shell.tsx src/ui/domains/building/components/building-inspector.tsx src/ui/domains/building/components/building-inspector.test.tsx
git commit -m "feat: add bed owner controls to building inspector"
```

### Task 5: Update scenarios to match explicit ownership and fix the pre-existing TS regression

**Files:**
- Modify: `src/testing/scenarios/sleep-bed-occupancy.scenario.ts`
- Modify: `src/testing/scenarios/bed-blueprint-sleep.scenario.ts`
- Modify: `src/testing/headless/sleep-bed-occupancy.scenario.test.ts`
- Modify: `src/testing/headless/bed-blueprint-sleep.scenario.test.ts`

- [ ] **Step 1: Write the failing scenario expectations**

```ts
createWaitForStep('等待两张床都被显式 owner 使用', ({ harness, query }) => {
  harness.world.commandBus.enqueue({
    type: 'assign_bed_owner',
    payload: { bedId: query.findBuildingAt('bed_wood', BED_CELLS[0])!.id, pawnId: query.findPawnByName('Sleeper-A')!.id },
  });
  harness.world.commandBus.enqueue({
    type: 'assign_bed_owner',
    payload: { bedId: query.findBuildingAt('bed_wood', BED_CELLS[1])!.id, pawnId: query.findPawnByName('Sleeper-B')!.id },
  });
  return true;
});

createAssertStep('未分配床位的小人应继续打地铺', ({ query }) => {
  const pawn = query.findPawnByName('Sleeper-C') as any;
  return pawn?.ai.currentJob?.defId === 'job_sleep' && !pawn.ai.currentJob?.targetId;
}, {
  failureMessage: '未拥有床位的小人没有按预期打地铺',
});
```

- [ ] **Step 2: Run the headless scenario tests**

Run: `npx vitest run src/testing/headless/sleep-bed-occupancy.scenario.test.ts src/testing/headless/bed-blueprint-sleep.scenario.test.ts`
Expected: FAIL because the scenarios still rely on sleep-time auto-claim and the blueprint scenario still carries the `.id` typing issue from the memory file.

- [ ] **Step 3: Rewrite scenarios to enqueue explicit owner assignment and fix the typing**

```ts
// src/testing/scenarios/sleep-bed-occupancy.scenario.ts
createSetupStep('为前两张床分配 owner', ({ harness, query }) => {
  const bedA = query.findBuildingAt('bed_wood', BED_CELLS[0]);
  const bedB = query.findBuildingAt('bed_wood', BED_CELLS[1]);
  const sleeperA = query.findPawnByName('Sleeper-A');
  const sleeperB = query.findPawnByName('Sleeper-B');

  if (!bedA || !bedB || !sleeperA || !sleeperB) {
    throw new Error('缺少床位或小人，无法分配 owner');
  }

  harness.world.commandBus.enqueue({ type: 'assign_bed_owner', payload: { bedId: bedA.id, pawnId: sleeperA.id } });
  harness.world.commandBus.enqueue({ type: 'assign_bed_owner', payload: { bedId: bedB.id, pawnId: sleeperB.id } });
});
```

```ts
// src/testing/scenarios/bed-blueprint-sleep.scenario.ts
const beds = BED_CELLS
  .map(cell => query.findBuildingAt('bed_wood', cell))
  .filter((bed): bed is NonNullable<typeof bed> => bed !== null);
builtBedIds = beds.map(bed => bed.id);

createSetupStep('按顺序分配新床 owner', ({ harness, query }) => {
  const beds = BED_CELLS.map(cell => query.findBuildingAt('bed_wood', cell)).filter((bed): bed is NonNullable<typeof bed> => bed !== null);
  const sleepers = SLEEPER_NAMES.map(name => query.findPawnByName(name)).filter((pawn): pawn is NonNullable<typeof pawn> => pawn !== null);

  beds.forEach((bed, index) => {
    harness.world.commandBus.enqueue({
      type: 'assign_bed_owner',
      payload: { bedId: bed.id, pawnId: sleepers[index]!.id },
    });
  });
});
```

- [ ] **Step 4: Re-run the headless scenario tests**

Run: `npx vitest run src/testing/headless/sleep-bed-occupancy.scenario.test.ts src/testing/headless/bed-blueprint-sleep.scenario.test.ts`
Expected: PASS with explicit ownership, owner persistence after wake-up, and no `.id` TypeScript complaint in the updated scenario code.

- [ ] **Step 5: Commit**

```bash
git add src/testing/scenarios/sleep-bed-occupancy.scenario.ts src/testing/scenarios/bed-blueprint-sleep.scenario.ts src/testing/headless/sleep-bed-occupancy.scenario.test.ts src/testing/headless/bed-blueprint-sleep.scenario.test.ts
git commit -m "test: update sleep scenarios for explicit bed ownership"
```

### Task 6: Run the focused verification sweep

**Files:**
- Modify: none
- Test: `src/features/ai/sleep.behavior.test.ts`
- Test: `src/features/building/building.commands.test.ts`
- Test: `src/ui/domains/building/building.selectors.test.ts`
- Test: `src/ui/domains/building/components/building-inspector.test.tsx`
- Test: `src/testing/headless/sleep-bed-occupancy.scenario.test.ts`
- Test: `src/testing/headless/bed-blueprint-sleep.scenario.test.ts`

- [ ] **Step 1: Run the focused sleep/building/UI suite**

Run: `npx vitest run src/features/ai/sleep.behavior.test.ts src/features/building/building.commands.test.ts src/ui/domains/building/building.selectors.test.ts src/ui/domains/building/components/building-inspector.test.tsx src/testing/headless/sleep-bed-occupancy.scenario.test.ts src/testing/headless/bed-blueprint-sleep.scenario.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, including the previously noted `src/testing/scenarios/bed-blueprint-sleep.scenario.ts` typing issue.

- [ ] **Step 3: Commit the verification checkpoint if no code changed**

```bash
git status --short
```

Expected: clean working tree.

---

## Coverage Check

- Bed ownership now drives sleep target selection: Task 1.
- Floor sleep remains valid and slower: Task 1 verification plus existing floor sleep assertions.
- One pawn owns at most one bed: Task 2.
- Building inspector gains generic + bed-specific paths: Task 3.
- Bed inspector can assign and clear owner via command bus: Task 4.
- Headless sleep scenarios reflect explicit ownership and preserve owner after wake-up: Task 5.
- Known `bed-blueprint-sleep.scenario.ts` typing problem is fixed as part of scenario rewrite: Task 5 + Task 6.
