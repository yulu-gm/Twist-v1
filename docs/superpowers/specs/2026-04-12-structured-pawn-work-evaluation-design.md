# Structured Pawn Work Evaluation Design

## Goal

Make pawn work selection more structured and inspectable by introducing a unified work-evaluation layer that:

1. Represents each pawn's possible work as ordered abstract work units instead of ad hoc candidate functions.
2. Freezes the result of each job-selection pass as a decision snapshot.
3. Lets the pawn inspector display, in priority order:
   - which work categories were considered,
   - which ones were blocked and why,
   - which one was selected and is currently active,
   - which lower-priority entries were deferred.

## Approved Product Decisions

1. The new structure should be a formal simulation-level unit, not a UI-only wrapper over `pawn.ai.currentJob`.
2. The inspector should display a frozen snapshot of the last selection pass, not a continuously re-evaluated live ranking while a pawn is already executing a job.
3. The first version should show work categories, not every concrete target instance.

## Current Problem

`src/features/ai/job-selector.ts` currently behaves like a large orchestration function:

- it gathers candidates with several hard-coded scans,
- each branch computes score and availability in a different shape,
- the final selection path mixes evaluation, reservation failure, assignment, and fallback,
- the UI can only see the currently assigned `Job`, not the rejected or deferred alternatives.

This makes it hard to explain "why this pawn is doing this instead of something else" and makes the selector difficult to extend without growing the same file further.

## Design Overview

Keep the existing `Job` and `Toil` execution model intact, but insert a new work-evaluation layer before assignment.

The new flow becomes:

1. `job-selector` asks a fixed list of work evaluators to evaluate one pawn.
2. Each evaluator returns a unified work-evaluation result for one work category.
3. The selector orders those results by category priority and score.
4. The selector tries to assign from top to bottom.
5. The selector freezes the ranked list as a pawn-local decision snapshot.
6. The UI reads only the frozen snapshot and the currently active toil projection.

This separates:

- `Job`: real executable task with toils and reservations.
- `WorkOption`: abstract decision unit shown in the inspector.
- `PawnWorkDecisionSnapshot`: frozen explanation of one selection pass.

## Simulation Data Model

### `Job` stays execution-focused

The existing `Job` model remains the runtime execution unit:

- `toils`
- `currentToilIndex`
- `reservations`
- `state`

It should not become the place where the selector stores rejected alternatives or display-only diagnostics.

### New `WorkOption`

Introduce a unified abstract work unit for decision and display.

Recommended fields:

- `kind`: stable work category id such as `sleep`, `eat`, `designation_mine`, `designation_harvest`, `deliver_materials`, `construct`, `haul_to_stockpile`, `resolve_carrying`
- `label`: user-facing label for the category
- `status`: one of the decision statuses defined below
- `priority`: category priority used for ordering
- `score`: numeric score within that category
- `failureReasonCode`: stable code for blocked states
- `failureReasonText`: human-readable explanation for inspector display
- `detail`: optional short context such as a bed label, material id, or target summary
- `jobDefId`: the job type that would be assigned if selected
- `evaluatedAtTick`: tick number of the decision pass

### Decision status model

Use a small shared status vocabulary:

- `available`: evaluator found a valid option and it is eligible to be selected
- `blocked`: this category was checked but cannot currently be assigned; show reason
- `active`: this category was selected and is the current executing work; show current toil
- `deferred`: this category ranked below the selected work in the frozen snapshot; no extra explanation needed

`inactive` is intentionally omitted from v1 to keep the model smaller. Every displayed row should correspond to a category that took part in the last ranking pass.

### New `PawnWorkDecisionSnapshot`

Add a frozen decision snapshot under the pawn AI state.

Recommended fields:

- `evaluatedAtTick`
- `selectedWorkKind`
- `selectedWorkLabel`
- `selectedJobId`
- `activeToilLabel`
- `activeToilState`
- `options: WorkOption[]`

The snapshot should be replaced only when the pawn performs a new selection pass. It should not be re-ranked every tick while the pawn is busy executing the selected job.

## Evaluator Layer

### New `WorkEvaluator` interface

Move category-specific selection logic behind a uniform evaluator interface.

Each evaluator should define:

- `kind`
- `label`
- `priority`
- `evaluate(pawn, map, world): WorkEvaluation`

Each `WorkEvaluation` should answer the same questions:

1. Does this category currently have a valid option?
2. If not, why not?
3. If yes, what score should it receive?
4. If selected, how do we create the real `Job`?

Recommended output fields:

- `kind`
- `label`
- `priority`
- `score`
- `status`
- `failureReasonCode`
- `failureReasonText`
- `detail`
- `jobDefId`
- `createJob(): Job | null`

### Initial evaluator set

Keep the first evaluator list close to current behavior so the refactor preserves gameplay:

1. `EatWorkEvaluator`
2. `SleepWorkEvaluator`
3. `DesignationMineWorkEvaluator`
4. `DesignationHarvestWorkEvaluator`
5. `DeliverMaterialsWorkEvaluator`
6. `ConstructWorkEvaluator`
7. `HaulToStockpileWorkEvaluator`
8. `ResolveCarryingWorkEvaluator`

Each evaluator returns the best option for its category, not every possible concrete target.

## Refactored Selector Flow

`src/features/ai/job-selector.ts` should become orchestration code, not a giant rules file.

The selection pass for one idle pawn should do this:

