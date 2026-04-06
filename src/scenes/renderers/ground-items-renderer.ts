/**
 * ground-items-renderer：从 WorldCore 同步地面散落物资（resource + containerKind ground）线框与标签。
 */

import Phaser from "phaser";
import type { ResourceMaterialKind, WorldEntitySnapshot } from "../../game/entity/entity-types";
import type { WorldGridConfig } from "../../game/map/world-grid";

const MATERIAL_DISPLAY: Record<ResourceMaterialKind, string> = {
  wood: "木材",
  food: "食物",
  stone: "石材",
  generic: "物资"
};

export function syncGroundResourceItems(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  labelMap: Map<string, Phaser.GameObjects.Text>,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  entities: Iterable<WorldEntitySnapshot>
): void {
  g.clear();
  const cs = grid.cellSizePx;
  const pad = 4;

  const activeIds = new Set<string>();
  for (const e of entities) {
    if (e.kind !== "resource") continue;
    if (e.containerKind !== "ground") continue;

    activeIds.add(e.id);

    const { col, row } = e.cell;
    const left = ox + col * cs + pad;
    const top = oy + row * cs + pad;
    const wBox = cs - pad * 2;
    const hBox = cs - pad * 2;

    const borderColor = e.pickupAllowed !== false ? 0xc9b87a : 0x8a8a8a;
    g.lineStyle(2, borderColor, 0.95);
    g.strokeRect(left, top, wBox, hBox);

    const cx = ox + (col + 0.5) * cs;
    const cy = oy + (row + 0.5) * cs;
    const mat = e.materialKind ?? "generic";
    const text = e.label?.trim() ? e.label : MATERIAL_DISPLAY[mat] ?? mat;

    let label = labelMap.get(e.id);
    if (!label || !label.active) {
      if (label) labelMap.delete(e.id);
      label = scene.add
        .text(cx, cy, text, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "11px",
          color: "#e8dcc8",
          align: "center"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(25);
      labelMap.set(e.id, label);
    }
    label.setText(text);
    label.setPosition(cx, cy);
    label.setColor("#e8dcc8");
  }

  for (const [id, label] of labelMap) {
    if (!activeIds.has(id)) {
      label.destroy();
      labelMap.delete(id);
    }
  }
}
