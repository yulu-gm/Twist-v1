import type { GridCoord } from "../map/world-grid";
import type { PawnId } from "../pawn-state";
import { getByStatus, sortWorkOrdersByPriorityDesc, type WorkRegistry } from "../work/work-registry";
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
  /** 上层已解析到的食物实体 id；有值时 eat 行动候选应携带同名 targetId。 */
  foodTargetId?: string;
  /** 上层已解析到的床铺实体 id；有值时 rest 行动候选应携带同名 targetId。 */
  bedTargetId?: string;
}>;

/** 规范构造 {@link BehaviorMapSnapshot}，集中处理可选 `reachableCellCount` 与资源目标 id。 */
export function buildBehaviorMapSnapshot(
  foodReachable: boolean,
  bedReachable: boolean,
  options?: Readonly<{
    reachableCellCount?: number;
    foodTargetId?: string;
    bedTargetId?: string;
  }>
): BehaviorMapSnapshot {
  const reachableCellCount = options?.reachableCellCount ?? 0;
  return {
    foodReachable,
    bedReachable,
    reachableCellCount,
    ...(options?.foodTargetId !== undefined && options.foodTargetId !== ""
      ? { foodTargetId: options.foodTargetId }
      : {}),
    ...(options?.bedTargetId !== undefined && options.bedTargetId !== ""
      ? { bedTargetId: options.bedTargetId }
      : {})
  };
}

/**
 * 仅含 `foodReachable` / `bedReachable` 的历史形态，其余字段在聚合时按缺省处理。
 *
 * @deprecated 请改用 {@link BehaviorMapSnapshot} 或 {@link buildBehaviorMapSnapshot}。
 */
export type LegacyNarrowMapBehaviorQuery = Readonly<{
  foodReachable: boolean;
  bedReachable: boolean;
}>;

/**
 * 松散对象查询（可选 reachable 与资源目标 id）。新代码优先 {@link buildBehaviorMapSnapshot}。
 */
export type MapBehaviorQueryObject = Readonly<{
  foodReachable: boolean;
  bedReachable: boolean;
  reachableCellCount?: number;
  foodTargetId?: string;
  bedTargetId?: string;
}>;

/**
 * - {@link BehaviorMapSnapshot} / {@link buildBehaviorMapSnapshot}：推荐；
 * - {@link LegacyNarrowMapBehaviorQuery}、{@link MapBehaviorQueryObject}：兼容字面量；
 * - 函数：按格可达谓词，聚合器写入 `mapCellQuery` 且摘要为保守默认；评分见 `action-scorer` 与 `mapCellQuery` 的配合。
 */
export type MapBehaviorQuery =
  | BehaviorMapSnapshot
  | LegacyNarrowMapBehaviorQuery
  | MapBehaviorQueryObject
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
    reachableCellCount,
    ...("foodTargetId" in query && typeof query.foodTargetId === "string" && query.foodTargetId !== ""
      ? { foodTargetId: query.foodTargetId }
      : {}),
    ...("bedTargetId" in query && typeof query.bedTargetId === "string" && query.bedTargetId !== ""
      ? { bedTargetId: query.bedTargetId }
      : {})
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
  /** 小人当前站位；提供时工单评分对 `WorkOrder.targetCell` 施加距离衰减（与 #0026 字段协同）。 */
  pawnCell?: GridCoord;
}>;

/**
 * 行为决策用的工单候选：开放单 + 已由 `pawnId` 认领的执行中单。
 * 与 `oh-code-design/工作系统.yaml`「工作调度层」为小人提供候选、管理领取的语义对齐；合并去重后按优先级排序。
 */
export function collectBehaviorCandidateWorks(
  workRegistry: WorkRegistry,
  pawnId: PawnId
): readonly WorkOrder[] {
  const open = getByStatus(workRegistry, "open");
  const claimedByPawn: WorkOrder[] = [];
  for (const o of workRegistry.orders.values()) {
    if (o.status === "claimed" && o.claimedByPawnId === pawnId) {
      claimedByPawn.push(o);
    }
  }
  const byId = new Map<string, WorkOrder>();
  for (const w of open) {
    byId.set(w.workId, w);
  }
  for (const w of claimedByPawn) {
    byId.set(w.workId, w);
  }
  return sortWorkOrdersByPriorityDesc([...byId.values()]);
}

export function aggregateBehaviorContext(
  pawnId: PawnId,
  needState: PawnNeedState,
  workRegistry: WorkRegistry,
  timeSnapshot: WorldTimeSnapshot,
  mapQuery: MapBehaviorQuery,
  extras?: Readonly<{ pawnCell?: GridCoord }>
): BehaviorContext {
  const candidateWorks = collectBehaviorCandidateWorks(workRegistry, pawnId);
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
    mapCellQuery: typeof mapQuery === "function" ? mapQuery : undefined,
    ...(extras?.pawnCell !== undefined ? { pawnCell: extras.pawnCell } : {})
  };
}
