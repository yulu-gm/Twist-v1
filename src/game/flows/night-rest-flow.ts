/**
 * 昼夜边界驱动的夜间归宿：有床小人切入 resting，天亮用自然完成流唤醒。
 */

import { transition, type BehaviorFSM } from "../behavior/behavior-state-machine";
import type { EntityRegistry } from "../entity/entity-registry";
import type { PawnId } from "../pawn-state";
import type { TimeEvent, TimeEventBus, Unsubscribe } from "../time/time-event-bus";
import { subscribe } from "../time/time-event-bus";

/**
 * 与 {@link DEFAULT_BEHAVIOR_TRANSITIONS} 中 `working → resting` 的 need-interrupt-rest 一致，
 * 确保夜间归宿可打断在办工作并入休息。
 */
export const NIGHT_REST_INTERRUPT_PRIORITY = 65;

/** 模块级 FSM 登记：与 {@link setupNightRestFlow} 的 `getFsm` 二选一或组合（优先 `getFsm`）。 */
const moduleFsmByPawn = new Map<PawnId, BehaviorFSM>();

export function registerNightRestFsm(fsm: BehaviorFSM): void {
  moduleFsmByPawn.set(fsm.pawnId, fsm);
}

export function unregisterNightRestFsm(pawnId: PawnId): void {
  moduleFsmByPawn.delete(pawnId);
}

export function clearNightRestFsmRegistry(): void {
  moduleFsmByPawn.clear();
}

function resolveFsm(
  pawnId: PawnId,
  getFsm: ((pawnId: PawnId) => BehaviorFSM | undefined) | undefined
): BehaviorFSM | undefined {
  const fromFn = getFsm?.(pawnId);
  if (fromFn !== undefined) {
    return fromFn;
  }
  return moduleFsmByPawn.get(pawnId);
}

export type NightRestFlowDeps = Readonly<{
  registry: EntityRegistry;
  /** 若省略则仅使用 {@link registerNightRestFsm} 登记的模块 Map */
  getFsm?: (pawnId: PawnId) => BehaviorFSM | undefined;
}>;

function handleNightStart(deps: NightRestFlowDeps): void {
  const { registry, getFsm } = deps;
  for (const e of registry.getByKind("pawn")) {
    if (e.kind !== "pawn" || e.bedBuildingId === undefined) {
      continue;
    }
    const fsm = resolveFsm(e.id, getFsm);
    if (!fsm || fsm.currentState === "resting") {
      continue;
    }
    transition(fsm, "resting", { interruptPriority: NIGHT_REST_INTERRUPT_PRIORITY });
  }
}

function handleDayStart(deps: NightRestFlowDeps): void {
  const { registry, getFsm } = deps;
  for (const e of registry.getByKind("pawn")) {
    if (e.kind !== "pawn") {
      continue;
    }
    const fsm = resolveFsm(e.id, getFsm);
    if (!fsm || fsm.currentState !== "resting") {
      continue;
    }
    transition(fsm, "idle", { completeNatural: true });
  }
}

/**
 * 处理单条时间事件（便于测试直接调用，不经过总线）。
 */
export function applyNightRestTimeEvent(deps: NightRestFlowDeps, event: TimeEvent): void {
  if (event.kind === "night-start") {
    handleNightStart(deps);
    return;
  }
  if (event.kind === "day-start") {
    handleDayStart(deps);
  }
}

/**
 * 订阅 `TimeEventBus`：响应 `"night-start"` 与 `"day-start"`。
 */
export function setupNightRestFlow(bus: TimeEventBus, deps: NightRestFlowDeps): Unsubscribe {
  return subscribe(bus, (event) => {
    applyNightRestTimeEvent(deps, event);
  });
}
