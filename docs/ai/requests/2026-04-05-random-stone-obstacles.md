# 路由后主控需求单

## 主题

`2026-04-05-random-stone-obstacles`

## 原始需求

在地图上随机生成一点石头。（用户通过 `@TWIST.md` 引入，要求后续变更按仓库 Agent 流程执行。）

## route-demand 路由结果

- **玩家目标**：开局看到地图上散落的环境障碍（石头），角色不会走进这些格子。
- **输入动作**：无额外操作；障碍在场景创建时生成。
- **画面反馈**：部分格子上出现可视化的石头块；小人持续游荡时会绕行。
- **状态承诺**：阻挡语义由 `world-grid` 的可走规则承载；游荡候选由 `task-planning`（`wander-planning`）过滤不可走邻格；表现层仅负责绘制，不另立一套格语义。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `world-grid` | 地图配置可携带阻挡格；可走判断与随机抽样不放行出生格 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/2026-04-05-random-stone-obstacles.md` | domain |
| `task-planning` | 游荡时不得把阻挡格当作合法邻格目标 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/2026-04-05-random-stone-obstacles.md` | domain |

## 依赖系统

- `pawn-state`：仅消费移动目标格与插值；未改变其对外契约，不单独新增 aidoc。
- `scene-hud` / `selection-ui`：本需求未引入 HUD 或选中交互变更，不单独新增 aidoc。

## SubAgent 分派计划

- `world-grid` → 读 `docs/ai/system-standards/world-grid.md`，写回 `docs/ai/systems/world-grid/2026-04-05-random-stone-obstacles.md`。
- `task-planning` → 读 `docs/ai/system-standards/task-planning.md`，写回 `docs/ai/systems/task-planning/2026-04-05-random-stone-obstacles.md`。

## 汇总注意事项

- 跨系统接口：阻挡集合以 `WorldGridConfig.blockedCellKeys`（`coordKey` 格式）为单一事实来源；规划层只通过 `isWalkableCell` 感知阻挡。
- 实现已落地时，本需求单用于追认规格与合规；新增回归测试见集成文档中的 TDD 顺序。
