/**
 * 蓝图管理器：在 {@link EntityRegistry} 上创建、推进、取消蓝图（与 BlueprintEntity 形状一致）。
 */
import { coordKey, type GridCoord } from "../map/world-grid";
import type { BlueprintEntity, BuildState, EntityId } from "../entity/entity-types";
import type { EntityRegistry } from "../entity/entity-registry";
import type { BuildingSpec } from "./building-spec-catalog";

export type BlueprintPlacementCells = Readonly<{
  /** 锚定格；占地由 {@link BuildingSpec.cellOffsetsFromAnchor} 与此点合成绝对坐标。 */
  anchor: GridCoord;
}>;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function resolvedCoveredCells(anchor: GridCoord, spec: BuildingSpec): GridCoord[] {
  const seen = new Set<string>();
  const out: GridCoord[] = [];
  for (const off of spec.cellOffsetsFromAnchor) {
    const c: GridCoord = { col: anchor.col + off.col, row: anchor.row + off.row };
    const k = coordKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function progressToBuildState(progress01: number): BuildState {
  if (progress01 >= 1) return "completed";
  if (progress01 > 0) return "in-progress";
  return "planned";
}

export function createBlueprint(
  registry: EntityRegistry,
  spec: BuildingSpec,
  cells: BlueprintPlacementCells
): BlueprintEntity {
  const anchor: GridCoord = { col: cells.anchor.col, row: cells.anchor.row };
  const coveredCells = resolvedCoveredCells(anchor, spec);
  const created = registry.create({
    kind: "blueprint",
    blueprintKind: spec.buildingKind,
    cell: anchor,
    coveredCells,
    buildProgress01: 0,
    buildState: "planned",
    relatedWorkItemIds: []
  });
  if (created.kind !== "blueprint") {
    throw new Error("blueprint-manager: registry created non-blueprint entity");
  }
  return created;
}

export function updateBlueprintProgress(registry: EntityRegistry, blueprintId: EntityId, delta: number): void {
  const entity = registry.get(blueprintId);
  if (!entity || entity.kind !== "blueprint") {
    throw new Error(`blueprint-manager: blueprint not found: ${blueprintId}`);
  }
  const nextProgress = clamp01(entity.buildProgress01 + delta);
  const next: BlueprintEntity = {
    ...entity,
    buildProgress01: nextProgress,
    buildState: progressToBuildState(nextProgress)
  };
  registry.replace(next);
}

export function cancelBlueprint(registry: EntityRegistry, blueprintId: EntityId): void {
  registry.remove(blueprintId);
}

export function isBlueprintComplete(registry: EntityRegistry, blueprintId: EntityId): boolean {
  const entity = registry.get(blueprintId);
  if (!entity || entity.kind !== "blueprint") return false;
  return entity.buildState === "completed" || entity.buildProgress01 >= 1;
}
