# 结构化 Pawn 工作评估 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 pawn 引入统一的工作评估器与冻结决策快照，并在 inspector 中按优先级展示 active、blocked、deferred 三类工作状态。

**Architecture:** 保留现有 `Job` / `Toil` 执行模型，把“为什么选这份工作”的结构化信息放进新的 work evaluation 层。`job-selector` 只负责调度 evaluator、尝试 assignment、冻结快照；UI 只读取 `snapshot-reader` 投影出的只读 `workDecision` 数据，不直接理解 simulation 内部对象。

**Tech Stack:** TypeScript、Vitest、Preact、现有 AI job/toil 系统、现有 UI snapshot/selectors 结构。

---

## File Structure

- `src/features/ai/work-types.ts`
  负责定义 `WorkDecisionStatus`、`WorkFailureReasonCode`、`WorkOption`、`WorkEvaluation`、`PawnWorkDecisionSnapshot`。
- `src/features/ai/work-evaluator.types.ts`
  负责定义 `WorkEvaluator` 接口、评估上下文和 `createJob` 签名。
- `src/features/ai/work-evaluators/index.ts`
  负责导出固定顺序的 evaluator 列表。
- `src/features/ai/work-evaluators/needs.evaluator.ts`
  负责 `eat`、`sleep` 两类需求工作。
- `src/features/ai/work-evaluators/designation.evaluator.ts`
  负责 `designation_mine`、`designation_harvest`。
- `src/features/ai/work-evaluators/construction.evaluator.ts`
  负责 `deliver_materials`、`construct`。
- `src/features/ai/work-evaluators/hauling.evaluator.ts`
  负责 `haul_to_stockpile`。
- `src/features/ai/work-evaluators/carrying.evaluator.ts`
  负责 `resolve_carrying`。
- `src/features/ai/work-evaluators/wander.evaluator.ts`
  负责 `wander` fallback。
- `src/features/ai/job-selector.ts`
  负责 orchestrate evaluator、排序、assignment、冻结决策快照。
- `src/features/pawn/pawn.types.ts`
  给 `pawn.ai` 增加 `workDecision` 字段。
- `src/features/pawn/pawn.factory.ts`
  初始化 `pawn.ai.workDecision`。
- `src/features/ai/job-selector.work-decision.test.ts`
  覆盖快照冻结、active / deferred / reservation fallback。
- `src/features/ai/job-selector.work-reasons.test.ts`
  覆盖 blocked reason 与 carrying conflict。
- `src/ui/kernel/ui-types.ts`
  定义 `ColonistWorkDecisionNode` 及快照投影。
- `src/ui/kernel/snapshot-reader.ts`
  把 `pawn.ai.workDecision` 投影成 UI 快照。
- `src/ui/kernel/snapshot-reader.test.ts`
  验证 snapshot 投影。
- `src/ui/domains/colonist/colonist.types.ts`
  定义 `WorkQueueRowViewModel` 并扩展 inspector view model。
- `src/ui/domains/colonist/colonist.selectors.ts`
  生成工作队列行视图模型。
- `src/ui/domains/colonist/colonist.selectors.test.ts`
  验证 selector 映射和空状态。
- `src/ui/domains/colonist/components/colonist-inspector.tsx`
  渲染 `Work Queue` 区块。
- `src/ui/domains/colonist/components/colonist-inspector.test.tsx`
  验证组件渲染 active / blocked / deferred。
- `src/ui/styles/app.css`
  增加工作队列行样式。

### Task 1: 建立 Work Decision 领域模型并产出第一版冻结快照

**Files:**
- Create: `src/features/ai/work-types.ts`
- Create: `src/features/ai/work-evaluator.types.ts`
- Create: `src/features/ai/work-evaluators/index.ts`
- Create: `src/features/ai/work-evaluators/needs.evaluator.ts`
- Create: `src/features/ai/work-evaluators/hauling.evaluator.ts`
- Create: `src/features/ai/work-evaluators/wander.evaluator.ts`
- Create: `src/features/ai/job-selector.work-decision.test.ts`
- Modify: `src/features/ai/job-selector.ts`
- Modify: `src/features/pawn/pawn.types.ts`
- Modify: `src/features/pawn/pawn.factory.ts`

