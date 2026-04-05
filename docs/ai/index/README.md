# aidoc 索引入口

`docs/ai/` 是本项目的 aidoc 主目录，供 Agent 在修改代码、补系统规格和准备推送远端前统一查询。

## 使用方式

- 先看本页，按系统找到标准文档、系统入口页、关键源码文件和关键测试文件。
- 需要结构化消费时，读取同目录下的 `system-index.json`。
- 多系统需求先走 `route-demand`，准备推送远端前再走 `push-with-aidoc`。

## 系统总表

| system | 职责摘要 | 标准文档 | 系统 aidoc 目录 | 关键源码文件 | 关键测试文件 | 主要场景/接入文件 | 最近相关 aidoc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pawn-state` | 维护角色基础状态、名字、移动过渡和显示派生字段 | `docs/ai/system-standards/pawn-state.md` | `docs/ai/systems/pawn-state/` | `src/game/pawn-state.ts` | `tests/domain/pawn-state.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md` |
| `scene-hud` | 维护 HUD、状态卡、菜单和场景信息展示 | `docs/ai/system-standards/scene-hud.md` | `docs/ai/systems/scene-hud/` | 暂无已登记实现文件 | 暂无已登记测试 | `src/scenes/GameScene.ts` | 暂无 routed aidoc |
| `selection-ui` | 维护选中、高亮、焦点和目标切换反馈 | `docs/ai/system-standards/selection-ui.md` | `docs/ai/systems/selection-ui/` | 暂无已登记实现文件 | 暂无已登记测试 | `src/scenes/GameScene.ts` | 暂无 routed aidoc |
| `task-planning` | 维护目标评估、工作选择和游荡决策 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/` | `src/game/wander-planning.ts` | `tests/domain/wander-planning.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/task-planning/2026-04-05-random-stone-obstacles.md` |
| `world-grid` | 维护格子地图尺寸、邻格、边界和出生点 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/` | `src/game/world-grid.ts` | `tests/domain/world-grid.test.ts` | `src/scenes/GameScene.ts` | `docs/ai/systems/world-grid/2026-04-05-random-stone-obstacles.md` |

## push 前检查

- `push-with-aidoc` 必须先读取 `docs/ai/index/system-index.json`。
- 根据待推送改动映射受影响系统，再回填对应系统 `README.md`、最新 aidoc 和必要的集成文档。
- 通过受控推送流程推送远端后，最新提交应带有 `[aidoc-sync]` 前缀和固定 `AIDOC-*` trailer。

