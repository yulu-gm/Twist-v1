# world-core 系统入口

## 系统职责摘要

`world-core` 负责 A 线的统一世界真相源：可序列化实体快照、占用索引、带暂停/调速/昼夜语义的世界时钟，以及标记/蓝图到工作单和建造结果的闭环。它面向其他系统暴露只读快照和命令处理结果，不把 UI 或行为编排逻辑混进来。

## 路由桥接

- `routedSystems`：`实体系统`、`工作系统`、`建筑系统`、`时间系统`
- `lookupAliases`：`world-core`、`world`、`world-state`、`entity-core`
- `sharedEntryFiles`：`src/game/world-bootstrap.ts`、`src/game/world-sim-bridge.ts`、`src/game/map/index.ts`、`src/game/time/index.ts`

这页仍然是 legacy implementation lookup，不是 `route-demand` 的权威注册表。只要世界快照、工作闭环或建造产物继续复用这批入口，就继续在这里回填桥接字段和路径。

## 标准文档

- `docs/ai/system-standards/world-core.md`

## 当前关键实现文件

- `src/game/world-core.ts`（世界真相源、可序列化投影、时间事件、工作锁定/去重与建造落地的权威实现）
- `src/game/map/world-seed.ts`（将 `blockedCellKeys` 同步为障碍实体，供与世界网格一致）
- `src/game/map/world-grid.ts`（提供格子键与边界语义，供 `world-core` 复用）
- `src/game/world-sim-bridge.ts`（从世界快照推导模拟用障碍格与床位交互点；由场景调用）
- `src/player/world-port-types.ts`、`src/player/world-core-world-port.ts`、`src/player/apply-domain-command.ts`（玩家领域命令网关与落地）

## 当前关键测试文件

- `tests/domain/world-core.test.ts`
- `tests/domain/apply-domain-command.test.ts`
- `tests/game/world-sim-bridge.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`（`WorldCoreWorldPort`、时间推进与每帧网格同步）
- `src/game/world-bootstrap.ts`

## 最新/历史 aidoc

- `docs/ai/systems/world-core/2026-04-05-a-line-world-core-and-build-loop.md`
- `docs/ai/systems/world-core/2026-04-05-worldcore-gateway-and-sim-bridge.md`

## 何时必须回填

- 修改实体快照字段、时间快照字段、占用冲突语义、工作单状态流或建造产物时，必须同步更新路由的 aidoc。
- 修改 `world-core` 对其他系统暴露的只读快照或命令返回值时，必须补充 `docs/ai/integration/`。
- 如果新增关键实现文件、测试文件或正式接入场景，必须同步更新 `docs/ai/index/system-index.json`。