- [ ] **Step 1: 先写失败测试，锁定冻结快照的基础语义**

```ts
import { describe, expect, it } from 'vitest';
import { ZoneType, cellKey } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { jobSelectionSystem } from './job-selector';

function addStockpile(map: ReturnType<typeof createGameMap>, cell: { x: number; y: number }) {
  map.zones.add({
    id: 'zone_stockpile',
    zoneType: ZoneType.Stockpile,
    cells: new Set([cellKey(cell)]),
    config: { stockpile: { allowAllHaulable: true, allowedDefIds: new Set() } },
  });
}

describe('job selector work decision snapshot', () => {
  it('freezes ranked work options and marks the selected option active', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    map.objects.add(createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 2,
      defs,
    }));

    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 4, y: 1 },
      mapId: map.id,
      stackCount: 10,
      defs,
    }));
    addStockpile(map, { x: 8, y: 1 });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_eat');
    expect(pawn.ai.workDecision?.selectedWorkKind).toBe('eat');
    expect(pawn.ai.workDecision?.options[0]).toMatchObject({
      kind: 'eat',
      status: 'active',
    });
    expect(pawn.ai.workDecision?.options.some(option => (
      option.kind === 'haul_to_stockpile' && option.status === 'deferred'
    ))).toBe(true);
  });

  it('records a blocked higher-priority option when reservation fails and falls through', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    const meal = createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 2,
      defs,
    });
    map.objects.add(meal);
    map.reservations.tryReserve({
      claimantId: 'other_pawn',
      targetId: meal.id,
      jobId: 'job_other',
      currentTick: world.tick,
    });

    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 4, y: 1 },
      mapId: map.id,
      stackCount: 10,
      defs,
    }));
    addStockpile(map, { x: 8, y: 1 });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_haul');
    expect(pawn.ai.workDecision?.options[0]).toMatchObject({
      kind: 'eat',
      status: 'blocked',
      failureReasonCode: 'target_reserved',
    });
    expect(pawn.ai.workDecision?.options.some(option => (
      option.kind === 'haul_to_stockpile' && option.status === 'active'
    ))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认它因为缺少结构化快照而失败**

Run: `npm test -- src/features/ai/job-selector.work-decision.test.ts`

Expected: `FAIL`，错误集中在 `pawn.ai.workDecision` 不存在，或 selector 还没有生成 `active / blocked / deferred` 决策快照。

- [ ] **Step 3: 实现最小工作模型、pawn 持久字段和基础 evaluator 管线**

```ts
// src/features/ai/work-types.ts
import type { DefId, JobId, ToilState } from '../../core/types';

export type WorkDecisionStatus = 'available' | 'blocked' | 'active' | 'deferred';

export type WorkFailureReasonCode =
  | 'none'
  | 'no_target'
  | 'target_reserved'
  | 'target_unreachable'
  | 'need_not_triggered'
  | 'no_stockpile_destination';

export interface WorkOption {
  kind: string;
  label: string;
  status: WorkDecisionStatus;
  priority: number;
  score: number;
  failureReasonCode: WorkFailureReasonCode;
  failureReasonText: string | null;
  detail: string | null;
  jobDefId: DefId | null;
  evaluatedAtTick: number;
}

export interface WorkEvaluation extends Omit<WorkOption, 'status'> {
  createJob: (() => import('./ai.types').Job | null) | null;
}

export interface PawnWorkDecisionSnapshot {
  evaluatedAtTick: number;
  selectedWorkKind: string | null;
  selectedWorkLabel: string | null;
  selectedJobId: JobId | null;
  activeToilLabel: string | null;
  activeToilState: ToilState | null;
  options: WorkOption[];
}
```

```ts
// src/features/pawn/pawn.types.ts
import type { PawnWorkDecisionSnapshot } from '../ai/work-types';

ai: {
  currentJob: Job | null;
  currentToilIndex: number;
  toilState: Record<string, unknown>;
  idleTicks: number;
  workDecision: PawnWorkDecisionSnapshot | null;
};
```

```ts
// src/features/pawn/pawn.factory.ts
ai: {
  currentJob: null,
  currentToilIndex: 0,
  toilState: {},
  idleTicks: 0,
  workDecision: null,
},
```

```ts
// src/features/ai/work-evaluator.types.ts
import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';
import type { Pawn } from '../pawn/pawn.types';
import type { WorkEvaluation } from './work-types';

