# aidoc 索引入口（legacy）

`docs/ai/` 是本项目历史 aidoc 与实现索引目录，供 Agent 在修改代码、补充系统规格和准备推送远端前查询既有资料。

这里不是 `route-demand` 的权威注册表。`route-demand` 仍以 `oh-gen-doc/`、`oh-code-design/`、`oh-acceptance/` 为准；`docs/ai/index/system-index.json` 只保留 legacy implementation index，并用桥接字段连到当前代码与文档：

- `routedSystems`：这个 legacy system 对应的一级 routedSystems。
- `lookupAliases`：同一 legacy system 可被检索到的别名。
- `sharedEntryFiles`：多个系统共用、需要一起回看的入口文件。

## 使用方式

- 首先阅读本页，按照系统找到标准文档、系统入口页、关键源码文件和关键测试文件。
- 需要结构化消费时，读取同目录下的 `system-index.json`。
- 多系统需求优先走 `route-demand`，在 `oh-gen-doc/`、`oh-code-design/`、`oh-acceptance/` 中完成路由与同步。
- `push-with-aidoc` 继续读取这里的 `system-index.json`，但只把它当作 legacy implementation lookup。
- 当实现侧改动跨过系统边界时，先让 route-demand 定义权威拆分，再回填这里的桥接字段。

## 系统总表

| system | routedSystems | 职责摘要 | 标准文档 | 系统 aidoc 目录 | 关键源码文件 | 关键测试文件 | 主要场景/接入文件 | 最近相关 aidoc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `time-of-day` | `时间系统` | 维护世界时间、跨天归一化与昼夜调色板 | `docs/ai/system-standards/time-of-day.md` | `docs/ai/systems/time-of-day/` | `src/game/time/time-of-day.ts`、`src/game/time/world-time.ts` | `tests/domain/time-of-day.test.ts` | `src/scenes/GameScene.ts`、`src/scenes/game-scene-hud-sync.ts` | `docs/ai/systems/time-of-day/2026-04-05-time-of-day-system.md` |
| `world-core` | `实体系统 / 工作系统 / 建筑系统 / 时间系统` | 维护统一世界真相源、实体占用、工作闭环和建造落地 | `docs/ai/system-standards/world-core.md` | `docs/ai/systems/world-core/` | `src/game/world-core.ts`、`src/game/map/world-seed.ts`、`src/game/world-sim-bridge.ts` | `tests/domain/world-core.test.ts`、`tests/domain/apply-domain-command.test.ts`、`tests/game/world-sim-bridge.test.ts` | `src/scenes/GameScene.ts`、`src/game/world-bootstrap.ts` | `docs/ai/systems/world-core/2026-04-05-a-line-world-core-and-build-loop.md` |
| `pawn-state` | `实体系统 / 行为系统` | 维护角色基础状态、名字、移动过渡和显示派生字段 | `docs/ai/system-standards/pawn-state.md` | `docs/ai/systems/pawn-state/` | `src/game/pawn-state.ts`、`src/game/behavior/sim-loop.ts`、`src/scenes/renderers/pawn-renderer.ts` | `tests/domain/pawn-state.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md` |
| `scene-hud` | `UI系统` | 维护 HUD、状态卡、按钮和场景内信息展示 | `docs/ai/system-standards/scene-hud.md` | `docs/ai/systems/scene-hud/` | `src/ui/hud-manager.ts`、`src/data/villager-tools.ts`、`src/data/player-acceptance-scenarios.ts` | `tests/component/villager-tool-bar-model.test.ts`、`tests/component/mock-task-marker-commands.test.ts`、`tests/scene-hud-markup.test.ts` | `src/scenes/GameScene.ts`、`src/scenes/game-scene-hud-sync.ts`、`src/scenes/game-scene-acceptance-ui.ts` | `docs/ai/systems/scene-hud/2026-04-05-time-of-day-system.md` |
| `selection-ui` | `UI系统 / 交互系统 / 地图系统` | 维护选中、高亮、焦点和目标切换反馈 | `docs/ai/system-standards/selection-ui.md` | `docs/ai/systems/selection-ui/` | `src/game/interaction/floor-selection.ts`、`src/player/brush-stroke.ts`、`src/scenes/renderers/selection-renderer.ts` | `tests/domain/floor-selection.test.ts`、`tests/component/mock-task-marker-selection.test.ts`、`tests/data/task-markers-merge.test.ts` | `src/scenes/GameScene.ts`、`src/scenes/game-scene-floor-interaction.ts` | `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md` |
| `task-planning` | `行为系统 / 需求系统 / 工作系统` | 维护目标评估、工作选择和游荡决策 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/` | `src/game/behavior/wander-planning.ts`、`src/game/behavior/goal-driven-planning.ts`、`src/game/world-sim-bridge.ts` | `tests/domain/wander-planning.test.ts`、`tests/domain/goal-driven-planning.test.ts`、`tests/game/world-sim-bridge.test.ts` | `src/scenes/GameScene.ts`、`src/game/behavior/index.ts` | `docs/ai/systems/task-planning/2026-04-05-random-stone-obstacles.md` |
| `world-grid` | `地图系统 / 交互系统` | 维护格子地图尺寸、相邻格子、边界和出生点 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/` | `src/game/map/world-grid.ts`、`src/game/map/occupancy-manager.ts`、`src/game/map/zone-manager.ts` | `tests/domain/world-grid.test.ts`、`tests/domain/world-grid-line.test.ts` | `src/scenes/GameScene.ts`、`src/game/map/index.ts` | `docs/ai/systems/world-grid/2026-04-05-floor-area-selection-foundation.md` |

## 推送前检查

- `push-with-aidoc` 必须首先读取 `docs/ai/index/system-index.json`。
- 根据待推送的改动映射受影响的系统，然后再回填对应的系统 `README.md`、最新的 aidoc 和必要的集成文档。
- `routedSystems`、`lookupAliases` 和 `sharedEntryFiles` 都是桥接字段，不是 `route-demand` 的权威注册表。
- 通过受控推送流程推送远端之后，最新的提交应当带有 `[aidoc-sync]` 前缀和固定的 `AIDOC-*` 追踪标签。
