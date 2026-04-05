# time-of-day 系统入口

## 系统职责摘要

`time-of-day` 负责世界时钟、跨天归一化和昼夜调色板采样，是时间语义的唯一权威。`GameScene` 只做编排，HUD、文本和场景表现分别消费它输出的状态。

## 标准文档

- `docs/ai/system-standards/time-of-day.md`

## 当前关键实现文件

- `src/game/time-of-day.ts`（世界时钟、跨天归一化、调色板采样的权威实现）
- `src/ui/hud-manager.ts`（时间文案与 HUD 同步的消费端）
- `src/scenes/GameScene.ts`（仅做运行时编排，把时间状态和调色板分发给场景层）

## 当前关键测试文件

- `tests/domain/time-of-day.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/time-of-day/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/time-of-day/2026-04-05-time-of-day-system.md`

## 何时必须回填

- 修改一天时长、起始时间、跨天规则或者时间格式时，必须同步更新路由的 aidoc。
- 修改调色板字段或者场景消费契约时，必须补充 `docs/ai/integration/`。
- 如果新增实现文件、测试文件或者场景接入点，必须同步更新 `docs/ai/index/system-index.json`。