export interface WorkEvaluator {
  kind: string;
  label: string;
  priority: number;
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation;
}
```

```ts
// src/features/ai/work-evaluators/index.ts
import type { WorkEvaluator } from '../work-evaluator.types';
import { eatWorkEvaluator, sleepWorkEvaluator } from './needs.evaluator';
import { haulToStockpileWorkEvaluator } from './hauling.evaluator';
import { wanderWorkEvaluator } from './wander.evaluator';

export const workEvaluators: WorkEvaluator[] = [
  eatWorkEvaluator,
  sleepWorkEvaluator,
  haulToStockpileWorkEvaluator,
  wanderWorkEvaluator,
];
```

```ts
// src/features/ai/job-selector.ts
import type { WorkEvaluation, WorkOption } from './work-types';
import { workEvaluators } from './work-evaluators';

function freezeWorkDecision(
  pawn: Pawn,
  evaluations: WorkEvaluation[],
  selectedKind: string | null,
  worldTick: number,
): void {
  const currentToil = pawn.ai.currentJob?.toils[pawn.ai.currentJob.currentToilIndex];
  const options: WorkOption[] = evaluations.map((evaluation) => ({
    kind: evaluation.kind,
    label: evaluation.label,
    priority: evaluation.priority,
    score: evaluation.score,
    failureReasonCode: evaluation.failureReasonCode,
    failureReasonText: evaluation.failureReasonText,
    detail: evaluation.detail,
    jobDefId: evaluation.jobDefId,
    evaluatedAtTick: worldTick,
    status: evaluation.kind === selectedKind
      ? 'active'
      : evaluation.failureReasonCode !== 'none'
        ? 'blocked'
        : 'deferred',
  }));

  pawn.ai.workDecision = {
    evaluatedAtTick: worldTick,
    selectedWorkKind: selectedKind,
    selectedWorkLabel: options.find(option => option.kind === selectedKind)?.label ?? null,
    selectedJobId: pawn.ai.currentJob?.id ?? null,
    activeToilLabel: currentToil?.type ?? null,
    activeToilState: currentToil?.state ?? null,
    options,
  };
}
```

- [ ] **Step 4: 重新运行测试，确认快照最小闭环成立**

Run: `npm test -- src/features/ai/job-selector.work-decision.test.ts`

Expected: `PASS`，并且两个用例都能看到 `selectedWorkKind`、`blocked` 和 `deferred`。

- [ ] **Step 5: 提交这一批基础结构改动**

```bash
git add src/features/ai/work-types.ts src/features/ai/work-evaluator.types.ts src/features/ai/work-evaluators/index.ts src/features/ai/work-evaluators/needs.evaluator.ts src/features/ai/work-evaluators/hauling.evaluator.ts src/features/ai/work-evaluators/wander.evaluator.ts src/features/ai/job-selector.ts src/features/ai/job-selector.work-decision.test.ts src/features/pawn/pawn.types.ts src/features/pawn/pawn.factory.ts
git commit -m "feat: add pawn work decision snapshot foundation"
```

### Task 2: 抽出剩余 evaluator 并补齐 blocked 原因

**Files:**
- Create: `src/features/ai/work-evaluators/designation.evaluator.ts`
- Create: `src/features/ai/work-evaluators/construction.evaluator.ts`
- Create: `src/features/ai/work-evaluators/carrying.evaluator.ts`
- Create: `src/features/ai/job-selector.work-reasons.test.ts`
- Modify: `src/features/ai/work-evaluators/index.ts`
- Modify: `src/features/ai/work-types.ts`
- Modify: `src/features/ai/job-selector.ts`

- [ ] **Step 1: 先写失败测试，锁定 blocked reason 和 carrying conflict 语义**

```ts
import { describe, expect, it } from 'vitest';
import { ZoneType, cellKey } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { placeBlueprintHandler } from '../construction/construction.commands';
import { jobSelectionSystem } from './job-selector';

