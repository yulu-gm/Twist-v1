# world-grid：线段覆盖格枚举

## 背景

笔刷在格中心之间移动时，需要沿网格线段收集所有经过的格子，避免仅记录端点。

## 实现要点

- `gridLineCells(from, to)`：轴对齐步进，适合正交网格上的栅格线行走。
- 单测：`tests/domain/world-grid-line.test.ts`。

## 相关

- `src/player/brush-stroke.ts` 在 `extendBrushStroke` 中合并线段格键。
