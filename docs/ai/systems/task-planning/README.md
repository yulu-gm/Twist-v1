# task-planning 系统入口

## 系统职责摘要

`task-planning` 负责目标评估、工作选择、游荡决策和可执行动作候选，是当前角色自主行为的规则入口。现在目标驱动规划、游荡规划、配置常量和 tick 编排分别由独立模块承载。

## 标准文档

- `docs/ai/system-standards/task-planning.md`

## 当前关键实现文件

- `src/game/goal-driven-planning.ts`
- `src/game/wander-planning.ts`
- `src/game/sim-config.ts`
- `src/game/sim-loop.ts`
- `src/game/world-sim-bridge.ts`（由 `GameScene` 调用：将 `WorldCore` 障碍与 `restSpots` 写入传入本系统 tick 的 `WorldGridConfig`）

## 当前关键测试文件

- `tests/domain/wander-planning.test.ts`
- `tests/domain/goal-driven-planning.test.ts`
- `tests/game/world-sim-bridge.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/task-planning/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/task-planning/2026-04-05-random-stone-obstacles.md`
- `docs/ai/systems/task-planning/2026-04-05-default-grid-wandering-pawns.md`
- `docs/ai/systems/task-planning/2026-04-05-goal-driven-pawn-ai-prototype.md`

## 何时必须回填

- 修改目标选择、合法候选过滤、等待分支或规划结果格式时，必须同步更新路由的人工智能文档。
- 如果行为规划影响其他系统的契约或玩家路径，必须补充 `docs/ai/integration/`。
- 如果新增实现文件、测试文件或场景接入点，必须同步更新 `docs/ai/index/system-index.json`。
