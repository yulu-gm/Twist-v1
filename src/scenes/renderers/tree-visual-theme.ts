/**
 * 树渲染用颜色、线宽、透明度常量（与 UI 地图反馈层统一调整入口）。
 */

import type { TreeLoggingVisualPhase } from "../../game/entity/entity-types";

/** 树冠/树干几何比例（相对 cell 边长）。 */
export const TREE_SHAPE_RATIOS = {
  crownWidth: 0.38,
  crownHeight: 0.42,
  trunkWidth: 0.08,
  trunkHeight: 0.22,
  crownTipY: 0.85,
  crownBaseY: 0.15,
  trunkTopY: 0.12
} as const;

export type TreePhaseGraphicsStyle = Readonly<{
  foliageFill: number;
  foliageStroke: number;
  foliageLineWidth: number;
  foliageFillAlpha: number;
  foliageStrokeAlpha: number;
  trunkFill: number;
  trunkFillAlpha: number;
}>;

export const TREE_RENDER_THEME: Record<TreeLoggingVisualPhase, TreePhaseGraphicsStyle> = {
  normal: {
    foliageFill: 0x2d8a3e,
    foliageStroke: 0x1a4d24,
    foliageLineWidth: 1.5,
    foliageFillAlpha: 0.92,
    foliageStrokeAlpha: 0.9,
    trunkFill: 0x4a3528,
    trunkFillAlpha: 1
  },
  marked: {
    foliageFill: 0xc45c26,
    foliageStroke: 0xfff3c4,
    foliageLineWidth: 3,
    foliageFillAlpha: 1,
    foliageStrokeAlpha: 1,
    trunkFill: 0x5c3d2e,
    trunkFillAlpha: 1
  },
  chopping: {
    foliageFill: 0xd94c20,
    foliageStroke: 0xffe066,
    foliageLineWidth: 4,
    foliageFillAlpha: 1,
    foliageStrokeAlpha: 1,
    trunkFill: 0x6b4423,
    trunkFillAlpha: 1
  }
};
