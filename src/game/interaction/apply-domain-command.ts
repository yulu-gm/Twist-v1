import { coordKey, isInsideGrid, parseCoordKey, type GridCoord } from "../map";
import {
  clearTaskMarkersAtCells,
  placeTaskMarker,
  registerChopTreeWork,
  registerMineStoneWork,
  registerPickUpResourceWork,
  safePlaceBlueprint,
  spawnWorldEntity,
  type WorldCore
} from "../world-core";
import type { DomainCommand, WorldSubmitResult } from "../contracts/domain-command-types";
import {
  findGroundResourceCoveringCell,
  findObstacleCoveringCell,
  findUnmarkedStoneObstacleCoveringCell,
  findUnmarkedTreeCoveringCell,
  hasNonCompletedWorkForTarget,
  mergedBlockedCellKeys,
  toolbarCellWouldRegisterWork
} from "./toolbar-task-target-resolution";

function firstBlockedTargetCell(world: WorldCore, keys: readonly string[]): string | undefined {
  const blocked = mergedBlockedCellKeys(world);
  if (blocked.size === 0) return undefined;
  for (const k of keys) {
    if (blocked.has(k)) return k;
  }
  return undefined;
}

function toolIdFromVerb(verb: string): string | null {
  if (!verb.startsWith("assign_tool_task:")) return null;
  return verb.slice("assign_tool_task:".length);
}

type BlueprintBatchKind = "wall" | "bed";

function batchSafePlaceBlueprint(
  world: WorldCore,
  targetCellKeys: readonly string[],
  buildingKind: BlueprintBatchKind
): Readonly<{ world: WorldCore; placed: number; skipped: number; lastWorkItemId?: string }> {
  let next = world;
  let placed = 0;
  let skipped = 0;
  let lastWorkItemId: string | undefined;
  for (const key of targetCellKeys) {
    const cell = parseCoordKey(key);
    if (!cell || !isInsideGrid(world.grid, cell)) {
      skipped += 1;
      continue;
    }
    const r = safePlaceBlueprint(next, { buildingKind, cell });
    if (!r.ok) {
      skipped += 1;
      continue;
    }
    next = r.world;
    placed += 1;
    lastWorkItemId = r.workItemId;
  }
  return { world: next, placed, skipped, lastWorkItemId };
}

function blueprintBatchSummaryMessage(
  nounPhrase: string,
  emptyVerbLabel: string,
  placed: number,
  skipped: number
): string {
  if (placed > 0) {
    return `领域：已放置${nounPhrase} ${placed} 处${skipped > 0 ? `，跳过 ${skipped} 格` : ""}`;
  }
  if (skipped > 0) {
    return `领域：未成功放置${nounPhrase}（跳过/失败 ${skipped} 格）`;
  }
  return `领域：${emptyVerbLabel} 无目标格`;
}

/** 将 S0 领域命令落到 {@link WorldCore}；尚未映射到工单的工具类动词仍接受但不改世界（保留 UI 标记通道）。 */
export function applyDomainCommandToWorldCore(
  world: WorldCore,
  cmd: DomainCommand
): Readonly<{ world: WorldCore; result: WorldSubmitResult }> {
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
      label: "存储区",
      storageGroupDisplayName: "存储区",
      storageFilterMode: "allow-all",
      allowedMaterialKinds: []
    });
    if (spawned.outcome.kind !== "created") {
      const detail =
        spawned.outcome.kind === "conflict"
          ? `与 ${spawned.outcome.blockingEntityId} 占格冲突`
          : spawned.outcome.kind === "invalid-draft"
            ? spawned.outcome.reason
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
    const { world: next, placed, skipped, lastWorkItemId } = batchSafePlaceBlueprint(
      world,
      cmd.targetCellKeys,
      "wall"
    );
    const msg = blueprintBatchSummaryMessage("墙蓝图", "build_wall_blueprint", placed, skipped);
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
    const { world: next, placed, skipped, lastWorkItemId } = batchSafePlaceBlueprint(
      world,
      cmd.targetCellKeys,
      "bed"
    );
    const msg = blueprintBatchSummaryMessage("床铺蓝图", "place_furniture:bed", placed, skipped);
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
    const { world: next, placed, skipped, lastWorkItemId } = batchSafePlaceBlueprint(
      world,
      cmd.targetCellKeys,
      "wall"
    );
    const msg = blueprintBatchSummaryMessage("墙蓝图", "assign_tool_task:build", placed, skipped);
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
      if (!toolbarCellWouldRegisterWork(world, next, "lumber", key)) {
        if (blocked.has(key) && !findUnmarkedTreeCoveringCell(next, key)) {
          skippedBlocked += 1;
        }
        continue;
      }
      const tree = findUnmarkedTreeCoveringCell(next, key)!;
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
      if (!toolbarCellWouldRegisterWork(world, next, "mine", key)) continue;
      const stone = findUnmarkedStoneObstacleCoveringCell(next, key)!;
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
    const blocked = mergedBlockedCellKeys(world);
    let next = world;
    const workIds: string[] = [];
    let marked = 0;
    let skippedBlocked = 0;
    for (const key of cmd.targetCellKeys) {
      if (!toolbarCellWouldRegisterWork(world, next, "haul", key)) {
        if (blocked.has(key) && !findGroundResourceCoveringCell(next, key)) {
          skippedBlocked += 1;
        }
        continue;
      }
      const resource = findGroundResourceCoveringCell(next, key)!;
      const placed = registerPickUpResourceWork(next, resource.id);
      next = placed.world;
      workIds.push(placed.workItemId);
      marked += 1;
    }
    const skipHint = skippedBlocked > 0 ? `，跳过 ${skippedBlocked} 个阻挡格` : "";
    return {
      world: next,
      result: {
        accepted: true,
        messages: [
          marked > 0
            ? `领域：已登记 ${marked} 处拾取工单（pick-up-resource）${skipHint}`
            : skippedBlocked > 0
              ? `领域：所选格无地面物资（跳过 ${skippedBlocked} 个阻挡格）`
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
