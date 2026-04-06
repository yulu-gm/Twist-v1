/**
 * 将 {@link WorldCore} 真相同步到表现层/模拟层共用的 {@link WorldGridConfig}：
 * 障碍格来自 obstacle 实体；床位交互点 = 模板床位 + 世界中已落成的 restSpots。
 */

import { coordKey, type InteractionPoint, type WorldGridConfig } from "./map/world-grid";
import type { WorldCore } from "./world-core";

export function obstacleBlockedCellKeys(world: WorldCore): Set<string> {
  const out = new Set<string>();
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    for (const c of entity.occupiedCells) {
      out.add(coordKey(c));
    }
  }
  return out;
}

/**
 * 与寻路/游荡共用的不可走格：
 * - 地形 `obstacle`（含地图石料）；
 * - **墙体建筑**占格；
 * - **树**、**蓝图**占格。
 *
 * 墙格若不写入 {@link WorldGridConfig.blockedCellKeys}，小人离开工地后会随机走回墙格再离开，形成两格振荡，
 * 且移动中无法自动认领新蓝图工单（`world-work-tick` 仅在 idle 时认领）。
 * 床铺等需走近使用的建筑不占此集合（与 `simulationInteractionPoints` 床位一致）。
 * 地面物资格不入此集合：搬运/拾取工单与进食路径需可走至格心（或当前 A* 以格心为目标）；
 * 格上实体堆叠仍由 {@link WorldCore.occupancy} 与工单逻辑约束。
 */
export function simulationImpassableCellKeys(world: WorldCore): Set<string> {
  const out = obstacleBlockedCellKeys(world);
  for (const entity of world.entities.values()) {
    switch (entity.kind) {
      case "building":
        if (entity.buildingKind === "wall") {
          for (const c of entity.occupiedCells) {
            out.add(coordKey(c));
          }
        }
        break;
      case "tree":
        for (const c of entity.occupiedCells) {
          out.add(coordKey(c));
        }
        break;
      case "blueprint":
        for (const c of entity.occupiedCells) {
          out.add(coordKey(c));
        }
        break;
      default:
        break;
    }
  }
  return out;
}

function templateBedPrototype(template: WorldGridConfig): InteractionPoint {
  const found = template.interactionPoints.find((p) => p.kind === "bed");
  if (found) return found;
  return {
    id: "bed-template-fallback",
    kind: "bed",
    cell: { col: 0, row: 0 },
    useDurationSec: 3.6,
    needDelta: { rest: -65 }
  };
}

function templateFoodPrototype(template: WorldGridConfig): InteractionPoint {
  const found = template.interactionPoints.find((p) => p.kind === "food");
  if (found) return found;
  return {
    id: "food-template-fallback",
    kind: "food",
    cell: { col: 0, row: 0 },
    useDurationSec: 2.4,
    needDelta: { hunger: -55 }
  };
}

/** 供 pathfinding / 需求 AI 使用的交互点列表：非床类沿用模板，床类为模板床 + WorldCore 休息床位。 */
export function simulationInteractionPoints(
  template: WorldGridConfig,
  world: WorldCore
): InteractionPoint[] {
  const bedProto = templateBedPrototype(template);
  const foodProto = templateFoodPrototype(template);
  const nonBed = template.interactionPoints.filter((p) => p.kind !== "bed");
  const templateBeds = template.interactionPoints.filter((p) => p.kind === "bed");

  const fromWorld: InteractionPoint[] = world.restSpots.map((spot) => ({
    id: `world-rest-${spot.buildingEntityId}`,
    kind: "bed",
    cell: { ...spot.cell },
    useDurationSec: bedProto.useDurationSec,
    needDelta: { ...bedProto.needDelta }
  }));

  const fromPickupFoodOnGround: InteractionPoint[] = [];
  for (const entity of world.entities.values()) {
    if (entity.kind !== "resource") continue;
    if (entity.materialKind !== "food") continue;
    if (entity.containerKind !== "ground") continue;
    if (entity.pickupAllowed !== true) continue;
    fromPickupFoodOnGround.push({
      id: `world-food-${entity.id}`,
      kind: "food",
      cell: { ...entity.cell },
      useDurationSec: foodProto.useDurationSec,
      needDelta: { ...foodProto.needDelta }
    });
  }

  return [...nonBed, ...templateBeds, ...fromWorld, ...fromPickupFoodOnGround];
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

export type SimGridSyncState = Readonly<{
  interactionPointIds: readonly string[];
}>;

/** 就地更新 `grid.blockedCellKeys` 与 `grid.interactionPoints`（与 WorldCore 共用同一 grid 引用）。 */
export function syncWorldGridForSimulation(
  grid: WorldGridConfig,
  world: WorldCore,
  interactionTemplate: WorldGridConfig,
  prev: SimGridSyncState | null
): Readonly<{ blockedChanged: boolean; interactionChanged: boolean; next: SimGridSyncState }> {
  const nextBlocked = simulationImpassableCellKeys(world);
  const blockedReadonly = grid.blockedCellKeys;
  let blockedChanged = false;
  if (blockedReadonly) {
    blockedChanged = !setsEqual(blockedReadonly, nextBlocked);
    if (blockedChanged && blockedReadonly instanceof Set) {
      blockedReadonly.clear();
      for (const k of nextBlocked) blockedReadonly.add(k);
    }
  }

  const nextPoints = simulationInteractionPoints(interactionTemplate, world);
  const ids = nextPoints.map((p) => p.id);
  const prevIds = prev?.interactionPointIds;
  const interactionChanged =
    prevIds === undefined ||
    prevIds.length !== ids.length ||
    prevIds.some((id, i) => id !== ids[i]);

  if (interactionChanged) {
    (grid as WorldGridConfig & { interactionPoints: InteractionPoint[] }).interactionPoints =
      nextPoints;
  }

  return {
    blockedChanged,
    interactionChanged,
    next: { interactionPointIds: ids }
  };
}
