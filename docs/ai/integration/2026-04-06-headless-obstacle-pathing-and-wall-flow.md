## 主题

`2026-04-06-headless-obstacle-pathing-and-wall-flow`

## 行为摘要

1. 障碍格来自世界快照中的阻挡集合；小人向交互点移动时不得踏入这些格子（无头场景校验移动轨迹）。
2. `world-sim-bridge` 与 `world-work-tick` 在世界 tick 内保持模拟侧障碍、工时与工单状态与世界核心一致。
3. 笔画式建墙的玩家路径与无头期望对齐；`GameScene` 通过 `building-renderer` 绘制落地建筑占位。

## 参与系统

- `world-core`：快照、工单与 tick 编排入口。
- `world-grid`：阻挡格语义与场景网格绘制相关渲染。
- `task-planning`：目标驱动规划与 `game-orchestrator` 调度。
- `pawn-state`：移动与目标表现的模拟侧输入。
- `scene-hud` / `selection-ui`：玩家命令、选区与场景装载（含 `scenario-loader` 扩展）。
- `time-of-day`：`GameScene` 时间轴仍驱动呈现同步（本次变更触及场景挂载点）。

## 关键实现与测试

- `scenarios/obstacle-avoidance-eat.scenario.ts`、`tests/headless/obstacle-avoidance.test.ts`
- `src/game/world-work-tick.ts`、`src/headless/scenario-runner.ts`、`src/scenes/renderers/building-renderer.ts`
