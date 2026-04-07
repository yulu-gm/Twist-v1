/**
 * 将 {@link WorldCore} 真相同步到表现层/模拟层共用的 {@link WorldGridConfig}：
 * 障碍格来自 obstacle 实体；床位交互点 = 模板床位 + 世界中已落成的 restSpots。
 */

import type { GridCellHoverReadModel } from "../data/grid-cell-info";
import { getOccupants } from "./map/occupancy-manager";
import { coordKey, type GridCoord, type InteractionPoint, type WorldGridConfig } from "./map/world-grid";
import type { WorldCore } from "./world-core";

/**
 * 关卡/布局在类型上用 {@link WorldGridConfig} 表达为只读；运行时装在 {@link WorldCore.grid} 上的同一对象
 * 由 bootstrap / headless 提供可变 `Set` 与可替换的交互点数组。本类型显式收窄「模拟同步可写」字段（行动点 #0209），
 * 避免在桥接层对网格结构做多处匿名交集断言。
 */
export type WorldGridSimulationSyncTarget = Omit<WorldGridConfig, "blockedCellKeys" | "interactionPoints"> & {
  blockedCellKeys?: Set<string> | ReadonlySet<string>;
  interactionPoints: InteractionPoint[];
};

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
 * - **树**、**蓝图**占格（蓝图：已定稿——虚影无实体碰撞，但模拟层占格计入阻挡，与 oh-gen-doc 建筑系统 / oh-code-design 地图系统「蓝图占格与通行」一致）。
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

function mergedSimulationBlockedKeys(world: WorldCore): ReadonlySet<string> {
  const fromEntities = simulationImpassableCellKeys(world);
  const fromGrid = world.grid.blockedCellKeys;
  if (!fromGrid || fromGrid.size === 0) return fromEntities;
  const out = new Set(fromEntities);
  for (const k of fromGrid) {
    out.add(k);
  }
  return out;
}

function impassableBriefForCell(world: WorldCore, cell: GridCoord): string | null {
  const key = coordKey(cell);
  const merged = mergedSimulationBlockedKeys(world);
  if (!merged.has(key)) return null;

  for (const entity of world.entities.values()) {
    const cells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (!cells.some((c) => coordKey(c) === key)) continue;
    switch (entity.kind) {
      case "obstacle":
        return "石料障碍";
      case "tree":
        return "树木占格";
      case "building":
        if (entity.buildingKind === "wall") return "墙体占格";
        break;
      case "blueprint":
        return "建造蓝图占格";
      default:
        break;
    }
  }

  if (world.grid.blockedCellKeys?.has(key)) return "网格障碍格";
  return "障碍格";
}

function occupancyBriefForWalkableCell(world: WorldCore, cell: GridCoord): string | null {
  const ids = getOccupants(world.occupancy, cell);
  if (ids.length === 0) return null;
  if (ids.length === 1) {
    const id = ids[0]!;
    const entity = world.entities.get(id);
    const tag = entity?.label?.trim() || entity?.kind || "实体";
    return `占用：${tag}（${id}）`;
  }
  return `占用：${ids.length} 个实体`;
}

/**
 * 供 HUD 悬停等 UI 使用的只读格摘要：地形标签 + 与模拟一致的阻挡/可走 + 可走格上的占用简述。
 */
export function buildGridCellHoverReadModel(world: WorldCore, cell: GridCoord): GridCellHoverReadModel {
  const merged = mergedSimulationBlockedKeys(world);
  const simulationImpassable = merged.has(coordKey(cell));
  const impassableBrief = simulationImpassable ? impassableBriefForCell(world, cell) : null;
  const occupancyBrief = simulationImpassable ? null : occupancyBriefForWalkableCell(world, cell);

  return {
    cell: { ...cell },
    terrainLabel: "地表（无地形分类配置）",
    simulationImpassable,
    impassableBrief,
    occupancyBrief
  };
}

type SimInteractionTiming = Pick<InteractionPoint, "useDurationSec" | "needDelta">;