describe('job selector work reasons', () => {
  it('marks construct blocked when a blueprint is not fully delivered and activates deliver_materials', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    placeBlueprintHandler.execute(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 8, y: 2 }, mapId: map.id },
    } as any);

    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      stackCount: 10,
      defs,
    }));

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_deliver_materials');
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'construct'))
      .toMatchObject({ status: 'blocked', failureReasonCode: 'materials_not_delivered' });
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'deliver_materials'))
      .toMatchObject({ status: 'active' });
  });

  it('marks pickup-based work blocked by carrying conflict and activates resolve_carrying', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 16, height: 16 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.inventory.carrying = { defId: 'wood', count: 12 };
    pawn.needs.food = 10;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    map.objects.add(createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 1,
      defs,
    }));

    map.zones.add({
      id: 'zone_stockpile',
      zoneType: ZoneType.Stockpile,
      cells: new Set([cellKey({ x: 5, y: 1 })]),
      config: { stockpile: { allowAllHaulable: true, allowedDefIds: new Set() } },
    });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_carry');
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'eat'))
      .toMatchObject({ status: 'blocked', failureReasonCode: 'carrying_conflict' });
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'resolve_carrying'))
      .toMatchObject({ status: 'active' });
  });
});
```

- [ ] **Step 2: 运行测试，确认缺少 evaluator 和原因码时测试失败**

Run: `npm test -- src/features/ai/job-selector.work-reasons.test.ts`

Expected: `FAIL`，错误会集中在 `construct` / `deliver_materials` / `resolve_carrying` 决策项不存在，或 `materials_not_delivered` / `carrying_conflict` 原因码尚未定义。

- [ ] **Step 3: 实现剩余 evaluator，并让 selector 在 assignment 失败时回写 blocked reason**

```ts
// src/features/ai/work-types.ts
export type WorkFailureReasonCode =
  | 'none'
  | 'no_target'
  | 'target_reserved'
  | 'target_unreachable'
  | 'need_not_triggered'
  | 'no_stockpile_destination'
  | 'materials_not_delivered'
  | 'carrying_conflict'
  | 'no_available_bed'
  | 'no_reachable_material_source';
```

```ts
// src/features/ai/work-evaluators/construction.evaluator.ts
export const deliverMaterialsWorkEvaluator: WorkEvaluator = {
  kind: 'deliver_materials',
  label: 'Deliver Materials',
  priority: 60,
  evaluate(pawn, map, world) {
    const candidate = findBestDeliveryCandidate(pawn, map, world);
    if (!candidate) {
      return {
        kind: 'deliver_materials',
        label: 'Deliver Materials',
        priority: 60,
        score: -1,
        failureReasonCode: 'no_reachable_material_source',
        failureReasonText: 'No reachable material source',
        detail: null,
        jobDefId: null,
        evaluatedAtTick: world.tick,
        createJob: null,
      };
    }
    return {
      kind: 'deliver_materials',
      label: 'Deliver Materials',
      priority: 60,
      score: candidate.score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: candidate.detail,
      jobDefId: 'job_deliver_materials',
      evaluatedAtTick: world.tick,
      createJob: candidate.createJob,
    };
  },
};

