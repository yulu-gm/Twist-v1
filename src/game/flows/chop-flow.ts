/**
 * 伐木链路纯编排：串联工作生成/认领/结算与实体放下，不内联树木转化、拾取实现逻辑。
 */

import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId, PawnEntity, TreeEntity, ZoneEntity } from "../entity/entity-types";
import { dropResource } from "../entity/lifecycle-rules";
import type { GridCoord } from "../map/world-grid";
import { addWork, type WorkRegistry } from "../work/work-registry";
import { generateChopWork, generateHaulWork } from "../work/work-generator";
import { claimWork, type ClaimResult } from "../work/work-scheduler";
import { settleWorkSuccess, type SettleResult } from "../work/work-settler";

export type ChopFlowOptions = Readonly<{
  /** 若不传则根据树位生成伐木工单并登记（若同 id 已存在则覆盖为生成器产出的结构） */
  chopWorkId?: string;
  /** 若提供则在拾取后追加搬运工单，`haulDropCell` 默认取区内第一格 */
  storageZone?: ZoneEntity;
  haulDropCell?: GridCoord;
}>;

export type ChopFlowFailure =
  | { kind: "tree-not-found"; treeId: EntityId }
  | { kind: "tree-kind-mismatch"; treeId: EntityId }
  | { kind: "pawn-not-found"; pawnId: EntityId }
  | { kind: "pawn-kind-mismatch"; pawnId: EntityId }
  | { kind: "chop-claim-failed"; workId: string; claim: ClaimResult }
  | { kind: "chop-settle-failed"; workId: string; settle: SettleResult }
  | { kind: "chop-missing-pickup-derivation"; workId: string }
  | { kind: "pickup-claim-failed"; workId: string; claim: ClaimResult }
  | { kind: "pickup-settle-failed"; workId: string; settle: SettleResult }
  | { kind: "ground-drop-failed"; outcome: Exclude<ReturnType<typeof dropResource>, { kind: "ok" }> }
  | { kind: "haul-claim-failed"; workId: string; claim: ClaimResult }
  | { kind: "haul-settle-failed"; workId: string; settle: SettleResult }
  | { kind: "storage-zone-empty-cells"; zoneId: EntityId }
  | { kind: "wood-missing-after-flow"; woodResourceId: EntityId }
  | { kind: "invalid-derived-pickup-order"; pickWorkId: string };

export type ChopFlowSuccess = Readonly<{
  kind: "ok";
  woodResourceId: EntityId;
  /** 木头最终落点（地面格） */
  finalCell: GridCoord;
}>;

export type ChopFlowResult = ChopFlowSuccess | ChopFlowFailure;

function asPawn(entityRegistry: EntityRegistry, pawnId: EntityId): PawnEntity | undefined {
  const p = entityRegistry.get(pawnId);
  if (!p || p.kind !== "pawn") return undefined;
  return p;
}

function ensureTreeMarkedForLogging(entityRegistry: EntityRegistry, tree: TreeEntity): void {
  if (tree.loggingMarked) return;
  entityRegistry.replace({
    ...tree,
    cell: { col: tree.cell.col, row: tree.cell.row },
    loggingMarked: true
  });
}

function ensurePawnAtCell(entityRegistry: EntityRegistry, pawn: PawnEntity, cell: GridCoord): void {
  if (pawn.cell.col === cell.col && pawn.cell.row === cell.row) return;
  entityRegistry.replace({
    ...pawn,
    cell: { col: cell.col, row: cell.row }
  });
}

/**
 * 端到端编排：伐木认领并结算（树木→地面木头+拾取工单）→ 认领并结算拾取 → 无存储区则原地放下 / 有存储区则生成搬运并卸货到 `haulDropCell`。
 */
