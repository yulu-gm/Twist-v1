/**
 * ground-items-renderer：从 WorldCore 同步可在地图上展示的资源（ground / zone）线框、标签与堆叠数。
 */

import Phaser from "phaser";
import type {
  ResourceContainerKind,
  ResourceMaterialKind,
  WorldEntitySnapshot
} from "../../game/entity/entity-types";
import type { WorldGridConfig } from "../../game/map";

/** 呈现层主题：便于对齐策划文案、对比度与深度分层验收（审计行动点 #0338）。 */
export type GroundResourceRenderTheme = Readonly<{
  materialLabels: Record<ResourceMaterialKind, string>;
  depths: Readonly<{ resourceLabel: number; stackBadge: number }>;
  colors: Readonly<{
    resourceLabel: string;
    stackBadge: string;
    borderPickupAllowed: number;
    borderPickupBlocked: number;
  }>;
}>;

export const DEFAULT_GROUND_RESOURCE_RENDER_THEME: GroundResourceRenderTheme = {
  materialLabels: {
    wood: "木材",
    food: "食物",
    stone: "石材",
    generic: "物资"
  },
  depths: { resourceLabel: 33, stackBadge: 34 },
  colors: {
    resourceLabel: "#e8dcc8",
    stackBadge: "#f7f1df",
    borderPickupAllowed: 0xc9b87a,
    borderPickupBlocked: 0x8a8a8a
  }
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
  entities: Iterable<WorldEntitySnapshot>,
  theme: GroundResourceRenderTheme = DEFAULT_GROUND_RESOURCE_RENDER_THEME
): RenderableResourceItem[] {
  const out: RenderableResourceItem[] = [];
  for (const e of entities) {
    if (e.kind !== "resource") continue;
    if (e.containerKind !== "ground" && e.containerKind !== "zone") continue;

    const stackCount = Math.max(1, e.stackCount ?? 1);
    const mat = e.materialKind ?? "generic";
    const centerText = e.label?.trim() ? e.label : theme.materialLabels[mat] ?? mat;
    out.push({
      id: e.id,
      containerKind: e.containerKind,
      cell: e.cell,
      centerText,
      stackCount,
      stackBadgeText: stackCount > 1 ? `×${stackCount}` : undefined,
      borderColor:
        e.pickupAllowed !== false
          ? theme.colors.borderPickupAllowed
          : theme.colors.borderPickupBlocked
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
  entities: Iterable<WorldEntitySnapshot>,
  theme: GroundResourceRenderTheme = DEFAULT_GROUND_RESOURCE_RENDER_THEME
): void {
  g.clear();
  const cs = grid.cellSizePx;
  const pad = 4;

  const items = collectRenderableResourceItems(entities, theme);
  const activeIds = new Set<string>();
  const activeCountIds = new Set<string>();
  for (const item of items) {
    activeIds.add(item.id);

    const { col, row } = item.cell;
    const left = ox + col * cs + pad;
    const top = oy + row * cs + pad;
    const wBox = cs - pad * 2;
    const hBox = cs - pad * 2;

    // 交互系统.yaml：「标记显示」针对散落/可标记物资；「存储区显示」为区边界（由 zone overlay 负责）。
    // 区内堆叠仅保留文字与数量角标，避免与散落物资拾取线框语义重复（审计行动点 #0339）。
    if (item.containerKind === "ground") {
      g.lineStyle(2, item.borderColor, 0.95);
      g.strokeRect(left, top, wBox, hBox);
    }

    const cx = ox + (col + 0.5) * cs;
    const cy = oy + (row + 0.5) * cs;

    let label = labelMap.get(item.id);
    if (!label || !label.active) {
      if (label) labelMap.delete(item.id);
      label = scene.add
        .text(cx, cy, item.centerText, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "11px",
          color: theme.colors.resourceLabel,
          align: "center"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(theme.depths.resourceLabel);
      labelMap.set(item.id, label);
    }
    label.setText(item.centerText);
    label.setPosition(cx, cy);
    label.setColor(theme.colors.resourceLabel);
    label.setDepth(theme.depths.resourceLabel);

    if (item.stackBadgeText) {
      activeCountIds.add(item.id);
      let countLabel = countLabelMap.get(item.id);
      if (!countLabel || !countLabel.active) {
        if (countLabel) countLabelMap.delete(item.id);
        countLabel = scene.add
          .text(ox + (col + 1) * cs - 4, oy + (row + 1) * cs - 4, item.stackBadgeText, {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "10px",
            color: theme.colors.stackBadge,
            align: "right"
          })
          .setOrigin(1, 1)
          .setDepth(theme.depths.stackBadge);
        countLabelMap.set(item.id, countLabel);
      }
      countLabel.setText(item.stackBadgeText);
      countLabel.setPosition(ox + (col + 1) * cs - 4, oy + (row + 1) * cs - 4);
      countLabel.setColor(theme.colors.stackBadge);
      countLabel.setDepth(theme.depths.stackBadge);
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
