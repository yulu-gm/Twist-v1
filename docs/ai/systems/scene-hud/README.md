# scene-hud 系统入口

## 系统职责摘要

`scene-hud` 负责 HUD、状态卡、按钮和场景内信息展示。当前 GameScene 运行时已拆成场景编排 + 抽出的 HUD/data 模块，玩家可见行为不变。

## 标准文档

- `docs/ai/system-standards/scene-hud.md`

## 当前关键实现文件

- `src/ui/hud-manager.ts`（time HUD、hover info、tool bar、roster、pawn detail 的 DOM 交互）
- `src/data/villager-tools.ts`
- `src/data/ground-items.ts`
- `src/data/grid-cell-info.ts`
- `src/data/task-markers.ts`
- `src/data/pawn-profiles.ts`
- `src/scenes/GameScene.ts`（仅负责布局、输入和状态 wiring）
- `src/scenes/villager-tool-bar-config.ts`（已弃用的兼容前向）
- `src/scenes/mock-villager-tools.ts`（已弃用的兼容前向）
- `src/scenes/mock-ground-items.ts`（已弃用的兼容前向）
- `src/scenes/mock-grid-cell-info.ts`（已弃用的兼容前向）
- `src/scenes/mock-task-marker-commands.ts`（已弃用的兼容前向）
- `src/scenes/mock-task-marker-selection.ts`（已弃用的兼容前向）
- `src/scenes/mock-pawn-profile-data.ts`（已弃用的兼容前向）

## 当前关键测试文件

- `tests/component/villager-tool-bar-model.test.ts`
- `tests/component/mock-task-marker-commands.test.ts`
- `tests/component/mock-task-marker-selection.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/scene-hud/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/scene-hud/2026-04-05-mock-ground-items.md`
- `docs/ai/systems/scene-hud/2026-04-05-villager-tool-bar.md`
- `docs/ai/systems/scene-hud/2026-04-05-mock-task-markers-on-grid.md`
- `docs/ai/systems/scene-hud/2026-04-05-pawn-roster-detail-panel.md`
- `docs/ai/systems/scene-hud/2026-04-05-time-of-day-system.md`

## 何时必须回填

- 新增 HUD、状态卡、按钮或场景信息展示时，必须先补充路由的人工智能文档。
- 若实现文件、测试文件或场景接入点出现，必须同步更新 `docs/ai/index/system-index.json`。
- 若信息展示改变玩家路径或跨系统反馈，必须补充 `docs/ai/integration/`。
