# 游戏领域层（`src/game`）

与 Phaser 解耦的模拟与规则代码放在此目录。**顶层**在 `world-core.ts`、`world-sim-bridge.ts`、`pawn-state.ts` 等聚合与桥接入口之外，`game-orchestrator.ts` 串联领域仿真步进与世界状态推进；`world-work-tick.ts`、`world-construct-tick.ts` 分别承载工作与建造向 tick 切片；`world-bootstrap.ts` 负责世界启动与编排端口的组装（注入用 `OrchestratorWorldBridge` 等类型定义在 `src/player/orchestrator-world-bridge.ts`，已自本目录迁出）。具体子域按文件夹拆分。

## 子系统目录

| 目录 | 职责概要 |
|------|----------|
| `map/` | 格子几何、占用、障碍种子（`world-grid.ts`、`world-seed.ts`）；对外可经 `map/index.ts` 聚合导出 |
| `time/` | 昼夜与世界时钟（`time-of-day.ts`、`world-time.ts`）；对外可经 `time/index.ts` |
| `behavior/` | 仿真 tick、游荡与目标规划、仿真配置（`sim-loop.ts`、`wander-planning.ts`、`goal-driven-planning.ts`、`sim-config.ts`）；对外可经 `behavior/index.ts` |
| `flows/` | 跨子系统用例/流程编排（对应 `oh-code-design` 行为等文档中的关键协同流程）：`night-rest-flow.ts`（夜晚休息）、`need-interrupt-flow.ts`（需求打断工作）、`build-flow.ts`、`chop-flow.ts` |
| `need/` | 需求数值与紧急度信号（`need-utils.ts`、`need-signals.ts`） |
| `interaction/` | 交互域核心：`mode-registry`（模式注册表）、`session-manager`（选区/交互会话）、`floor-selection`（地面选区状态）、`domain-command-types`（领域命令形状）。与 `oh-code-design/交互系统.yaml` 中的交互模式层、选区会话、意图侧类型对齐；**不**再导出 `src/player/`（避免 game 包反向透出 UI/玩家线实现）。 |
| `building/` | 蓝图放置等建造侧规则 |
| `work/` | 工作单状态与结算 |
| `entity/` | 实体类型、注册表、生命周期与关系约束 |

## 导入约定

- **优先**从子目录内的实现文件或该子目录的 `index.ts` 引入，避免依赖已删除的顶层 re-export 桩路径。
- **地图**：`import { … } from "./map"` 或 `from "./map/world-grid"` / `from "./map/world-seed"`。
- **时间**：`import { … } from "./time"` 或 `from "./time/time-of-day"`。
- **行为 / 仿真步进**：`import { … } from "./behavior"` 或 `from "./behavior/sim-loop"` 等。
- **交互（game 核心）**：`from "./interaction"` 或按需 `from "./interaction/floor-selection"` 等；barrel 仅含上表所列本目录符号。
- **玩家线适配（命令生成、提交世界、呈现策略）**：从 `src/player/` 对应模块引入（如 `build-domain-command`、`commit-player-intent`、`apply-domain-command`），勿通过 `game/interaction` 二次导出聚合；与「输入采集贴近 UI、领域交互在 game」的依赖方向一致。
- **实体 / 需求 / 工作 / 建造**：`from "./entity"`、`from "./need"`、`from "./work"`、`from "./building"` 或对应子路径。

编排层（如 `GameScene`）可组合上述 barrel 与 `world-sim-bridge`，以保持场景代码薄。
