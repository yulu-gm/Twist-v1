import type { GridCoord } from "../map/world-grid";
import type { PawnId } from "../pawn-state";
import { getByStatus, type WorkRegistry } from "../work/work-registry";
import type { WorkOrder } from "../work/work-types";
import type { WorldTimeSnapshot } from "../time/world-time";
import type { BehaviorState } from "./behavior-state-machine";

/** 小人决策用需求数值：越高表示越满足（饱和 / 精力充沛）。 */
export type PawnNeedState = Readonly<{
  satiety: number;
  energy: number;
}>;

/**
 * 从地图侧收集的可达性摘要（测试可传入固定对象）。
 * `reachableCellCount` 为可走格子数量等粗粒度指标，未知时可用 0。
 */
export type BehaviorMapSnapshot = Readonly<{
  foodReachable: boolean;
  bedReachable: boolean;
  reachableCellCount: number;
}>;

export type MapBehaviorQuery =
  | BehaviorMapSnapshot
  | Readonly<{ foodReachable: boolean; bedReachable: boolean }>
  | ((cell: GridCoord) => boolean);

function resolveMapSnapshot(query: MapBehaviorQuery): BehaviorMapSnapshot {
  if (typeof query === "function") {
    return { foodReachable: false, bedReachable: false, reachableCellCount: 0 };
  }
  const reachableCellCount =
    "reachableCellCount" in query && typeof query.reachableCellCount === "number"
      ? query.reachableCellCount
      : 0;
  return {
    foodReachable: query.foodReachable,
    bedReachable: query.bedReachable,
    reachableCellCount
  };
}

/**
 * 单周期行为决策输入：自身状态、需求、候选工单、时间与地图可达摘要。
 */
export type BehaviorContext = Readonly<{
  pawnId: PawnId;
  behaviorState?: BehaviorState;
  needState: PawnNeedState;
  candidateWorks: readonly WorkOrder[];
  time: Readonly<{
    currentPeriod: WorldTimeSnapshot["currentPeriod"];
    minuteOfDay: number;
  }>;
  map: BehaviorMapSnapshot;
  /** 当 `mapQuery` 为谓词时保留，供后续按格查询；对象查询时为 `undefined`。 */
  mapCellQuery?: (cell: GridCoord) => boolean;
}>;

export function aggregateBehaviorContext(
  pawnId: PawnId,
  needState: PawnNeedState,
  workRegistry: WorkRegistry,
  timeSnapshot: WorldTimeSnapshot,
  mapQuery: MapBehaviorQuery
): BehaviorContext {
  const candidateWorks = getByStatus(workRegistry, "open");
  const map = resolveMapSnapshot(mapQuery);
  return {
    pawnId,
    behaviorState: "idle" satisfies BehaviorState,
    needState,
    candidateWorks,
    time: {
      currentPeriod: timeSnapshot.currentPeriod,
      minuteOfDay: timeSnapshot.minuteOfDay
    },
    map,
    mapCellQuery: typeof mapQuery === "function" ? mapQuery : undefined
  };
}
