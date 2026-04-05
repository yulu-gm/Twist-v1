import { coordKey, parseCoordKey } from "../game/map/world-grid";
import {
  clearTaskMarkersAtCells,
  placeTaskMarker,
  safePlaceBlueprint,
  type WorldCore
} from "../game/world-core";
import type { DomainCommand, MockWorldSubmitResult } from "./s0-contract";

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

function toolIdFromVerb(verb: string): string | null {
  if (!verb.startsWith("assign_tool_task:")) return null;
  return verb.slice("assign_tool_task:".length);
}

function firstBlockedTargetCell(world: WorldCore, keys: readonly string[]): string | undefined {
  const blocked = world.grid.blockedCellKeys;
  if (!blocked) return undefined;
  for (const k of keys) {
    if (blocked.has(k)) return k;
  }
  return undefined;
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
    const workIds: string[] = [];
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
      const placed = safePlaceBlueprint(next, { buildingKind: "bed", cell });
      if (!placed.ok) {
        return {
          world,
          result: {
            accepted: false,
            messages: [`领域：${key} ${placed.reason}`],
            conflictCellKeys: [key]
          }
        };
      }
      next = placed.world;
      workIds.push(placed.workItemId);
    }
    return {
      world: next,
      result: {
        accepted: true,
        messages: [`领域：已放置床铺蓝图 ${cmd.targetCellKeys.length} 处`],
        workOrderId: workIds[workIds.length - 1]
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
        messages: [`领域：已登记 ${toolId} 意图（暂无对应工单，仅 UI 标记）`]
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
