# world-core 系统入口

## 系统职责摘要

`world-core` 负责 A 线的统一世界真相源：可序列化实体快照、占用索引、带暂停/调速/昼夜语义的世界时钟，以及标记/蓝图到工作单和建造结果的闭环。它面向其他系统暴露只读快照和命令处理结果，不把 UI 或行为编排逻辑混进来。

## 标准文档

- `docs/ai/system-standards/world-core.md`

## 当前关键实现文件

- `src/game/world-core.ts`（世界真相源、可序列化投影、时间事件、工作锁定/去重与建造落地的权威实现）
- `src/game/world-grid.ts`（提供格子键与边界语义，供 `world-core` 复用）
- `src/game/time-of-day.ts`（提供时间推进与暂停/调速语义，供 `world-core` 复用）

## 当前关键测试文件

- `tests/domain/world-core.test.ts`

## 当前接入场景文件

- 暂无；当前先通过 domain tests 和命令回放验证

## 最新/历史 aidoc

- `docs/ai/systems/world-core/2026-04-05-a-line-world-core-and-build-loop.md`

## 何时必须回填

- 修改实体快照字段、时间快照字段、占用冲突语义、工作单状态流或建造产物时，必须同步更新路由的 aidoc。
- 修改 `world-core` 对其他系统暴露的只读快照或命令返回值时，必须补充 `docs/ai/integration/`。
- 如果新增关键实现文件、测试文件或正式接入场景，必须同步更新 `docs/ai/index/system-index.json`。