export function runChopFlowScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  treeId: EntityId,
  pawnId: EntityId,
  options: ChopFlowOptions = {}
): ChopFlowResult {
  const treeEntity = entityRegistry.get(treeId);
  if (!treeEntity) return { kind: "tree-not-found", treeId };
  if (treeEntity.kind !== "tree") return { kind: "tree-kind-mismatch", treeId };

  const tree = treeEntity as TreeEntity;
  const treeCell: GridCoord = { col: tree.cell.col, row: tree.cell.row };

  const pawn0 = asPawn(entityRegistry, pawnId);
  if (!pawn0) return { kind: "pawn-not-found", pawnId };

  ensureTreeMarkedForLogging(entityRegistry, tree);

  const chopOrder = generateChopWork(tree.id, treeCell);
  const chopWorkId = options.chopWorkId ?? chopOrder.workId;
  addWork(workRegistry, { ...chopOrder, workId: chopWorkId });

  const chopClaim = claimWork(workRegistry, chopWorkId, pawnId);
  if (chopClaim.kind !== "claimed") {
    return { kind: "chop-claim-failed", workId: chopWorkId, claim: chopClaim };
  }

  const chopSettle = settleWorkSuccess(workRegistry, chopWorkId, entityRegistry);
  if (chopSettle.kind !== "ok") {
    return { kind: "chop-settle-failed", workId: chopWorkId, settle: chopSettle };
  }
  const pickWorkId = chopSettle.derivedPickUpWorkId;
  if (!pickWorkId) {
    return { kind: "chop-missing-pickup-derivation", workId: chopWorkId };
  }

  const pickOrder = workRegistry.orders.get(pickWorkId);
  const woodResourceId = (pickOrder?.targetEntityId ?? "") as EntityId;
  if (!pickOrder || pickOrder.kind !== "pick-up" || !woodResourceId) {
    return { kind: "invalid-derived-pickup-order", pickWorkId };
  }

  const pawnAfterChop = asPawn(entityRegistry, pawnId);
  if (!pawnAfterChop) return { kind: "pawn-not-found", pawnId };

  ensurePawnAtCell(entityRegistry, pawnAfterChop, treeCell);

  const pickClaim = claimWork(workRegistry, pickWorkId, pawnId);
  if (pickClaim.kind !== "claimed") {
    return { kind: "pickup-claim-failed", workId: pickWorkId, claim: pickClaim };
  }

  const pickSettle = settleWorkSuccess(workRegistry, pickWorkId, entityRegistry);
  if (pickSettle.kind !== "ok") {
    return { kind: "pickup-settle-failed", workId: pickWorkId, settle: pickSettle };
  }

  const zone = options.storageZone;
  if (!zone) {
    const drop = dropResource(entityRegistry, pawnId, treeCell);
    if (drop.kind !== "ok") {
      return { kind: "ground-drop-failed", outcome: drop };
    }
    const wood = entityRegistry.get(woodResourceId);
    if (!wood || wood.kind !== "resource") {
      return { kind: "wood-missing-after-flow", woodResourceId };
    }
    return {
      kind: "ok",
      woodResourceId,
      finalCell: { col: wood.cell.col, row: wood.cell.row }
    };
  }

  if (zone.coveredCells.length === 0) {
    return { kind: "storage-zone-empty-cells", zoneId: zone.id };
  }

  const dropCell: GridCoord = options.haulDropCell
    ? { col: options.haulDropCell.col, row: options.haulDropCell.row }
    : { col: zone.coveredCells[0].col, row: zone.coveredCells[0].row };

  const pawnCarrying = asPawn(entityRegistry, pawnId);
  if (!pawnCarrying) return { kind: "pawn-not-found", pawnId };

  const haul = generateHaulWork(woodResourceId, pawnCarrying.cell, zone.id, dropCell);
  addWork(workRegistry, haul);

  const haulClaim = claimWork(workRegistry, haul.workId, pawnId);
  if (haulClaim.kind !== "claimed") {
    return { kind: "haul-claim-failed", workId: haul.workId, claim: haulClaim };
  }

  const haulSettle = settleWorkSuccess(workRegistry, haul.workId, entityRegistry);
  if (haulSettle.kind !== "ok") {
    return { kind: "haul-settle-failed", workId: haul.workId, settle: haulSettle };
  }

  const wood = entityRegistry.get(woodResourceId);
  if (!wood || wood.kind !== "resource") {
    return { kind: "wood-missing-after-flow", woodResourceId };
  }

  return {
    kind: "ok",
    woodResourceId,
    finalCell: { col: wood.cell.col, row: wood.cell.row }
  };
}
