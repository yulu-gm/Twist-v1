## 主题

`2026-04-05-default-grid-wandering-pawns`

## 原始需求

给游戏创建一个默认的 grid 地图。

在地图上默认创建 5 个小人，小人可以用一个圈来表示，头顶显示名字。

5 个小人的名字分别为：`Alex`、`VC`、`toastoffee`、`yulu`、`SG`。

小人只有一个游荡的行为。

补充确认：

- 小人只能按照格子来移动。
- 移动的过程是平滑插值的。
- 当前仓库还没有做好系统拆分和子系统规范，本次需求允许先做简单拆分和规范制作。

## route-demand 路由结果

- 玩家目标：打开游戏后，立即看到一张默认 grid 地图和 5 个会自己游荡的命名角色原型。
- 输入动作：当前无需玩家操作，原型在场景创建后自动出现并开始游荡。
- 画面反馈：玩家看到格子地图、5 个圆形角色、角色头顶名字，以及按格移动但视觉平滑的游荡过程。
- 状态承诺：
  - 世界存在统一的格子坐标系和默认出生点。
  - 角色逻辑位置始终对齐格子，显示位置可在两格中心之间插值。
  - AI 当前只承诺单一行为“游荡到合法邻格”，不引入更复杂规划。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `world-grid` | 玩家看到稳定的默认 grid 地图，角色会对齐格子中心 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/2026-04-05-default-grid-wandering-pawns.md` | `domain` |
| `pawn-state` | 玩家看到 5 个命名角色，并且角色移动表现平滑 | `docs/ai/system-standards/pawn-state.md` | `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md` | `domain` |
| `task-planning` | 玩家看到角色持续按格游荡，不越界、不跨格 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/2026-04-05-default-grid-wandering-pawns.md` | `domain` |

## 依赖系统

- `scene-hud`：本次没有新增 HUD 面板或按钮，不单独产出 aidoc。
- `selection-ui`：本次没有选中、切换或交互高亮需求，不单独产出 aidoc。

## SubAgent 分派计划

- `world-grid` → 读取 `docs/ai/system-standards/world-grid.md`，写回 `docs/ai/systems/world-grid/2026-04-05-default-grid-wandering-pawns.md`
- `pawn-state` → 读取 `docs/ai/system-standards/pawn-state.md`，写回 `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md`
- `task-planning` → 读取 `docs/ai/system-standards/task-planning.md`，写回 `docs/ai/systems/task-planning/2026-04-05-default-grid-wandering-pawns.md`

## 汇总注意事项

- 本次允许 UI-first 表现层先把圆形角色和名字渲染出来，但不能绕过 `world-grid` / `pawn-state` / `task-planning` 的边界直接把规则塞进场景层。
- 游荡规则必须保留可注入随机源的接口，以便后续 `domain` 测试稳定控制。
- 当前不引入地图障碍、需求系统、任务队列和选中交互，避免原型 scope 膨胀。