export const constructWorkEvaluator: WorkEvaluator = {
  kind: 'construct',
  label: 'Construct',
  priority: 55,
  evaluate(pawn, map, world) {
    const candidate = findBestConstructCandidate(pawn, map);
    if (!candidate) {
      return {
        kind: 'construct',
        label: 'Construct',
        priority: 55,
        score: -1,
        failureReasonCode: 'materials_not_delivered',
        failureReasonText: 'Materials not delivered',
        detail: null,
        jobDefId: null,
        evaluatedAtTick: world.tick,
        createJob: null,
      };
    }
    return {
      kind: 'construct',
      label: 'Construct',
      priority: 55,
      score: candidate.score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: candidate.detail,
      jobDefId: 'job_construct',
      evaluatedAtTick: world.tick,
      createJob: candidate.createJob,
    };
  },
};
```

```ts
// src/features/ai/work-evaluators/carrying.evaluator.ts
export const resolveCarryingWorkEvaluator: WorkEvaluator = {
  kind: 'resolve_carrying',
  label: 'Resolve Carrying',
  priority: 20,
  evaluate(pawn, map, world) {
    const candidate = createCarryResolutionCandidate(pawn, map, world);
    if (!candidate) {
      return {
        kind: 'resolve_carrying',
        label: 'Resolve Carrying',
        priority: 20,
        score: -1,
        failureReasonCode: 'no_stockpile_destination',
        failureReasonText: 'No legal destination for carried item',
        detail: null,
        jobDefId: null,
        evaluatedAtTick: world.tick,
        createJob: null,
      };
    }
    return {
      kind: 'resolve_carrying',
      label: 'Resolve Carrying',
      priority: 20,
      score: candidate.score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: candidate.job.defId,
      jobDefId: candidate.job.defId,
      evaluatedAtTick: world.tick,
      createJob: () => candidate.job,
    };
  },
};
```

```ts
// src/features/ai/job-selector.ts
for (const evaluation of evaluations) {
  if (!evaluation.createJob) continue;
  const job = evaluation.createJob();
  if (!job) continue;

  if (isJobBlockedByCarriedItems(pawn, job)) {
    evaluation.failureReasonCode = 'carrying_conflict';
    evaluation.failureReasonText = 'Current carrying stack blocks pickup-based work';
    continue;
  }

  if (job.targetId) {
    const reservationId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: job.targetId,
      jobId: job.id,
      currentTick: world.tick,
    });
    if (reservationId === null) {
      evaluation.failureReasonCode = 'target_reserved';
      evaluation.failureReasonText = 'Target already reserved';
      continue;
    }
    job.reservations.push(reservationId);
  }

  assignJob(pawn, job, map, world);
  freezeWorkDecision(pawn, evaluations, evaluation.kind, world.tick);
  return;
}
```

- [ ] **Step 4: 重新运行测试，确认 blocked reason 与剩余 evaluator 生效**

Run: `npm test -- src/features/ai/job-selector.work-reasons.test.ts src/features/ai/job-selector.work-decision.test.ts`

Expected: `PASS`，并且可以看到 `materials_not_delivered`、`carrying_conflict`、`target_reserved` 三类原因被稳定记录。

- [ ] **Step 5: 提交 evaluator 拆分与 blocked reason 改动**

```bash
git add src/features/ai/work-types.ts src/features/ai/work-evaluators/index.ts src/features/ai/work-evaluators/designation.evaluator.ts src/features/ai/work-evaluators/construction.evaluator.ts src/features/ai/work-evaluators/carrying.evaluator.ts src/features/ai/job-selector.ts src/features/ai/job-selector.work-reasons.test.ts
git commit -m "feat: structure pawn work evaluators and blocked reasons"
```

### Task 3: 将工作决策快照投影到 UI snapshot 与 colonist selector

**Files:**
- Create: `src/ui/kernel/snapshot-reader.test.ts`
- Modify: `src/ui/kernel/ui-types.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Modify: `src/ui/domains/colonist/colonist.types.ts`
- Modify: `src/ui/domains/colonist/colonist.selectors.ts`
- Modify: `src/ui/domains/colonist/colonist.selectors.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 snapshot-reader 和 colonist selector 的读模型**

```ts
// src/ui/kernel/snapshot-reader.test.ts
import { describe, expect, it } from 'vitest';
import { ToilState } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../../features/pawn/pawn.factory';
import { createPresentationState } from '../../presentation/presentation-state';
import { readEngineSnapshot } from './snapshot-reader';

