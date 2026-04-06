import { coordKey, isInsideGrid, parseCoordKey, type GridCoord } from "../game/map/world-grid";
import { simulationImpassableCellKeys } from "../game/world-sim-bridge";
import type { WorldEntitySnapshot } from "../game/entity/entity-types";
import {
  clearTaskMarkersAtCells,
  placeTaskMarker,
  registerChopTreeWork,
  registerMineStoneWork,
  registerPickUpResourceWork,
  safePlaceBlueprint,
  spawnWorldEntity,
  type WorldCore
} from "../game/world-core";
import type { DomainCommand, MockWorldSubmitResult } from "./s0-contract";
import type { WorkItemKind } from "../game/work/work-types";

/** 阻挡格：`grid.blockedCellKeys` 与障碍实体 + 墙体建筑占格合并（与模拟层可走性一致）。 */
function mergedBlockedCellKeys(world: WorldCore): ReadonlySet<string> {
  const fromEntities = simulationImpassableCellKeys(world);
  const fromGrid = world.grid.blockedCellKeys;
  if (!fromGrid || fromGrid.size === 0) return fromEntities;
  const out = new Set(fromEntities);
  for (const k of fromGrid) {
    out.add(k);
  }
  return out;
}

function firstBlockedTargetCell(world: WorldCore, keys: readonly string[]): string | undefined {
  const blocked = mergedBlockedCellKeys(world);
  if (blocked.size === 0) return undefined;
  for (const k of keys) {
    if (blocked.has(k)) return k;
  }
  return undefined;
}

function findObstacleCoveringCell(world: WorldCore, cellKey: string): string | undefined {
  const cell = parseCoordKey(cellKey);
  if (!cell) return undefined;
  const k = coordKey(cell);
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    if (entity.occupiedCells.some((occupantCell) => coordKey(occupantCell) === k)) {
      return entity.id;
    }
  }
  return undefined;
}

