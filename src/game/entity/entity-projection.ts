/**
 * 将领域实体 {@link GameEntity} 投影为 legacy {@link WorldEntitySnapshot}，供仍消费 world-core 序列化形状的系统使用。
 */

import { coordKey, type GridCoord } from "../map/world-grid";
import type { GameEntity, WorldEntitySnapshot } from "./entity-types";

function cloneCoord(c: GridCoord): GridCoord {
  return { col: c.col, row: c.row };
}

function footprintCells(primary: GridCoord, covered: readonly GridCoord[]): GridCoord[] {
  const seen = new Set<string>();
  const out: GridCoord[] = [];
  const add = (c: GridCoord): void => {
    const k = coordKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(cloneCoord(c));
  };
  add(primary);
  for (const c of covered) add(c);
  return out;
}

/**
 * 映射约定（world-core 仅有 pawn / obstacle / blueprint / building）：
 * - `resource`、`tree` → `kind: "obstacle"`；`label` 分别用 `resource:<material>`、`tree` 区分语义。
 * - `zone` → `kind: "obstacle"`；主格 `cell` 取 `coveredCells` 去重后的首格（插入顺序）；`label` 含 zoneKind 与 name。
 * - 若 `zone.coveredCells` 为空：占格退化为单格 `(0,0)`（仅占位，调用方应避免此类数据进入模拟）。
 * - `pawn`：无工单时 `relatedWorkItemIds` 为空数组；无刻度化 label。
 * - `building`：领域模型无关联工单字段，快照中 `relatedWorkItemIds` 恒为空。
 * - `blueprint`：`label` 设为 `<blueprintKind>-blueprint`，与 `safePlaceBlueprint` 生成策略对齐。
 */
export function toReadonlySnapshot(entity: GameEntity): WorldEntitySnapshot {
  switch (entity.kind) {
    case "pawn":
      return {
        id: entity.id,
        kind: "pawn",
        cell: cloneCoord(entity.cell),
        occupiedCells: [cloneCoord(entity.cell)],
        relatedWorkItemIds: []
      };
    case "resource":
      return {
        id: entity.id,
        kind: "obstacle",
        cell: cloneCoord(entity.cell),
        occupiedCells: [cloneCoord(entity.cell)],
        label: `resource:${entity.materialKind}`,
        relatedWorkItemIds: []
      };
    case "tree":
      return {
        id: entity.id,
        kind: "obstacle",
        cell: cloneCoord(entity.cell),
        occupiedCells: [cloneCoord(entity.cell)],
        label: "tree",
        relatedWorkItemIds: []
      };
    case "blueprint": {
      const occupied = footprintCells(entity.cell, entity.coveredCells);
      return {
        id: entity.id,
        kind: "blueprint",
        cell: cloneCoord(entity.cell),
        occupiedCells: occupied,
        label: `${entity.blueprintKind}-blueprint`,
        blueprintKind: entity.blueprintKind,
        buildProgress01: entity.buildProgress01,
        buildState: entity.buildState,
        relatedWorkItemIds: [...entity.relatedWorkItemIds]
      };
    }
    case "building": {
      const occupied = footprintCells(entity.cell, entity.coveredCells);
      const caps = entity.interactionCapabilities;
      return {
        id: entity.id,
        kind: "building",
        cell: cloneCoord(entity.cell),
        occupiedCells: occupied,
        buildingKind: entity.buildingKind,
        relatedWorkItemIds: [],
        interactionCapabilities: caps.length > 0 ? [...caps] : undefined,
        ownership: entity.ownership ? { ...entity.ownership } : undefined
      };
    }
    case "zone": {
      if (entity.coveredCells.length === 0) {
        const fallback = { col: 0, row: 0 };
        return {
          id: entity.id,
          kind: "obstacle",
          cell: fallback,
          occupiedCells: [fallback],
          label: `zone:${entity.zoneKind}:${entity.name}`,
          relatedWorkItemIds: []
        };
      }
      const primary = entity.coveredCells[0]!;
      const occupied = footprintCells(primary, entity.coveredCells);
      const anchor = occupied[0]!;
      return {
        id: entity.id,
        kind: "obstacle",
        cell: cloneCoord(anchor),
        occupiedCells: occupied,
        label: `zone:${entity.zoneKind}:${entity.name}`,
        relatedWorkItemIds: []
      };
    }
  }
}
