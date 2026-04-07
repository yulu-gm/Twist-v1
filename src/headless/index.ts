/**
 * Headless 模拟（无 Phaser）对外导出。
 */

export {
  createHeadlessSim,
  type HeadlessSim,
  type HeadlessSimOptions,
  type HeadlessSimRunUntilOptions,
  type HeadlessSimRunUntilResult
} from "./headless-sim";

export {
  createHeadlessSimAccess,
  type CreateHeadlessSimAccessOptions,
  type HeadlessGameOrchestratorSimAccess
} from "./headless-sim-access";

export {
  createSimEventCollector,
  type SimEvent,
  type SimEventCollector,
  type SimEventKind,
  type SimEventSummary
} from "./sim-event-log";

export {
  createEmptySimDebugTrace,
  diffWorkLifecycleEvents,
  formatSimDebugTrace,
  mapSimDebugTickToRuntimeLogEvents,
  snapshotWorkItem,
  snapshotWorkItems,
  type HeadlessDebugTraceOptions,
  type PawnDecisionTrace,
  type SimDebugTick,
  type SimDebugTrace,
  type WorkItemTraceSnapshot,
  type WorkLifecycleTraceEvent
} from "./sim-debug-trace";

export {
  generateReport,
  type AssertionResult,
  type HeadlessSimReportSource,
  type PawnSummary,
  type SimAssertion,
  type SimReport
} from "./sim-reporter";

export type {
  ScenarioDefinition,
  ScenarioExpectation,
  ScenarioPlayerInputSemantic,
  ScenarioPlayerInputShape,
  ScenarioPlayerSelectionAfterHydrate,
  ScenarioResourceSpawn,
  ScenarioTreeSpawn,
  ScenarioUiObservation,
  ScenarioWorldPortConfig,
  ScenarioZoneSpawn
} from "./scenario-types";

export {
  hydrateScenario,
  runScenarioHeadless,
  type ScenarioHeadlessRunResult
} from "./scenario-runner";

export {
  assertPlayerInputSemantic,
  assertVisibleFailureFeedback,
  assertVisibleHudTime,
  assertVisibleOwnership,
  assertVisibleWorkItemState,
  captureVisibleState,
  recordScenarioPlayerSelection,
  resolveScenarioPlayerInputSemantic,
  type ScenarioHydrationResult,
  type ScenarioPlayerSelectionRecord,
  type VisibleFeedbackSnapshot,
  type VisibleHudSnapshot,
  type VisibleOwnershipSnapshot,
  type VisibleStateSnapshot,
  type VisibleWorkItemSnapshot
} from "./scenario-observers";

export {
  allWorkCompleted,
  anyPawnStartsGoal,
  assertEntityKindAbsent,
  assertEntityKindExists,
  assertEventOccurred,
  assertEventSequence,
  assertNoPawnStarved,
  assertPawnAtCell,
  assertResourceInContainer,
  assertWorkItemCompleted,
  dayReaches,
  gameTimeReaches,
  pawnReachesCell,
  pawnStartsGoal,
  spawnDefaultColony
} from "./scenario-helpers";
