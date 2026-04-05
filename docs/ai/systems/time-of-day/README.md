# time-of-day 系统入口

## 系统职责摘要

`time-of-day` 负责世界时钟、跨天归一化、HUD 时间文本和供场景层消费的昼夜调色板。

## 标准文档

- `docs/ai/system-standards/time-of-day.md`

## 当前关键实现文件

- `src/game/time-of-day.ts`

## 当前关键测试文件

- `tests/domain/time-of-day.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/time-of-day/2026-04-05-time-of-day-system.md`

## 何时必须回填

- 修改一天时长、起始时间、跨天规则或时间格式时，必须同步更新 routed aidoc。
- 修改调色板字段或场景消费契约时，必须补充 `docs/ai/integration/`。
- 若新增实现文件、测试文件或场景接入点，必须同步更新 `docs/ai/index/system-index.json`。