function hasNonCompletedWorkForTarget(
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

/** 选中格上未登记开采的地图石料（`label === "stone"`，与 {@link seedBlockedCellsAsObstacles} 一致）。 */
function findUnmarkedStoneObstacleCoveringCell(
  world: WorldCore,
  cellKey: string
): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    if (entity.label !== "stone") continue;
    if (entity.miningMarked) continue;
    if (entity.occupiedCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

/** 选中格上未标记待伐的树（占格语义与 `occupiedCells` 一致）。 */
function findUnmarkedTreeCoveringCell(
  world: WorldCore,
  cellKey: string
): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "tree") continue;
    if (entity.loggingMarked) continue;
    if (entity.occupiedCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

function findGroundResourceCoveringCell(
  world: WorldCore,
  cellKey: string
): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "resource") continue;
    if (entity.containerKind !== "ground") continue;
    if (entity.occupiedCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

function toolIdFromVerb(verb: string): string | null {
  if (!verb.startsWith("assign_tool_task:")) return null;
  return verb.slice("assign_tool_task:".length);
}

/** 将 S0 领域命令落到 {@link WorldCore}；尚未映射到工单的.toolbar 工具仍接受但不改世界（保留 UI 标记通道）。 */
export function applyDomainCommandToWorldCore(
  world: WorldCore,
  cmd: DomainCommand
): Readonly<{ world: WorldCore; result: MockWorldSubmitResult }> {
  if (cmd.verb === "clear_task_markers") {
    const keys = new Set(cmd.targetCellKeys);
    const nextWorld = clearTaskMarkersAtCells(world, keys);
    return {
      world: nextWorld,
      result: {
        accepted: true,
        messages: [`领域：已清除 ${keys.size} 格任务标记`]
      }
    };
  }

  if (cmd.verb === "zone_create") {
    const seen = new Set<string>();
    const coords: GridCoord[] = [];
    for (const key of cmd.targetCellKeys) {
      const cell = parseCoordKey(key);
      if (!cell) {
        return {
          world,
          result: {
            accepted: false,
            messages: [`领域：无效格键 ${key}`],
            conflictCellKeys: [key]
          }
        };
      }
      if (!isInsideGrid(world.grid, cell)) {
        return {
          world,
          result: {
            accepted: false,
            messages: [`领域：格 ${coordKey(cell)} 越界`],
            conflictCellKeys: [coordKey(cell)]
          }
        };
      }
      const ck = coordKey(cell);
      if (seen.has(ck)) continue;
      seen.add(ck);
      coords.push({ col: cell.col, row: cell.row });
    }
    if (coords.length === 0) {
      return {
        world,
        result: {
          accepted: false,
          messages: ["领域：存储区需至少覆盖一格（或全部为重复格键）"]
        }
      };
    }
    const keys = coords.map((c) => coordKey(c));
    const blockedHit = firstBlockedTargetCell(world, keys);
    if (blockedHit) {
      return {
        world,
        result: {
          accepted: false,
          messages: [`领域：格 ${blockedHit} 为阻挡格，无法创建存储区`],
          conflictCellKeys: [blockedHit]
        }
      };
    }

    const anchor = coords[0]!;
    const spawned = spawnWorldEntity(world, {
      kind: "zone",
      cell: anchor,
      occupiedCells: [],
      coveredCells: coords,
      zoneKind: "storage",
      acceptedMaterialKinds: [],
      label: "存储区"
    });
    if (spawned.outcome.kind !== "created") {
      const detail =
        spawned.outcome.kind === "conflict"
          ? `与 ${spawned.outcome.blockingEntityId} 占格冲突`
          : `越界 (${spawned.outcome.cell.col},${spawned.outcome.cell.row})`;
      return {
        world,
        result: {
          accepted: false,
          messages: [`领域：创建存储区失败（${detail}）`]
        }
      };
    }
    return {
      world: spawned.world,
      result: {
        accepted: true,
        messages: [`领域：已创建存储区（storage），覆盖 ${coords.length} 格`]
      }
    };
  }

  if (cmd.verb === "build_wall_blueprint") {
    let next = world;
    let placed = 0;
    let skipped = 0;
    let lastWorkItemId: string | undefined;
    for (const key of cmd.targetCellKeys) {
      const cell = parseCoordKey(key);
      if (!cell || !isInsideGrid(world.grid, cell)) {
        skipped += 1;
        continue;
      }
      const r = safePlaceBlueprint(next, { buildingKind: "wall", cell });
      if (!r.ok) {
        skipped += 1;
        continue;
      }
      next = r.world;
      placed += 1;
      lastWorkItemId = r.workItemId;
    }
    const msg =
      placed > 0
        ? `领域：已放置墙蓝图 ${placed} 处${skipped > 0 ? `，跳过 ${skipped} 格` : ""}`
        : skipped > 0
          ? `领域：未成功放置墙蓝图（跳过/失败 ${skipped} 格）`
          : "领域：build_wall_blueprint 无目标格";
    return {
      world: next,
      result: {
        accepted: true,
        messages: [msg],
        workOrderId: lastWorkItemId
      }
    };
  }

  if (cmd.verb === "place_furniture:bed") {
    let next = world;
    let placed = 0;
    let skipped = 0;
    let lastWorkItemId: string | undefined;
    for (const key of cmd.targetCellKeys) {
      const cell = parseCoordKey(key);
      if (!cell || !isInsideGrid(world.grid, cell)) {
        skipped += 1;
        continue;
      }
      const r = safePlaceBlueprint(next, { buildingKind: "bed", cell });
      if (!r.ok) {
        skipped += 1;
        continue;
      }
      next = r.world;
      placed += 1;
      lastWorkItemId = r.workItemId;
    }
    const msg =
      placed > 0
        ? `领域：已放置床铺蓝图 ${placed} 处${skipped > 0 ? `，跳过 ${skipped} 格` : ""}`
        : skipped > 0
          ? `领域：未成功放置床铺蓝图（跳过/失败 ${skipped} 格）`
          : "领域：place_furniture:bed 无目标格";
    return {
      world: next,
      result: {
        accepted: true,
        messages: [msg],
        workOrderId: lastWorkItemId
      }
    };
  }

  const toolId = toolIdFromVerb(cmd.verb);
  if (toolId === "demolish") {
    let next = world;
    const workIds: string[] = [];
    for (const key of cmd.targetCellKeys) {
      const targetEntityId = findObstacleCoveringCell(next, key);
      if (!targetEntityId) {
        return {
          world,
          result: {
            accepted: false,
            messages: [`领域：格 ${key} 无可拆除障碍（需与地图石格同步注入实体）`],
            conflictCellKeys: [key]
          }
        };
      }
      const obstacleEnt = next.entities.get(targetEntityId);
      if (
        obstacleEnt?.kind === "obstacle" &&
        obstacleEnt.label === "stone" &&
        hasNonCompletedWorkForTarget(next, "mine-stone", targetEntityId)
      ) {
        return {
          world,
          result: {
            accepted: false,
            messages: [`领域：格 ${key} 已登记开采，无法用拆除覆盖`],
            conflictCellKeys: [key]
          }
        };
      }
      const cell = parseCoordKey(key);
      if (!cell) {
        return {
          world,
          result: {
            accepted: false,
            messages: [`领域：无效格键 ${key}`],
            conflictCellKeys: [key]
          }
        };
      }
      const placed = placeTaskMarker(next, {
        kind: "deconstruct-obstacle",
        cell,
        targetEntityId
      });
      next = placed.world;
      workIds.push(placed.workItemId);
    }
    return {
      world: next,
      result: {
        accepted: true,
        messages: [`领域：已登记拆除工单，共 ${cmd.targetCellKeys.length} 格`],
        workOrderId: workIds[workIds.length - 1]
      }
    };
  }

  if (toolId === "build") {
    let next = world;
    let placed = 0;
    let skipped = 0;
    let lastWorkItemId: string | undefined;
    for (const key of cmd.targetCellKeys) {
      const cell = parseCoordKey(key);
      if (!cell || !isInsideGrid(world.grid, cell)) {
        skipped += 1;
        continue;
      }
      const r = safePlaceBlueprint(next, { buildingKind: "bed", cell });
      if (!r.ok) {
        skipped += 1;
        continue;
      }
      next = r.world;
      placed += 1;
      lastWorkItemId = r.workItemId;
    }
    const msg =
      placed > 0
        ? `领域：已放置床铺蓝图 ${placed} 处${skipped > 0 ? `，跳过 ${skipped} 格` : ""}`
        : skipped > 0
          ? `领域：未成功放置床铺蓝图（跳过/失败 ${skipped} 格）`
          : "领域：assign_tool_task:build 无有效目标格";
    return {
      world: next,
      result: {
        accepted: true,
        messages: [msg],
        workOrderId: lastWorkItemId
      }
    };
  }

  if (toolId === "lumber") {
    const blocked = mergedBlockedCellKeys(world);
    let skippedBlocked = 0;
    let next = world;
    const workIds: string[] = [];
    let marked = 0;
    for (const key of cmd.targetCellKeys) {
      if (blocked.has(key) && !findUnmarkedTreeCoveringCell(next, key)) {
        skippedBlocked += 1;
        continue;
      }
      const tree = findUnmarkedTreeCoveringCell(next, key);
      if (!tree) continue;
      const placed = registerChopTreeWork(next, tree.id);
      next = placed.world;
      workIds.push(placed.workItemId);
      marked += 1;
    }
    let msg: string;
    if (marked > 0) {
      msg =
        skippedBlocked > 0
          ? `领域：已登记 ${marked} 处伐木工单（chop-tree），跳过 ${skippedBlocked} 个障碍格`
          : `领域：已登记 ${marked} 处伐木工单（chop-tree）`;
    } else if (skippedBlocked > 0 && skippedBlocked === cmd.targetCellKeys.length) {
      msg = "领域：所选区域均为障碍格，无可登记伐木目标";
    } else if (skippedBlocked > 0) {
      msg = `领域：所选格无未标记树木（已跳过 ${skippedBlocked} 个障碍格）`;
    } else {
      msg = "领域：所选格无未标记树木";
    }
    return {
      world: next,
      result: {
        accepted: true,
        messages: [msg],
        workOrderId: workIds.length > 0 ? workIds[workIds.length - 1] : undefined
      }
    };
  }

  if (toolId === "mine") {
    let next = world;
    const workIds: string[] = [];
    let marked = 0;
    for (const key of cmd.targetCellKeys) {
      const stone = findUnmarkedStoneObstacleCoveringCell(next, key);
      if (!stone) continue;
      if (hasNonCompletedWorkForTarget(next, "deconstruct-obstacle", stone.id)) continue;
      const placed = registerMineStoneWork(next, stone.id);
      next = placed.world;
      workIds.push(placed.workItemId);
      marked += 1;
    }
    const msg =
      marked > 0
        ? `领域：已登记 ${marked} 处开采工单（mine-stone）`
        : "领域：所选格无未标记石料（或已与拆除工单冲突）";
    return {
      world: next,
      result: {
        accepted: true,
        messages: [msg],
        workOrderId: workIds.length > 0 ? workIds[workIds.length - 1] : undefined
      }
    };
  }

  if (toolId === "haul") {
    const blockedHit = firstBlockedTargetCell(world, cmd.targetCellKeys);
    if (blockedHit) {
      return {
        world,
        result: {
          accepted: false,
          messages: [`领域：格 ${blockedHit} 为障碍格，无法指派 ${toolId}`],
          conflictCellKeys: [blockedHit]
        }
      };
    }
    let next = world;
    const workIds: string[] = [];
    let marked = 0;
    for (const key of cmd.targetCellKeys) {
      const resource = findGroundResourceCoveringCell(next, key);
      if (!resource) continue;
      const placed = registerPickUpResourceWork(next, resource.id);
      next = placed.world;
      workIds.push(placed.workItemId);
      marked += 1;
    }
    return {
      world: next,
      result: {
        accepted: true,
        messages: [
          marked > 0
            ? `领域：已登记 ${marked} 处拾取工单（pick-up-resource）`
            : "领域：所选格无地面物资"
        ],
        workOrderId: workIds.length > 0 ? workIds[workIds.length - 1] : undefined
      }
    };
  }

  if (toolId) {
    const blockedHit = firstBlockedTargetCell(world, cmd.targetCellKeys);
    if (blockedHit) {
      return {
        world,
        result: {
          accepted: false,
          messages: [`领域：格 ${blockedHit} 为障碍格，无法指派 ${toolId}`],
          conflictCellKeys: [blockedHit]
        }
      };
    }
    return {
      world,
      result: {
        accepted: true,
        messages: [`领域：工具「${toolId}」暂未接入工单（命令已接受）`]
      }
    };
  }

  return {
    world,
    result: {
      accepted: false,
      messages: [`领域：未知动词 ${cmd.verb}`]
    }
  };
}
