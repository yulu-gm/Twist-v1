/**
 * 昼夜边界驱动的夜间归宿：有床小人切入 resting，天亮用自然完成流唤醒。
 *
 * 设计对齐（AP-0096）：`night-start` 边界切换与需求侧「疲劳阈值→寻床/移动」为叠加关系；
 * 本模块仅作入夜保底（有床则切入 resting），不重复疲劳判定；主动寻床路径由行为与需求管线负责。
 */

import { transition, type BehaviorFSM } from "../behavior/behavior-state-machine";
import type { EntityRegistry } from "../entity/entity-registry";
import type { PawnId } from "../pawn-state";
import type { TimeEvent, TimeEventBus, Unsubscribe } from "../time/time-event-bus";
import { subscribe } from "../time/time-event-bus";
import type { WorldCore } from "../world-core-types";

/**
 * 与 {@link DEFAULT_BEHAVIOR_TRANSITIONS} 中 `working → resting` 的 need-interrupt-rest 一致，
 * 确保夜间归宿可打断在办工作并入休息。
 */
export const NIGHT_REST_INTERRUPT_PRIORITY = 65;

/**
 * `registry` 与 `getWorld` 二选一：
 * - `registry`：测试/实体域，`pawn.bedBuildingId` 判定是否有床；
 * - `getWorld`：主循环 {@link WorldCore}，`restSpots[].ownerPawnId` 判定（与 `assignUnownedBeds` 一致）。
 */
export type NightRestFlowDeps = Readonly<{
  registry?: Pick<EntityRegistry, "getByKind">;
  getWorld?: () => WorldCore;
  /** 按小人解析行为 FSM；未提供则无法对任何小人做昼夜归宿切换 */
  getFsm?: (pawnId: PawnId) => BehaviorFSM | undefined;
}>;

function assertNightRestDeps(deps: NightRestFlowDeps): void {
  const hasRegistry = deps.registry !== undefined;
  const hasWorld = deps.getWorld !== undefined;
  if (hasRegistry === hasWorld) {
    throw new Error("night-rest-flow: provide exactly one of registry or getWorld");
  }
}

function pawnIdsWithBedFromWorld(world: WorldCore): ReadonlySet<PawnId> {
  const ids = new Set<PawnId>();
  for (const spot of world.restSpots) {
    if (spot.ownerPawnId !== undefined) {
      ids.add(spot.ownerPawnId);
    }
  }
  return ids;
}

function handleNightStart(deps: NightRestFlowDeps): void {
  const { getFsm } = deps;
  if (deps.registry) {
    for (const e of deps.registry.getByKind("pawn")) {
      if (e.kind !== "pawn" || e.bedBuildingId === undefined) {
        continue;
      }
      const fsm = getFsm?.(e.id);
      if (!fsm || fsm.currentState === "resting") {
        continue;
      }
      transition(fsm, "resting", { interruptPriority: NIGHT_REST_INTERRUPT_PRIORITY });
    }
    return;
  }
  const world = deps.getWorld!();
  const withBed = pawnIdsWithBedFromWorld(world);
  for (const e of world.entities.values()) {
    if (e.kind !== "pawn" || !withBed.has(e.id)) {
      continue;
    }
    const fsm = getFsm?.(e.id);
    if (!fsm || fsm.currentState === "resting") {
      continue;
    }
    transition(fsm, "resting", { interruptPriority: NIGHT_REST_INTERRUPT_PRIORITY });
  }
}

function handleDayStart(deps: NightRestFlowDeps): void {
  const { getFsm } = deps;
  if (deps.registry) {
    for (const e of deps.registry.getByKind("pawn")) {
      if (e.kind !== "pawn") {
        continue;
      }
      const fsm = getFsm?.(e.id);
      if (!fsm || fsm.currentState !== "resting") {
        continue;
      }
      transition(fsm, "idle", { completeNatural: true });
    }
    return;
  }
  const world = deps.getWorld!();
  for (const e of world.entities.values()) {
    if (e.kind !== "pawn") {
      continue;
    }
    const fsm = getFsm?.(e.id);
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
  assertNightRestDeps(deps);
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