describe('readEngineSnapshot work decision projection', () => {
  it('projects pawn workDecision into colonist snapshot data', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 8, height: 8 });
    const presentation = createPresentationState();
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.ai.workDecision = {
      evaluatedAtTick: 12,
      selectedWorkKind: 'eat',
      selectedWorkLabel: 'Eat',
      selectedJobId: 'job_eat_1',
      activeToilLabel: 'pickup',
      activeToilState: ToilState.NotStarted,
      options: [
        {
          kind: 'eat',
          label: 'Eat',
          status: 'active',
          priority: 100,
          score: 120,
          failureReasonCode: 'none',
          failureReasonText: null,
          detail: 'meal_simple',
          jobDefId: 'job_eat',
          evaluatedAtTick: 12,
        },
      ],
    };
    map.objects.add(pawn);

    const snapshot = readEngineSnapshot(world, map, presentation, { recentEvents: [] });
    expect(snapshot.colonists[pawn.id].workDecision).toMatchObject({
      selectedWorkKind: 'eat',
      activeToilLabel: 'pickup',
    });
  });
});
```

```ts
// src/ui/domains/colonist/colonist.selectors.test.ts
it('builds work queue rows for the colonist inspector', () => {
  const vm = selectColonistInspector(
    makeSnapshot({
      colonists: {
        a: {
          id: 'a',
          name: 'Alice',
          cell: { x: 5, y: 10 },
          factionId: 'player',
          currentJob: 'job_eat',
          currentJobLabel: 'Eat',
          needs: { food: 20, rest: 80, joy: 80, mood: 60 },
          health: { hp: 80, maxHp: 100 },
          workDecision: {
            evaluatedAtTick: 12,
            selectedWorkKind: 'eat',
            selectedWorkLabel: 'Eat',
            activeToilLabel: 'pickup',
            activeToilState: 'not_started',
            options: [
              { kind: 'eat', label: 'Eat', status: 'active', detail: 'meal_simple', failureReasonText: null },
              { kind: 'construct', label: 'Construct', status: 'blocked', detail: null, failureReasonText: 'Materials not delivered' },
              { kind: 'haul_to_stockpile', label: 'Haul To Stockpile', status: 'deferred', detail: null, failureReasonText: null },
            ],
          },
        },
      },
      selection: { primaryId: 'a', selectedIds: ['a'] },
    }),
    makeUiState(),
  );

  expect(vm?.workQueue).toEqual([
    { label: 'Eat', tone: 'active', detail: 'pickup (not_started)' },
    { label: 'Construct', tone: 'blocked', detail: 'Materials not delivered' },
    { label: 'Haul To Stockpile', tone: 'deferred', detail: null },
  ]);
});
```

- [ ] **Step 2: 运行测试，确认 UI 读模型字段目前缺失**

Run: `npm test -- src/ui/kernel/snapshot-reader.test.ts src/ui/domains/colonist/colonist.selectors.test.ts`

Expected: `FAIL`，主要因为 `ColonistNode.workDecision`、`ColonistInspectorViewModel.workQueue` 和对应映射逻辑还不存在。

- [ ] **Step 3: 实现 snapshot projection 和 selector view model**

```ts
// src/ui/kernel/ui-types.ts
export interface ColonistWorkDecisionOptionNode {
  kind: string;
  label: string;
  status: 'active' | 'blocked' | 'deferred';
  detail: string | null;
  failureReasonText: string | null;
}

export interface ColonistWorkDecisionNode {
  evaluatedAtTick: number;
  selectedWorkKind: string | null;
  selectedWorkLabel: string | null;
  activeToilLabel: string | null;
  activeToilState: string | null;
  options: ColonistWorkDecisionOptionNode[];
}

export interface ColonistNode {
  id: string;
  name: string;
  cell: { x: number; y: number };
  factionId: string;
  currentJob: string;
  currentJobLabel: string;
  needs: { food: number; rest: number; joy: number; mood: number };
  health: { hp: number; maxHp: number };
  workDecision: ColonistWorkDecisionNode | null;
}
```

```ts
// src/ui/kernel/snapshot-reader.ts
workDecision: pawn.ai.workDecision ? {
  evaluatedAtTick: pawn.ai.workDecision.evaluatedAtTick,
  selectedWorkKind: pawn.ai.workDecision.selectedWorkKind,
  selectedWorkLabel: pawn.ai.workDecision.selectedWorkLabel,
  activeToilLabel: pawn.ai.workDecision.activeToilLabel,
  activeToilState: pawn.ai.workDecision.activeToilState,
  options: pawn.ai.workDecision.options.map(option => ({
    kind: option.kind,
    label: option.label,
    status: option.status === 'available' ? 'deferred' : option.status,
    detail: option.detail,
    failureReasonText: option.failureReasonText,
  })),
} : null,
```

```ts
// src/ui/domains/colonist/colonist.types.ts
export interface WorkQueueRowViewModel {
  label: string;
  tone: 'active' | 'blocked' | 'deferred';
  detail: string | null;
}

