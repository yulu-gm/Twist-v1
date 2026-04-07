/**
 * 地面物资展示投影：数据来自实体目录中的地图容器物资。
 */

import type { EntityRegistry } from "../game/entity-system";
import type { GridCoord } from "../game/world-grid";

export type GroundItemStack = Readonly<{
  cell: GridCoord;
  displayName: string;
  quantity: number;
}>;

export function groundStacksFromRegistry(
  registry: EntityRegistry
): readonly GroundItemStack[] {
  return registry.listMaterialsOnGround().map((m) => ({
    cell: m.cell,
    displayName: m.materialKind,
    quantity: m.quantity
  }));
}

export function groundItemAt(
  registry: EntityRegistry,
  cell: GridCoord
): GroundItemStack | undefined {
  const m = registry.groundMaterialAtCell(cell);
  if (!m) return undefined;
  return {
    cell: m.cell,
    displayName: m.materialKind,
    quantity: m.quantity
  };
}
