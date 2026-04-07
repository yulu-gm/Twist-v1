import type { InteractionPointKind } from "../game/map";

/**
 * 地图网格层（石头格、交互点）的固定配色与标注样式。
 * 与 `TimeOfDayPalette` 同级：不随日内插值，主题扩展时在此集中调整。
 */

export const GRID_OVERLAY_STONE = {
  fillColor: 0x6b6560,
  strokeColor: 0x3d3830,
  strokeAlpha: 0.92
} as const;

export const GRID_OVERLAY_INTERACTION = {
  fillFood: 0xc57b57,
  fillBed: 0x5d7fa3,
  fillRecreation: 0x5ea37c,
  strokeReserved: 0xf5f1e8,
  strokeIdle: 0x1f1a16,
  strokeAlpha: 0.85,
  fillAlphaReserved: 0.95,
  fillAlphaIdle: 0.65
} as const;

/** 交互点标签文案（与 `InteractionPointKind` 对齐，避免视图层散落 `toUpperCase()`）。 */
export const GRID_OVERLAY_INTERACTION_LABEL: Record<InteractionPointKind, string> = {
  food: "FOOD",
  bed: "BED",
  recreation: "RECREATION"
};

export const GRID_OVERLAY_INTERACTION_LABEL_STYLE = {
  fontFamily: "Segoe UI, sans-serif",
  fontSize: "10px",
  offsetYPx: 18
} as const;

/** 交互点形状几何（世界像素，相对格心）。 */
export const GRID_OVERLAY_INTERACTION_SHAPE = {
  bed: { halfW: 14, halfH: 10 },
  food: { radius: 12 },
  recreation: { apex: 12, wing: 12 }
} as const;

export function interactionFillColor(kind: InteractionPointKind): number {
  switch (kind) {
    case "food":
      return GRID_OVERLAY_INTERACTION.fillFood;
    case "bed":
      return GRID_OVERLAY_INTERACTION.fillBed;
    default:
      return GRID_OVERLAY_INTERACTION.fillRecreation;
  }
}