export interface ColonistInspectorViewModel {
  id: string;
  name: string;
  cell: { x: number; y: number };
  factionId: string;
  jobLabel: string;
  health: { hp: number; maxHp: number };
  needs: NeedViewModel[];
  workQueue: WorkQueueRowViewModel[];
}
```

```ts
// src/ui/domains/colonist/colonist.selectors.ts
function buildWorkQueue(c: ColonistNode): WorkQueueRowViewModel[] {
  if (!c.workDecision) return [];

  return c.workDecision.options.map(option => {
    if (option.status === 'active') {
      const toilLabel = c.workDecision?.activeToilLabel ?? 'unknown';
      const toilState = c.workDecision?.activeToilState ?? 'unknown';
      return { label: option.label, tone: 'active', detail: `${toilLabel} (${toilState})` };
    }
    if (option.status === 'blocked') {
      return { label: option.label, tone: 'blocked', detail: option.failureReasonText };
    }
    return { label: option.label, tone: 'deferred', detail: null };
  });
}
```

- [ ] **Step 4: 重新运行测试，确认 UI 层已能读取 workDecision**

Run: `npm test -- src/ui/kernel/snapshot-reader.test.ts src/ui/domains/colonist/colonist.selectors.test.ts`

Expected: `PASS`，并且 selector 返回的 `workQueue` 顺序与 snapshot 中的冻结顺序一致。

- [ ] **Step 5: 提交 UI snapshot 与 selector 改动**

```bash
git add src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/kernel/snapshot-reader.test.ts src/ui/domains/colonist/colonist.types.ts src/ui/domains/colonist/colonist.selectors.ts src/ui/domains/colonist/colonist.selectors.test.ts
git commit -m "feat: project pawn work decisions into ui snapshot"
```

### Task 4: 在 Colonist Inspector 中渲染 Work Queue 和状态样式

**Files:**
- Modify: `src/ui/domains/colonist/components/colonist-inspector.tsx`
- Modify: `src/ui/domains/colonist/components/colonist-inspector.test.tsx`
- Modify: `src/ui/styles/app.css`

- [ ] **Step 1: 先写失败测试，锁定 Work Queue 的渲染行为**

```ts
import { render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, afterEach } from 'vitest';
import { ColonistInspector } from './colonist-inspector';
import type { ColonistInspectorViewModel } from '../colonist.types';

afterEach(cleanup);

function makeViewModel(overrides: Partial<ColonistInspectorViewModel> = {}): ColonistInspectorViewModel {
  return {
    id: 'pawn_1',
    name: 'Alice',
    cell: { x: 5, y: 10 },
    factionId: 'player',
    jobLabel: 'Eat',
    health: { hp: 80, maxHp: 100 },
    needs: [
      { key: 'food', label: 'Food', value: 62, color: '#cc8844' },
      { key: 'rest', label: 'Rest', value: 41, color: '#4488cc' },
    ],
    workQueue: [
      { label: 'Eat', tone: 'active', detail: 'pickup (not_started)' },
      { label: 'Construct', tone: 'blocked', detail: 'Materials not delivered' },
      { label: 'Haul To Stockpile', tone: 'deferred', detail: null },
    ],
    ...overrides,
  };
}

