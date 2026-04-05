## 主题

`2026-04-05-default-grid-wandering-pawns`

## 原始需求

为游戏创建一张默认的网格地图。

在地图上默认创建五个角色，角色可以使用一个圆形来表示，头顶显示名字。

五个角色的名字分别为：`Alex`、`VC`、`toastoffee`、`yulu`、`SG`。

角色仅具备一种游荡的行为。

补充确认：

- 角色只能按照格子进行移动。
- 移动的过程是平滑插值的。
- 当前代码仓库尚未完成系统拆分与子系统规范，本次需求允许优先进行简单的拆分与规范制作。

## route-demand 路由结果

- 玩家目标：打开游戏之后，立即看到一张默认的网格地图以及五个会自动游荡的命名角色原型。
- 输入动作：当前不需要玩家进行操作，原型在场景创建之后会自动出现并且开始游荡。
- 画面反馈：玩家看到网格地图、五个圆形角色、角色头顶的名字，以及按照格子移动但是视觉表现平滑的游荡过程。
- 状态承诺：
  - 世界存在统一的格子坐标系与默认出生点。
  - 角色逻辑位置始终对齐格子，显示位置可以在两个格子中心之间进行插值。
  - 人工智能当前仅仅承诺单一行为“游荡到合法的相邻格子”，不引入更加复杂的规划。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认失败的测试 |
| --- | --- | --- | --- | --- |
| `world-grid` | 玩家看到稳定的默认网格地图，角色会对齐格子中心 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/2026-04-05-default-grid-wandering-pawns.md` | `domain` |
| `pawn-state` | 玩家看到五个命名角色，并且角色移动表现平滑 | `docs/ai/system-standards/pawn-state.md` | `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md` | `domain` |
| `task-planning` | 玩家看到角色持续按照格子游荡，不越界、不跨越格子 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/2026-04-05-default-grid-wandering-pawns.md` | `domain` |

## 依赖系统

- `scene-hud`：本次没有新增平视显示器面板或者按钮，不单独产出 aidoc。
- `selection-ui`：本次没有选中、切换或者交互高亮需求，不单独产出 aidoc。

## 子智能体分派计划

- `world-grid` → 读取 `docs/ai/system-standards/world-grid.md`，写回 `docs/ai/systems/world-grid/2026-04-05-default-grid-wandering-pawns.md`
- `pawn-state` → 读取 `docs/ai/system-standards/pawn-state.md`，写回 `docs/ai/systems/pawn-state/2026-04-05-default-grid-wandering-pawns.md`
- `task-planning` → 读取 `docs/ai/system-standards/task-planning.md`，写回 `docs/ai/systems/task-planning/2026-04-05-default-grid-wandering-pawns.md`

## 汇总注意事项

- 本次允许用户界面优先的表现层优先将圆形角色与名字渲染出来，但是不能绕过 `world-grid`、`pawn-state`、`task-planning` 的边界直接将规则放入场景层。
- 游荡规则必须保留可以注入随机数据源的接口，以便后续的 `domain` 测试能够稳定控制。
- 当前不引入地图障碍、需求系统、任务队列以及选中交互，避免原型范围发生膨胀。
