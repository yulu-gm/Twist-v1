/**
 * ground-items-renderer：从 WorldCore 同步可在地图上展示的资源（ground / zone）线框、标签与堆叠数。
 */

import Phaser from "phaser";
import type {
  ResourceContainerKind,
  ResourceMaterialKind,
  WorldEntitySnapshot
} from "../../game/entity/entity-types";
import type { WorldGridConfig } from "../../game/map/world-grid";

const MATERIAL_DISPLAY: Record<ResourceMaterialKind, string> = {
  wood: "木材",
  food: "食物",
  stone: "石材",
  generic: "物资"
};

export type RenderableResourceItem = Readonly<{
  id: string;
  containerKind: ResourceContainerKind;
  cell: WorldEntitySnapshot["cell"];
  centerText: string;
  stackCount: number;
  stackBadgeText?: string;
  borderColor: number;
}>;

export function collectRenderableResourceItems(
  entities: Iterable<WorldEntitySnapshot>
): RenderableResourceItem[] {
  const out: RenderableResourceItem[] = [];
  for (const e of entities) {
    if (e.kind !== "resource") continue;
    if (e.containerKind !== "ground" && e.containerKind !== "zone") continue;

    const stackCount = Math.max(1, e.stackCount ?? 1);
    const mat = e.materialKind ?? "generic";
    const centerText = e.label?.trim() ? e.label : MATERIAL_DISPLAY[mat] ?? mat;
    out.push({
      id: e.id,
      containerKind: e.containerKind,
      cell: e.cell,
      centerText,
      stackCount,
      stackBadgeText: stackCount > 1 ? `×${stackCount}` : undefined,
      borderColor: e.pickupAllowed !== false ? 0xc9b87a : 0x8a8a8a
    });
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function syncGroundResourceItems(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  labelMap: Map<string, Phaser.GameObjects.Text>,
  countLabelMap: Map<string, Phaser.GameObjects.Text>,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  entities: Iterable<WorldEntitySnapshot>
): void {
  g.clear();
  const cs = grid.cellSizePx;
  const pad = 4;

  const items = collectRenderableResourceItems(entities);
  const activeIds = new Set<string>();
  const activeCountIds = new Set<string>();
  for (const item of items) {
    activeIds.add(item.id);

    const { col, row } = item.cell;
    const left = ox + col * cs + pad;
    const top = oy + row * cs + pad;
    const wBox = cs - pad * 2;
    const hBox = cs - pad * 2;

    g.lineStyle(2, item.borderColor, 0.95);
    g.strokeRect(left, top, wBox, hBox);

    const cx = ox + (col + 0.5) * cs;
    const cy = oy + (row + 0.5) * cs;

    let label = labelMap.get(item.id);
    if (!label || !label.active) {
      if (label) labelMap.delete(item.id);
      label = scene.add
        .text(cx, cy, item.centerText, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "11px",
          color: "#e8dcc8",
          align: "center"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(33);
      labelMap.set(item.id, label);
    }
    label.setText(item.centerText);
    label.setPosition(cx, cy);
    label.setColor("#e8dcc8");
    label.setDepth(33);

    if (item.stackBadgeText) {
      activeCountIds.add(item.id);
      let countLabel = countLabelMap.get(item.id);
      if (!countLabel || !countLabel.active) {
        if (countLabel) countLabelMap.delete(item.id);
        countLabel = scene.add
          .text(ox + (col + 1) * cs - 4, oy + (row + 1) * cs - 4, item.stackBadgeText, {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "10px",
            color: "#f7f1df",
            align: "right"
          })
          .setOrigin(1, 1)
          .setDepth(34);
        countLabelMap.set(item.id, countLabel);
      }
      countLabel.setText(item.stackBadgeText);
      countLabel.setPosition(ox + (col + 1) * cs - 4, oy + (row + 1) * cs - 4);
      countLabel.setColor("#f7f1df");
      countLabel.setDepth(34);
    }
  }

  for (const [id, label] of labelMap) {
    if (!activeIds.has(id)) {
      label.destroy();
      labelMap.delete(id);
    }
  }

  for (const [id, label] of countLabelMap) {
    if (!activeCountIds.has(id)) {
      label.destroy();
      countLabelMap.delete(id);
    }
  }
}