/** 与旧模板兜底数值一致；仅作「从世界衍生」时的参数来源，不表示地图上存在 (0,0) 交互点。 */
const SIM_BED_STATS_FALLBACK: SimInteractionTiming = {
  useDurationSec: 3.6,
  needDelta: { rest: -65 }
};

const SIM_FOOD_STATS_FALLBACK: SimInteractionTiming = {
  useDurationSec: 2.4,
  needDelta: { hunger: -55 }
};

function hasGroundPickupFood(world: WorldCore): boolean {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "resource") continue;
    if (entity.materialKind !== "food") continue;
    if (entity.containerKind !== "ground") continue;
    if (entity.pickupAllowed !== true) continue;
    return true;
  }
  return false;
}

function bedStatsForWorldRest(
  template: WorldGridConfig,
  world: WorldCore
): SimInteractionTiming {
  if (world.restSpots.length === 0) return SIM_BED_STATS_FALLBACK;
  const found = template.interactionPoints.find((p) => p.kind === "bed");
  if (found) {
    return { useDurationSec: found.useDurationSec, needDelta: { ...found.needDelta } };
  }
  const msg =
    '[world-sim-bridge] interactionTemplate 缺少 kind="bed"；已用内置系数为世界床位生成交互点，请补全 WorldGridConfig.interactionPoints。';
  console.warn(msg);
  if (process.env.NODE_ENV !== "production") {
    throw new Error(msg);
  }
  return SIM_BED_STATS_FALLBACK;
}

function foodStatsForGroundPickup(
  template: WorldGridConfig,
  world: WorldCore
): SimInteractionTiming {
  if (!hasGroundPickupFood(world)) return SIM_FOOD_STATS_FALLBACK;
  const found = template.interactionPoints.find((p) => p.kind === "food");
  if (found) {
    return { useDurationSec: found.useDurationSec, needDelta: { ...found.needDelta } };
  }
  const msg =
    '[world-sim-bridge] interactionTemplate 缺少 kind="food"；已用内置系数为地面食物生成交互点，请补全 WorldGridConfig.interactionPoints。';
  console.warn(msg);
  if (process.env.NODE_ENV !== "production") {
    throw new Error(msg);
  }
  return SIM_FOOD_STATS_FALLBACK;
}

/** 供 pathfinding / 需求 AI 使用的交互点列表：非床类沿用模板，床类为模板床 + WorldCore 休息床位。 */
export function simulationInteractionPoints(
  template: WorldGridConfig,
  world: WorldCore
): InteractionPoint[] {
  const bedStats = bedStatsForWorldRest(template, world);
  const foodStats = foodStatsForGroundPickup(template, world);
  const nonBed = template.interactionPoints.filter((p) => p.kind !== "bed");
  const templateBeds = template.interactionPoints.filter((p) => p.kind === "bed");

  const fromWorld: InteractionPoint[] = world.restSpots.map((spot) => ({
    id: `world-rest-${spot.buildingEntityId}`,
    kind: "bed",
    cell: { ...spot.cell },
    useDurationSec: bedStats.useDurationSec,
    needDelta: { ...bedStats.needDelta }
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
      useDurationSec: foodStats.useDurationSec,
      needDelta: { ...foodStats.needDelta }
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
  const syncTarget = grid as WorldGridSimulationSyncTarget;
  const nextBlocked = simulationImpassableCellKeys(world);
  const blockedReadonly = syncTarget.blockedCellKeys;
  let blockedChanged = false;
  if (!blockedReadonly) {
    // 与 headless 初始化注释一致：缺省时挂可变 Set，避免 falsy 导致整块障碍同步被跳过。
    syncTarget.blockedCellKeys = new Set(nextBlocked);
    blockedChanged = true;
  } else {
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
    syncTarget.interactionPoints = nextPoints;
  }

  return {
    blockedChanged,
    interactionChanged,
    next: { interactionPointIds: ids }
  };
}
