# world-grid 系统入口

## 系统职责摘要

`world-grid` 负责地图格子尺寸、格子坐标、相邻格子、边界、出生点和占用查询，是本项目地图几何的唯一权威。`GameScene` 只负责编排，渲染器和按格子键组织的数据消费端读取这里的结果。

## 标准文档

- `docs/ai/system-standards/world-grid.md`

## 当前关键实现文件

- `src/game/world-grid.ts`（地图几何、边界、占用与拾取语义的权威实现；包含 `cellAtWorldPixel`，提供给场景指针悬停等表现层拾取）
- `src/scenes/renderers/grid-renderer.ts`（格线/网格视觉消费端）
- `src/scenes/renderers/ground-items-renderer.ts`（地表物件视觉消费端）
- `src/scenes/renderers/selection-renderer.ts`（选区/交互视觉消费端）
- `src/data/grid-cell-info.ts`（按格键组织的格子信息消费端）
- `src/data/ground-items.ts`（按格键组织的地表物件消费端）

## 当前关键测试文件

- `tests/domain/world-grid.test.ts`
- `tests/domain/world-grid-line.test.ts`（线段覆盖格，`gridLineCells`）

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/world-grid/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/world-grid/2026-04-05-floor-area-selection-foundation.md`
- `docs/ai/systems/world-grid/2026-04-05-random-stone-obstacles.md`
- `docs/ai/systems/world-grid/2026-04-05-default-grid-wandering-pawns.md`
- `docs/ai/systems/world-grid/2026-04-05-goal-driven-pawn-ai-prototype.md`
- `docs/ai/systems/world-grid/2026-04-05-grid-line-segment-cells.md`

## 何时必须回填

- 修改格子尺寸、相邻格子、边界、出生点或者占用判断时，必须同步更新路由的 aidoc。
- 修改地图系统与其他系统的接口承诺时，必须补充 `docs/ai/integration/`。
- 如果新增地图加载方式或者系统定位方式，必须同步更新 `docs/ai/index/system-index.json`。
