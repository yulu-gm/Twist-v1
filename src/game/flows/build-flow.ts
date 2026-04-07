/**
 * 建造链路**同步**纯编排：蓝图放置 → 施工工单 → 认领 → **立即**结算（`transformBlueprintToBuilding`）→
 * 木床落成后对无床小人经建筑门面 `assignBedAfterConstruction` 分配床铺；墙体不做床铺分配。
 *
 * **定位**：供验收测试、场景脚本与集成编排使用；**不是**行为树/主循环驱动的游玩路径。
 * 真实游玩中应由行为层完成移动与读条进度后再回报 `settleWorkSuccess`，勿将本模块当作渐进施工的唯一实现。
 */

import type { EntityRegistry } from "../entity/entity-registry";
import type {
  AssignmentReason,
  BuildingEntity,
  BuildingKind,
  EntityId,
  PawnEntity
} from "../entity/entity-types";
import { DEFAULT_WORLD_GRID, type GridCoord, type WorldGridConfig } from "../map/world-grid";
import { assignBedAfterConstruction, type AssignBedOutcome } from "../building/bed-ownership-facade";
import { BUILDING_SPECS, type BuildingSpec } from "../building/building-spec-catalog";
import { validateBuildPlacementForBlueprint } from "../building/build-placement-validator";
import { createBlueprint } from "../building/blueprint-manager";
import { addWork, replaceWorkRegistryOrders, type WorkRegistry } from "../work/work-registry";
import { generateConstructWork, linkWorkOrderToTargetEntity } from "../work/work-generator";
import { claimWork, type ClaimResult } from "../work/work-scheduler";
import { settleWorkSuccess, type SettleResult } from "../work/work-settler";

export type BuildFlowKind = "bed" | "wall";

export type BuildFlowOptions = Readonly<{
  /**
   * 若不传则按生成器默认 `workId`。
   * @internal 仅供测试/场景固定工单 ID；生产编排勿依赖。
   */
  constructWorkId?: string;
  /** 地图边界与 `blockedCellKeys`；不传则用 {@link DEFAULT_WORLD_GRID}，供放置校验（对齐设计「来自地图系统的空间合法性」）。 */
  gridConfig?: WorldGridConfig;
}>;

export type BuildFlowFailure =
  | { kind: "spec-missing"; flowKind: BuildFlowKind }
  | {
      kind: "placement-rejected";
      reason: "out-of-bounds" | "blocked-terrain" | "cell-occupied";
      cell: GridCoord;
      blockingEntityId?: EntityId;
    }
  | { kind: "pawn-not-found"; pawnId: EntityId }
  | { kind: "pawn-kind-mismatch"; pawnId: EntityId }
  | { kind: "claim-failed"; workId: string; claim: ClaimResult }
  | { kind: "settle-failed"; workId: string; settle: SettleResult }
  | { kind: "building-not-found-after-settle"; anchor: GridCoord; buildingKind: BuildingKind }
  | { kind: "no-pawn-without-bed" }
  | { kind: "bed-assign-failed"; outcome: Exclude<AssignBedOutcome, { kind: "ok" }> };

export type BuildFlowSuccess = Readonly<{
  kind: "ok";
  buildingId: EntityId;
  workId: string;
  /** 仅 `bed` 流程在成功分配后填写 */
  assignedPawnId?: EntityId;
  /**
   * 仅 `bed` 且自动分床成功时填写，与建筑 `ownership.assignmentReason` 一致（便于 UI / 手动调整追溯）。
   */
  bedAssignmentReason?: Extract<AssignmentReason, "auto-after-construction">;
}>;

export type BuildFlowResult = BuildFlowSuccess | BuildFlowFailure;

function specForFlowKind(flowKind: BuildFlowKind): BuildingSpec | undefined {
  return flowKind === "bed" ? BUILDING_SPECS.bed : BUILDING_SPECS.wall;
}

function findBuildingAtCell(
  registry: EntityRegistry,
  cell: GridCoord,
  buildingKind: BuildingKind
): BuildingEntity | undefined {
  for (const e of registry.getByCell(cell)) {
    if (e.kind === "building" && e.buildingKind === buildingKind) {
      return e as BuildingEntity;
    }
  }
  return undefined;
}

