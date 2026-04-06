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
  type PawnSummary,
  type SimAssertion,
  type SimReport
} from "./sim-reporter";

export type {
  ScenarioDefinition,
  ScenarioExpectation,
  ScenarioPlayerSelectionAfterHydrate,
  ScenarioResourceSpawn,
  ScenarioTreeSpawn,
  ScenarioZoneSpawn
} from "./scenario-types";

export {
  hydrateScenario,
  runScenarioHeadless,
  type ScenarioHeadlessRunResult
} from "./scenario-runner";

export {
  allWorkCompleted,
  anyPawnStartsGoal,
  assertEntityKindAbsent,
  assertEntityKindExists,
  assertEventOccurred,
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
