/**
 * 伐木链路纯编排：串联工作生成/认领/结算与实体放下，不内联树木转化、拾取实现逻辑。
 * `loggingMarked` 须由交互/领域层在调用前写入，本层不补标。
 *
 * **场景边界**：`runChopFlowScenario` 面向集成测试、快进与脚本化验收，通过注册表直接改写小人
 * `cell` 以满足认领前置，**不是**生产游玩路径里由行为/移动系统驱动的走位。生产路径应由移动
 * 与工单认领前置条件达成一致，勿依赖本文件的「瞬移」式占位。
 *
 * **树木→木头与占用**：策划/实体设计中的「同格去树、落地木头、与工作结果同步」在伐木工单成功结算时由
 * `settleWorkSuccess`（`work-settler` 的 `chop` 分支）调用 `transformTreeToResource`（`lifecycle-rules`）
 * 完成，含格上地面资源冲突校验；本编排层只串联认领/结算与后续拾取、搬运，不重复该转换。
 */

import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId, PawnEntity, TreeEntity, ZoneEntity } from "../entity/entity-types";
import { dropResource } from "../entity/lifecycle-rules";
import type { GridCoord } from "../map/world-grid";
import { addWork, replaceWorkRegistryOrders, type WorkRegistry } from "../work/work-registry";
import type { WorkOrder } from "../work/work-types";
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
  | { kind: "tree-not-marked-for-logging"; treeId: EntityId }
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

/** 仅测试/快进编排：将小人格对齐到目标，非行为系统移动。 */
function ensurePawnAtCell(entityRegistry: EntityRegistry, pawn: PawnEntity, cell: GridCoord): void {
  if (pawn.cell.col === cell.col && pawn.cell.row === cell.row) return;
  entityRegistry.replace({
    ...pawn,
    cell: { col: cell.col, row: cell.row }
  });
}