describe('ColonistInspector work queue', () => {
  it('renders active, blocked, and deferred work rows', () => {
    render(<ColonistInspector viewModel={makeViewModel()} />);

    expect(screen.getByText('Work Queue')).toBeInTheDocument();
    expect(screen.getByText('pickup (not_started)')).toBeInTheDocument();
    expect(screen.getByText('Materials not delivered')).toBeInTheDocument();
    expect(screen.getByText('Haul To Stockpile')).toBeInTheDocument();
  });

  it('renders an empty state when no decision snapshot is available', () => {
    render(<ColonistInspector viewModel={makeViewModel({ workQueue: [] })} />);
    expect(screen.getByText('No decision snapshot yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认组件还没有渲染工作队列**

Run: `npm test -- src/ui/domains/colonist/components/colonist-inspector.test.tsx`

Expected: `FAIL`，因为当前组件还没有 `Work Queue` 区块，也没有空状态文案。

- [ ] **Step 3: 最小实现组件与样式**

```tsx
// src/ui/domains/colonist/components/colonist-inspector.tsx
<Section title="Work Queue">
  {viewModel.workQueue.length === 0 ? (
    <div class="colonist-work-queue__empty">No decision snapshot yet</div>
  ) : (
    <ul class="colonist-work-queue">
      {viewModel.workQueue.map((row) => (
        <li key={`${row.label}-${row.tone}`} class={`colonist-work-queue__row is-${row.tone}`}>
          <div class="colonist-work-queue__label">{row.label}</div>
          {row.detail && <div class="colonist-work-queue__detail">{row.detail}</div>}
        </li>
      ))}
    </ul>
  )}
</Section>
```

```css
/* src/ui/styles/app.css */
.colonist-work-queue {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.colonist-work-queue__row {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.colonist-work-queue__row.is-active {
  background: rgba(67, 160, 71, 0.18);
  border-color: rgba(67, 160, 71, 0.45);
}

.colonist-work-queue__row.is-blocked {
  background: rgba(96, 96, 96, 0.22);
  border-color: rgba(180, 180, 180, 0.24);
}

.colonist-work-queue__row.is-deferred {
  background: rgba(52, 60, 72, 0.2);
  border-color: rgba(120, 132, 148, 0.16);
}

.colonist-work-queue__detail,
.colonist-work-queue__empty {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}
```

- [ ] **Step 4: 重新运行组件测试，确认 inspector 已正确显示工作队列**

Run: `npm test -- src/ui/domains/colonist/components/colonist-inspector.test.tsx`

Expected: `PASS`，并且 active、blocked、deferred 三类行都被渲染，空状态也可见。

- [ ] **Step 5: 提交 inspector 渲染与样式改动**

```bash
git add src/ui/domains/colonist/components/colonist-inspector.tsx src/ui/domains/colonist/components/colonist-inspector.test.tsx src/ui/styles/app.css
git commit -m "feat: show structured work queue in colonist inspector"
```

### Task 5: 做集中验证并清理回归

**Files:**
- Modify: `src/features/ai/job-selector.ts`
- Modify: `src/features/ai/work-types.ts`
- Modify: `src/features/ai/work-evaluators/index.ts`
- Modify: `src/features/ai/work-evaluators/needs.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/designation.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/construction.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/hauling.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/carrying.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/wander.evaluator.ts`
- Modify: `src/ui/kernel/snapshot-reader.ts`
- Modify: `src/ui/domains/colonist/colonist.selectors.ts`

- [ ] **Step 1: 运行新加的定向测试，确认新功能闭环**

Run: `npm test -- src/features/ai/job-selector.work-decision.test.ts src/features/ai/job-selector.work-reasons.test.ts src/ui/kernel/snapshot-reader.test.ts src/ui/domains/colonist/colonist.selectors.test.ts src/ui/domains/colonist/components/colonist-inspector.test.tsx`

Expected: 全部 `PASS`。

- [ ] **Step 2: 运行已有 AI 回归测试，确认结构化改造没有改变原行为**

Run: `npm test -- src/features/ai/job-selector.reachability.test.ts src/features/ai/job-selector.construction.test.ts src/features/ai/job-selector.carrying.test.ts src/features/ai/sleep.behavior.test.ts src/features/ai/reservation-lifecycle.test.ts`

Expected: 全部 `PASS`；若失败，优先修复 evaluator 排序、blocked reason 回写或 reservation 时机。

- [ ] **Step 3: 运行 headless 场景回归，确认 inspector 结构化数据没有破坏主要行为链**

Run: `npm run test:scenario -- src/testing/headless/eating.scenario.test.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts src/testing/headless/sleep-bed-occupancy.scenario.test.ts`

Expected: 全部 `PASS`，尤其关注吃饭、搬运、施工、睡觉四条链。

- [ ] **Step 4: 运行构建，确认类型与 UI 代码没有遗留问题**

Run: `npm run build`

Expected: `tsc && vite build` 成功，无 TypeScript 报错。

- [ ] **Step 5: 提交最终验证后的收尾改动**

```bash
git add src/features/ai/job-selector.ts src/features/ai/work-types.ts src/features/ai/work-evaluators src/ui/kernel/ui-types.ts src/ui/kernel/snapshot-reader.ts src/ui/domains/colonist src/ui/styles/app.css
git commit -m "feat: surface structured pawn work evaluation"
```