1. Build evaluations by calling all registered evaluators in fixed order.
2. Sort by `priority` first and `score` second.
3. Iterate from top to bottom and try real assignment.
4. If a category can create a job but assignment fails during reservation, convert it to `blocked` with an explicit reason such as `target_reserved`.
5. Mark the first successfully assigned category as `active`.
6. Mark all lower-ranked categories as `deferred`.
7. Persist the frozen result as `PawnWorkDecisionSnapshot`.
8. If nothing can be assigned and wander fallback is used, either:
   - store a snapshot with no active structured work and leave wander as a fallback outside the list, or
   - include a low-priority `wander` category as a final evaluator.

Recommendation: include `wander` as a final evaluator in v1 so the snapshot always explains the actual chosen work, even when no productive work exists.

## Failure Reasons

Blocked rows only help if reasons are stable and meaningful. The simulation layer should own reason codes and messages instead of making the UI infer them.

Initial reasons should cover the current common failures:

- no target in this category
- target already reserved
- target unreachable
- no available bed
- materials not delivered
- no reachable material source
- no legal stockpile or drop destination
- current carried item blocks pickup-based work

Use stable reason codes for logic and snapshot compatibility, plus short messages for the inspector.

## UI Snapshot and Inspector

### Snapshot boundary

The frozen decision snapshot belongs in the colonist snapshot, not in `presentation`.

`presentation` is still only for transient UI bridge state. The decision snapshot is simulation-derived diagnostic state and should be read through `snapshot-reader`.

Add a `workDecision` projection under `ColonistNode` with:

- `evaluatedAtTick`
- `selectedWorkKind`
- `selectedWorkLabel`
- `activeToilLabel`
- `activeToilState`
- `options[]`

The UI should only receive display-ready data, not evaluator internals or mutable world references.

### Inspector presentation

Keep the current summary row for the current job, then add a dedicated `Work Queue` section.

Each row should render:

- work label
- status styling
- optional secondary text

Status behavior:

- `active`: green, show current toil label and toil state
- `blocked`: blocked gray, show failure reason
- `deferred`: deferred gray, no extra text

If no snapshot exists yet, render a small empty state such as `No decision snapshot yet`.

### Color semantics

Do not use one gray for everything.

- blocked gray means "this category was checked and failed now"
- deferred gray means "this category ranked below the selected work in the frozen decision"
- green means "this category is the selected active work"

This distinction is required so the panel communicates reasoning instead of a flat disabled list.

## File Shape

Recommended file decomposition:

- `src/features/ai/work-types.ts`
  - work option, work evaluation, reason code, and snapshot types
- `src/features/ai/work-evaluator.types.ts`
  - evaluator interface and shared context type
- `src/features/ai/work-evaluators/*`
  - one evaluator per category or tightly related categories
- `src/features/ai/job-selector.ts`
  - orchestration, sorting, assignment, snapshot freezing
- `src/ui/kernel/ui-types.ts`
  - snapshot projection types
- `src/ui/kernel/snapshot-reader.ts`
  - map pawn AI decision snapshot into immutable UI data
- `src/ui/domains/colonist/colonist.types.ts`
  - inspector view model types
- `src/ui/domains/colonist/colonist.selectors.ts`
  - derive display rows for the work queue
- `src/ui/domains/colonist/components/colonist-inspector.tsx`
  - render the new queue section
- `src/ui/styles/app.css`
  - distinct styles for active, blocked, and deferred rows

## Migration Strategy

### Phase 1: Add types and empty plumbing

- Add work-evaluation and decision-snapshot types.
- Extend pawn AI state to hold the frozen snapshot.
- Extend UI snapshot types and rendering to tolerate `null` decision data.

No selection behavior should change in this phase.

### Phase 2: Wrap current logic in evaluators

- Extract existing candidate logic into evaluator modules.
- Keep the scoring formulas and category order aligned with current behavior.
- Make `job-selector` consume evaluator results instead of directly gathering candidates.

This phase should preserve assignment results while changing structure.

### Phase 3: Add blocked reason coverage

- Surface explicit blocked reasons for the major failure paths.
- Convert reservation failures during final assignment into blocked rows.

This is the phase that gives the inspector explanatory power.

### Phase 4: Expose in snapshot and inspector

- Project the frozen snapshot through `snapshot-reader`.
- Build a `Work Queue` inspector view model.
- Render active, blocked, and deferred rows with distinct styles.

## Testing

### AI evaluator tests

Add focused tests for evaluator outputs:

- returns `available` when the category can produce a job
- returns `blocked` with the correct reason when it cannot
- preserves expected score ordering inputs
- reports correct category metadata and job type

### Selector integration tests

Add integration coverage around one full selection pass:

- evaluations are ordered by priority and score
- the selected category becomes `active`
- higher-ranked failed categories become `blocked`
- lower-ranked categories become `deferred`
- the assigned job remains behaviorally consistent with the pre-refactor selector

### UI selector and component tests

Add UI tests for:

- `snapshot-reader` projecting decision snapshots into colonist data
- colonist selectors mapping snapshot data into inspector rows
- inspector rendering active toil details
- inspector rendering blocked reasons
- inspector rendering deferred rows without extra text
- no-snapshot empty state

## Out of Scope

The first version should not:

- continuously re-rank while a pawn is already executing a job
- expose every concrete target instance per category
- redesign the `Job` or `Toil` execution model
- introduce a separate planner or scheduler subsystem
- turn the inspector into an interactive debug control surface

## Success Criteria

This design is successful when:

1. `job-selector` becomes an orchestration layer over evaluator units instead of a single large rules function.
2. Every idle pawn selection pass produces a frozen ranked decision snapshot.
3. The pawn inspector can show the selected active work, blocked higher-priority work with reasons, and deferred lower-priority work.
4. Gameplay behavior stays aligned with current work-selection rules unless intentionally changed by future follow-up work.
