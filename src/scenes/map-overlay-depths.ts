/**
 * 地图叠加反馈层 Phaser depth，与 GameScene 中 Graphics 顺序一致（审计 AP-0344）。
 */
export const MAP_OVERLAY_DEPTH = {
  floorSelection: 32,
  floorSelectionDraft: 34,
  taskMarkerGraphics: 40,
  taskMarkerLabel: 41
} as const;