function pickPawnWithoutBed(registry: EntityRegistry, preferredPawnId: EntityId): PawnEntity | undefined {
  const preferred = registry.get(preferredPawnId);
  if (preferred?.kind === "pawn") {
    const p = preferred as PawnEntity;
    if (p.bedBuildingId === undefined) return p;
  }
  const candidates: PawnEntity[] = [];
  for (const e of registry.getByKind("pawn")) {
    const p = e as PawnEntity;
    if (p.bedBuildingId === undefined) candidates.push(p);
  }
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  return candidates[0];
}

/**
 * 统一入口：`bed` 在结算成功后为一名无床小人分配该床；`wall` 仅落成建筑。
 * 见文件头说明：同步测试/编排用途，非行为树渐进施工主链路。
 */
export function runBuildFlowScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  flowKind: BuildFlowKind,
  anchor: GridCoord,
  pawnId: EntityId,
  options: BuildFlowOptions = {}
): BuildFlowResult {
  let wr = workRegistry;
  try {
    const spec = specForFlowKind(flowKind);
    if (!spec) return { kind: "spec-missing", flowKind };

    const pawn0 = entityRegistry.get(pawnId);
    if (!pawn0) return { kind: "pawn-not-found", pawnId };
    if (pawn0.kind !== "pawn") return { kind: "pawn-kind-mismatch", pawnId };

    const gridConfig = options.gridConfig ?? DEFAULT_WORLD_GRID;
    const placement = validateBuildPlacementForBlueprint(entityRegistry, spec, anchor, gridConfig);
    if (!placement.ok) {
      return {
        kind: "placement-rejected",
        reason: placement.reason,
        cell: placement.cell,
        blockingEntityId: placement.blockingEntityId
      };
    }

    const blueprint = createBlueprint(entityRegistry, spec, { anchor: { col: anchor.col, row: anchor.row } });
    const constructOrder = generateConstructWork(blueprint.id, blueprint.cell);
    const workId = options.constructWorkId ?? constructOrder.workId;
    const orderToRegister = { ...constructOrder, workId };
    linkWorkOrderToTargetEntity(orderToRegister, (targetId, wid) => {
      const e = entityRegistry.get(targetId as EntityId);
      if (!e || e.kind !== "blueprint") return;
      if (e.relatedWorkItemIds.includes(wid)) return;
      entityRegistry.replace({
        ...e,
        relatedWorkItemIds: [...e.relatedWorkItemIds, wid]
      });
    });
    addWork(wr, orderToRegister);

    const claimOut = claimWork(wr, workId, pawnId);
    wr = claimOut.registry;
    if (claimOut.outcome.kind !== "claimed") {
      return { kind: "claim-failed", workId, claim: claimOut.outcome };
    }

    const settle = settleWorkSuccess(wr, workId, entityRegistry);
    if (settle.kind !== "ok") {
      return { kind: "settle-failed", workId, settle };
    }

    const building = findBuildingAtCell(entityRegistry, anchor, spec.buildingKind);
    if (!building) {
      return { kind: "building-not-found-after-settle", anchor: { ...anchor }, buildingKind: spec.buildingKind };
    }

    if (flowKind !== "bed") {
      return { kind: "ok", buildingId: building.id, workId };
    }

    const assignee = pickPawnWithoutBed(entityRegistry, pawnId);
    if (!assignee) {
      return { kind: "no-pawn-without-bed" };
    }

    const assignOut = assignBedAfterConstruction(entityRegistry, building.id, assignee.id);
    if (assignOut.kind !== "ok") {
      return { kind: "bed-assign-failed", outcome: assignOut };
    }

    return {
      kind: "ok",
      buildingId: building.id,
      workId,
      assignedPawnId: assignee.id,
      bedAssignmentReason: "auto-after-construction"
    };
  } finally {
    replaceWorkRegistryOrders(workRegistry, wr);
  }
}

/** {@link runBuildFlowScenario} 的 `bed` 便捷封装；定位同文件头。 */
export function runBuildBedScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  anchor: GridCoord,
  pawnId: EntityId,
  options?: BuildFlowOptions
): BuildFlowResult {
  return runBuildFlowScenario(entityRegistry, workRegistry, "bed", anchor, pawnId, options);
}

/** {@link runBuildFlowScenario} 的 `wall` 便捷封装；定位同文件头。 */
export function runBuildWallScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  anchor: GridCoord,
  pawnId: EntityId,
  options?: BuildFlowOptions
): BuildFlowResult {
  return runBuildFlowScenario(entityRegistry, workRegistry, "wall", anchor, pawnId, options);
}