function manhattanCells(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function findOpenHaulWorkForResource(workRegistry: WorkRegistry, resourceId: string): WorkOrder | undefined {
  for (const o of workRegistry.orders.values()) {
    if (o.kind === "haul" && o.targetEntityId === resourceId && o.status === "open") {
      return o;
    }
  }
  return undefined;
}

/**
 * 与 WorldCore 工单锚格邻接读条前提一致：读条前小人应站在树格的四向邻格。
 * `claimWork` 不校验站位；此处直接 `replace` 改格仅供集成测试/快进编排，生产路径须由移动系统达成邻格。
 */
function ensurePawnAdjacentToChopAnchor(
  entityRegistry: EntityRegistry,
  pawn: PawnEntity,
  anchor: GridCoord
): void {
  if (manhattanCells(pawn.cell, anchor) === 1) return;

  const neighbors: GridCoord[] = [
    { col: anchor.col + 1, row: anchor.row },
    { col: anchor.col - 1, row: anchor.row },
    { col: anchor.col, row: anchor.row + 1 },
    { col: anchor.col, row: anchor.row - 1 }
  ];
  let best = neighbors[0]!;
  let bestD = manhattanCells(pawn.cell, best);
  for (let i = 1; i < neighbors.length; i++) {
    const c = neighbors[i]!;
    const d = manhattanCells(pawn.cell, c);
    if (
      d < bestD ||
      (d === bestD && (c.row < best.row || (c.row === best.row && c.col < best.col)))
    ) {
      best = c;
      bestD = d;
    }
  }
  entityRegistry.replace({
    ...pawn,
    cell: { col: best.col, row: best.row }
  });
}

/**
 * 端到端编排：伐木认领并结算（树木→地面木头+拾取工单，若可路由存储则另登记搬运工单）→ 认领并结算拾取 → 优先认领已派生的搬运工单；否则无显式存储选项则原地放下 / 否则按选项生成搬运并卸货到 `haulDropCell`。
 *
 * 调度层 `claimWork` 不校验小人站位；本函数在认领伐木工单前将小人置于树锚格四向邻格之一，与
 * `oh-gen-doc` 伐木流程「先邻格再读条」顺序一致；拾取前亦可能通过 `ensurePawnAtCell` 对齐树格。
 * **仅限集成测试/快进/脚本编排**：生产游玩勿调用本函数替代真实移动与认领前置校验。
 */
export function runChopFlowScenario(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  treeId: EntityId,
  pawnId: EntityId,
  options: ChopFlowOptions = {}
): ChopFlowResult {
  let wr = workRegistry;
  try {
    const treeEntity = entityRegistry.get(treeId);
    if (!treeEntity) return { kind: "tree-not-found", treeId };
    if (treeEntity.kind !== "tree") return { kind: "tree-kind-mismatch", treeId };

    const tree = treeEntity as TreeEntity;
    const treeCell: GridCoord = { col: tree.cell.col, row: tree.cell.row };

    const pawn0 = asPawn(entityRegistry, pawnId);
    if (!pawn0) return { kind: "pawn-not-found", pawnId };

    if (!tree.loggingMarked) {
      return { kind: "tree-not-marked-for-logging", treeId };
    }

    const chopOrder = generateChopWork(tree.id, treeCell);
    const chopWorkId = options.chopWorkId ?? chopOrder.workId;
    addWork(wr, { ...chopOrder, workId: chopWorkId });

    ensurePawnAdjacentToChopAnchor(entityRegistry, pawn0, treeCell);

    const chopClaimOut = claimWork(wr, chopWorkId, pawnId);
    wr = chopClaimOut.registry;
    if (chopClaimOut.outcome.kind !== "claimed") {
      return { kind: "chop-claim-failed", workId: chopWorkId, claim: chopClaimOut.outcome };
    }

    const chopSettle = settleWorkSuccess(wr, chopWorkId, entityRegistry);
    if (chopSettle.kind !== "ok") {
      return { kind: "chop-settle-failed", workId: chopWorkId, settle: chopSettle };
    }
    const pickWorkId = chopSettle.derivedPickUpWorkId;
    if (!pickWorkId) {
      return { kind: "chop-missing-pickup-derivation", workId: chopWorkId };
    }

    const pickOrder = wr.orders.get(pickWorkId);
    const woodResourceId = (pickOrder?.targetEntityId ?? "") as EntityId;
    if (!pickOrder || pickOrder.kind !== "pick-up" || !woodResourceId) {
      return { kind: "invalid-derived-pickup-order", pickWorkId };
    }

    const pawnAfterChop = asPawn(entityRegistry, pawnId);
    if (!pawnAfterChop) return { kind: "pawn-not-found", pawnId };

    ensurePawnAtCell(entityRegistry, pawnAfterChop, treeCell);

    const pickClaimOut = claimWork(wr, pickWorkId, pawnId);
    wr = pickClaimOut.registry;
    if (pickClaimOut.outcome.kind !== "claimed") {
      return { kind: "pickup-claim-failed", workId: pickWorkId, claim: pickClaimOut.outcome };
    }

    const pickSettle = settleWorkSuccess(wr, pickWorkId, entityRegistry);
    if (pickSettle.kind !== "ok") {
      return { kind: "pickup-settle-failed", workId: pickWorkId, settle: pickSettle };
    }

    const derivedHaul = findOpenHaulWorkForResource(wr, woodResourceId);
    if (derivedHaul) {
      const haulClaimOut = claimWork(wr, derivedHaul.workId, pawnId);
      wr = haulClaimOut.registry;
      if (haulClaimOut.outcome.kind !== "claimed") {
        return { kind: "haul-claim-failed", workId: derivedHaul.workId, claim: haulClaimOut.outcome };
      }
      const haulSettle = settleWorkSuccess(wr, derivedHaul.workId, entityRegistry);
      if (haulSettle.kind !== "ok") {
        return { kind: "haul-settle-failed", workId: derivedHaul.workId, settle: haulSettle };
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
    addWork(wr, haul);

    const haulClaimOut = claimWork(wr, haul.workId, pawnId);
    wr = haulClaimOut.registry;
    if (haulClaimOut.outcome.kind !== "claimed") {
      return { kind: "haul-claim-failed", workId: haul.workId, claim: haulClaimOut.outcome };
    }

    const haulSettle = settleWorkSuccess(wr, haul.workId, entityRegistry);
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
  } finally {
    replaceWorkRegistryOrders(workRegistry, wr);
  }
}
