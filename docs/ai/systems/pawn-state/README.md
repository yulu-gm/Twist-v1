# pawn-state 系统入口

## 系统职责摘要

`pawn-state` 负责角色基础状态、名字、逻辑格位置、移动过渡和供场景层读取的显示派生字段。

## 标准文档

- `docs/ai/system-standards/pawn-state.md`

## 当前关键实现文件

- `src/game/pawn-state.ts`

## 当前关键测试文件

- `tests/domain/pawn-state.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md`

## 何时必须回填

- 修改角色名字、基础状态字段、移动插值或显示派生规则时，必须同步更新 routed aidoc。
- 修改角色状态对其他系统暴露的契约时，必须补充 `docs/ai/integration/`。
- 若新增实现文件、测试文件或场景接入点，必须同步更新 `docs/ai/index/system-index.json`。

