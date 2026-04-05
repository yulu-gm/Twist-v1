# pawn-state 系统入口

## 系统职责摘要

`pawn-state` 负责角色基础状态、名字、逻辑格子位置、移动过渡和供场景层读取的显示派生字段。当前它仍是角色状态权威源，tick 级编排由 `sim-loop` 接手，场景消费改为通过渲染器读取显示状态。

## 标准文档

- `docs/ai/system-standards/pawn-state.md`

## 当前关键实现文件

- `src/game/pawn-state.ts`
- `src/game/sim-loop.ts`
- `src/scenes/renderers/pawn-renderer.ts`

## 当前关键测试文件

- `tests/domain/pawn-state.test.ts`

## 当前接入场景文件

- `src/scenes/renderers/pawn-renderer.ts`

## 最新与历史人工智能文档

- `docs/ai/systems/pawn-state/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md`
- `docs/ai/systems/pawn-state/2026-04-05-goal-driven-pawn-ai-prototype.md`

## 何时必须回填

- 修改角色名字、基础状态字段、移动插值或显示派生规则时，必须同步更新路由的人工智能文档。
- 修改角色状态对其他系统暴露的契约时，必须补充 `docs/ai/integration/`。
- 如果新增实现文件、测试文件或场景接入点，必须同步更新 `docs/ai/index/system-index.json`。
