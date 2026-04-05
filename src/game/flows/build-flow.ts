/**
 * 建造链路纯编排：蓝图放置 → 施工工单 → 认领 → 结算（`transformBlueprintToBuilding`）→
 * 木床落成后对无床小人做 `assignBedToPawn`；墙体不做床铺分配。
 */

import { assignBedToPawn } from "../entity/relationship-rules";
import type { EntityRegistry } from "../entity/entity-registry";
import type { BuildingEntity, BuildingKind, EntityId, PawnEntity } from "../entity/entity-types";
import type { GridCoord } from "../map/world-grid";
import { BUILDING_SPECS, type BuildingSpec } from "../building/building-spec-catalog";
import { createBlueprint } from "../building/blueprint-manager";
import { addWork, type WorkRegistry } from "../work/work-registry";
import { generateConstructWork } from "../work/work-generator";
import { claimWork, type ClaimResult } from "../work/work-scheduler";
import { settleWorkSuccess, type SettleResult } from "../work/work-settler";

export type BuildFlowKind = "bed" | "wall";

export type BuildFlowOptions = Readonly<{
  /** 若不传则按生成器默认 `workId` */
  constructWorkId?: string;
}>;

export type BuildFlowFailure =
  | { kind: "spec-missing"; flowKind: BuildFlowKind }
  | { kind: "pawn-not-found"; pawnId: EntityId }
  | { kind: "pawn-kind-mismatch"; pawnId: EntityId }
  | { kind: "claim-failed"; workId: string; claim: ClaimResult }
  | { kind: "settle-failed"; workId: string; settle: SettleResult }
  | { kind: "building-not-found-after-settle"; anchor: GridCoord; buildingKind: BuildingKind }
  | { kind: "no-pawn-without-bed" }
  | { kind: "bed-assign-failed"; outcome: Exclude<ReturnType<typeof assignBedToPawn>, { kind: "ok" }> };

export type BuildFlowSuccess = Readonly<{
  kind: "ok";
  buildingId: EntityId;
  workId: string;
  /** 仅 `bed` 流程在成功分配后填写 */
  assignedPawnId?: EntityId;
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
 */
export function runBuildFlowScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  flowKind: BuildFlowKind,
  anchor: GridCoord,
  pawnId: EntityId,
  options: BuildFlowOptions = {}
): BuildFlowResult {
  const spec = specForFlowKind(flowKind);
  if (!spec) return { kind: "spec-missing", flowKind };

  const pawn0 = entityRegistry.get(pawnId);
  if (!pawn0) return { kind: "pawn-not-found", pawnId };
  if (pawn0.kind !== "pawn") return { kind: "pawn-kind-mismatch", pawnId };

  const blueprint = createBlueprint(entityRegistry, spec, { anchor: { col: anchor.col, row: anchor.row } });
  const constructOrder = generateConstructWork(blueprint.id, blueprint.cell);
  const workId = options.constructWorkId ?? constructOrder.workId;
  addWork(workRegistry, { ...constructOrder, workId });

  const claim = claimWork(workRegistry, workId, pawnId);
  if (claim.kind !== "claimed") {
    return { kind: "claim-failed", workId, claim };
  }

  const settle = settleWorkSuccess(workRegistry, workId, entityRegistry);
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

  const assignOut = assignBedToPawn(entityRegistry, building.id, assignee.id);
  if (assignOut.kind !== "ok") {
    return { kind: "bed-assign-failed", outcome: assignOut };
  }

  return { kind: "ok", buildingId: building.id, workId, assignedPawnId: assignee.id };
}

export function runBuildBedScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  anchor: GridCoord,
  pawnId: EntityId,
  options?: BuildFlowOptions
): BuildFlowResult {
  return runBuildFlowScenario(entityRegistry, workRegistry, "bed", anchor, pawnId, options);
}

export function runBuildWallScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  anchor: GridCoord,
  pawnId: EntityId,
  options?: BuildFlowOptions
): BuildFlowResult {
  return runBuildFlowScenario(entityRegistry, workRegistry, "wall", anchor, pawnId, options);
}
