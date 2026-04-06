# aidoc 索引入口（legacy）

`docs/ai/` 是本项目历史 aidoc 与实现索引目录，供 Agent 在修改代码、补充系统规格和准备推送远端前查询既有资料。

## 使用方式

- 首先阅读本页，按照系统找到标准文档、系统入口页、关键源码文件和关键测试文件。
- 需要结构化消费时，读取同目录下的 `system-index.json`。
- 多系统需求优先执行 `route-demand`，先在 `oh-gen-doc/`、`oh-code-design/`、`oh-acceptance/` 中完成路由与同步。
- `docs/ai/index/system-index.json` 仅作为 legacy 实现索引参考，不再是 `route-demand` 的权威注册表。
- 准备推送远端前再执行 `push-with-aidoc`。

## 系统总表

| system | 职责摘要 | 标准文档 | 系统 aidoc 目录 | 关键源码文件 | 关键测试文件 | 主要场景/接入文件 | 最近相关 aidoc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `time-of-day` | 维护世界时间、跨天归一化与昼夜调色板 | `docs/ai/system-standards/time-of-day.md` | `docs/ai/systems/time-of-day/` | `src/game/time-of-day.ts` | `tests/domain/time-of-day.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/time-of-day/2026-04-05-time-of-day-system.md` |
| `world-core` | 维护统一世界真相源、实体占用、工作闭环和建造落地 | `docs/ai/system-standards/world-core.md` | `docs/ai/systems/world-core/` | `src/game/world-core.ts` | `tests/domain/world-core.test.ts` | 暂无 | `docs/ai/systems/world-core/2026-04-05-a-line-world-core-and-build-loop.md` |
| `pawn-state` | 维护角色基础状态、名字、移动过渡和显示派生字段 | `docs/ai/system-standards/pawn-state.md` | `docs/ai/systems/pawn-state/` | `src/game/pawn-state.ts` | `tests/domain/pawn-state.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md` |
| `scene-hud` | 维护 HUD、状态卡、菜单和场景信息展示 | `docs/ai/system-standards/scene-hud.md` | `docs/ai/systems/scene-hud/` | `src/scenes/villager-tool-bar-config.ts` | `tests/component/villager-tool-bar-model.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/scene-hud/2026-04-05-time-of-day-system.md` |
| `selection-ui` | 维护选中、高亮、焦点和目标切换反馈 | `docs/ai/system-standards/selection-ui.md` | `docs/ai/systems/selection-ui/` | `src/game/floor-selection.ts` | `tests/domain/floor-selection.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md` |
| `task-planning` | 维护目标评估、工作选择和游荡决策 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/` | `src/game/wander-planning.ts` | `tests/domain/wander-planning.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/task-planning/2026-04-05-random-stone-obstacles.md` |
| `world-grid` | 维护格子地图尺寸、相邻格子、边界和出生点 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/` | `src/game/world-grid.ts` | `tests/domain/world-grid.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/world-grid/2026-04-05-floor-area-selection-foundation.md` |

## 推送前检查

- `push-with-aidoc` 必须首先读取 `docs/ai/index/system-index.json`。
- 根据待推送的改动映射受影响的系统，然后再回填对应的系统 `README.md`、最新的 aidoc 和必要的集成文档。
- 通过受控推送流程推送远端之后，最新的提交应当带有 `[aidoc-sync]` 前缀和固定的 `AIDOC-*` 追踪标签。
