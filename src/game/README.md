# 游戏领域层（`src/game`）

与 Phaser 解耦的模拟与规则代码放在此目录。顶层保留世界编排与聚合入口（如 `world-core.ts`、`world-sim-bridge.ts`、`pawn-state.ts`）；具体子域按文件夹拆分。

## 子系统目录

| 目录 | 职责概要 |
|------|----------|
| `map/` | 格子几何、占用、障碍种子（`world-grid.ts`、`world-seed.ts`）；对外可经 `map/index.ts` 聚合导出 |
| `time/` | 昼夜与世界时钟（`time-of-day.ts`、`world-time.ts`）；对外可经 `time/index.ts` |
| `behavior/` | 仿真 tick、游荡与目标规划、仿真配置（`sim-loop.ts`、`wander-planning.ts`、`goal-driven-planning.ts`、`sim-config.ts`）；对外可经 `behavior/index.ts` |
| `need/` | 需求数值与紧急度信号（`need-utils.ts`、`need-signals.ts`） |
| `interaction/` | 玩家地面选区等与交互域相关的逻辑（`floor-selection.ts` 等） |
| `building/` | 蓝图放置等建造侧规则 |
| `work/` | 工作单状态与结算 |
| `entity/` | 实体类型、注册表、生命周期与关系约束 |

## 导入约定

- **优先**从子目录内的实现文件或该子目录的 `index.ts` 引入，避免依赖已删除的顶层 re-export 桩路径。
- **地图**：`import { … } from "./map"` 或 `from "./map/world-grid"` / `from "./map/world-seed"`。
- **时间**：`import { … } from "./time"` 或 `from "./time/time-of-day"`。
- **行为 / 仿真步进**：`import { … } from "./behavior"` 或 `from "./behavior/sim-loop"` 等。
- **交互选区**：`from "./interaction/floor-selection"`（或 `interaction/index`）。
- **实体 / 需求 / 工作 / 建造**：`from "./entity"`、`from "./need"`、`from "./work"`、`from "./building"` 或对应子路径。

编排层（如 `GameScene`）可组合上述 barrel 与 `world-sim-bridge`，以保持场景代码薄。
