/**
 * 工具栏任务目标格解析：与 {@link applyDomainCommandToWorldCore} 中 lumber / haul / mine / demolish
 * 的登记口径共用同一套阻挡、实体命中与工单冲突判定，避免预览标记与领域层漂移。
 */

import type { WorldEntitySnapshot } from "../entity/entity-types";
import type { WorkItemKind } from "../work/work-types";
import { coordKey, parseCoordKey } from "../map";
import { simulationImpassableCellKeys } from "../world-sim-bridge";
import type { WorldCore } from "../world-core";

/** 阻挡格：`grid.blockedCellKeys` 与障碍实体 + 墙体建筑占格合并（与模拟层可走性一致）。 */
export function mergedBlockedCellKeys(world: WorldCore): ReadonlySet<string> {
  const fromEntities = simulationImpassableCellKeys(world);
  const fromGrid = world.grid.blockedCellKeys;
  if (!fromGrid || fromGrid.size === 0) return fromEntities;
  const out = new Set(fromEntities);
  for (const k of fromGrid) {
    out.add(k);
  }
  return out;
}

export function findObstacleCoveringCell(world: WorldCore, cellKey: string): string | undefined {
  const cell = parseCoordKey(cellKey);
  if (!cell) return undefined;
  const k = coordKey(cell);
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((occupantCell) => coordKey(occupantCell) === k)) {
      return entity.id;
    }
  }
  return undefined;
}

export function hasNonCompletedWorkForTarget(
  world: WorldCore,
  kind: WorkItemKind,
  targetEntityId: string
): boolean {
  for (const w of world.workItems.values()) {
    if (w.kind !== kind) continue;
    if (w.targetEntityId !== targetEntityId) continue;
    if (w.status !== "completed") return true;
  }
  return false;
}

/** 选中格上未登记开采的地图石料（`label === "stone"`）。占格语义与其它实体查找一致。 */
export function findUnmarkedStoneObstacleCoveringCell(
  world: WorldCore,
  cellKey: string
): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    if (entity.label !== "stone") continue;
    if (entity.miningMarked) continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

export function findUnmarkedTreeCoveringCell(
  world: WorldCore,
  cellKey: string
): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "tree") continue;
    if (entity.loggingMarked) continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

export function findGroundResourceCoveringCell(
  world: WorldCore,
  cellKey: string
): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "resource") continue;
    if (entity.containerKind !== "ground") continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

export type ToolbarWorkRegisterToolId = "lumber" | "haul" | "mine" | "demolish";

/**
 * 在给定世界视图下，该格是否会登记对应工具的工单（与领域层循环体内判定一致）。
 * `blockedView` 用于合并阻挡集（通常取命令开始时的 world）；`entityView` 可取迭代中的快照 world。
 */
export function toolbarCellWouldRegisterWork(
  blockedView: WorldCore,
  entityView: WorldCore,
  toolId: ToolbarWorkRegisterToolId,
  cellKey: string
): boolean {
  const blocked = mergedBlockedCellKeys(blockedView);
  switch (toolId) {
    case "lumber": {
      const tree = findUnmarkedTreeCoveringCell(entityView, cellKey);
      if (!tree && blocked.has(cellKey)) return false;
      return !!tree;
    }
    case "haul": {
      const resource = findGroundResourceCoveringCell(entityView, cellKey);
      if (!resource && blocked.has(cellKey)) return false;
      return !!resource;
    }
    case "mine": {
      const stone = findUnmarkedStoneObstacleCoveringCell(entityView, cellKey);
      if (!stone) return false;
      if (hasNonCompletedWorkForTarget(entityView, "deconstruct-obstacle", stone.id)) return false;
      return true;
    }
    case "demolish": {
      const targetEntityId = findObstacleCoveringCell(entityView, cellKey);
      if (!targetEntityId) return false;
      const obstacleEnt = entityView.entities.get(targetEntityId);
      if (
        obstacleEnt?.kind === "obstacle" &&
        obstacleEnt.label === "stone" &&
        hasNonCompletedWorkForTarget(entityView, "mine-stone", targetEntityId)
      ) {
        return false;
      }
      return true;
    }
    default: {
      const _exhaustive: never = toolId;
      return _exhaustive;
    }
  }
}

/** 从选中格集合中筛出「当前会登记工单」的格（lumber / haul / mine / demolish）。 */
export function resolveToolbarTaskTargetCellKeys(
  blockedView: WorldCore,
  entityView: WorldCore,
  toolId: ToolbarWorkRegisterToolId,
  cellKeys: ReadonlySet<string>
): Set<string> {
  const out = new Set<string>();
  for (const key of cellKeys) {
    if (toolbarCellWouldRegisterWork(blockedView, entityView, toolId, key)) {
      out.add(key);
    }
  }
  return out;
}
