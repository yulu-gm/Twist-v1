# 集成备注：模拟掉落物（2026-04-05）

## 摘要

场景在格子上绘制临时掉落物堆叠，数据与查询在 `src/scenes/mock-ground-items.ts`，悬停文案在 `mock-grid-cell-info` 中与地形/通行状态拼接。

## 系统交界

- **world-grid**：堆叠按照 `GridCoord` 定位；与障碍/交互点无自动冲突校验（原型阶段可以由手工选址避免重叠）。
- **scene-hud**：线框与文字属于场景信息展示；详细约定参见 `docs/ai/systems/scene-hud/2026-04-05-mock-ground-items.md`。

## 后续若进入模拟层

掉落物如果需要纳入权威世界状态，应当按照 `route-demand` 拆分系统 aidoc，在 `src/game/` 建模并且补充领域测试，再替换场景侧模拟。
