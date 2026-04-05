# 路由后主控需求单

## 主题

`2026-04-05-floor-area-selection-foundation`

## 原始需求

给 V1 项目添加一个鼠标框选地板的功能，方便以后实现类似环世界的区域类型设置功能。比如框选一块区域后，可以修改他的区域类型为存储区；框选要支持 Shift 框选后与现有框选区域合并，也要支持 Ctrl 选择，选择或者框选新区域后可以添加/剔除新区域，操作逻辑符合直觉。

本轮经确认只实现“选区底座”，不实现真实区域类型写入或 HUD 操作链。

## route-demand 路由结果

- **玩家目标**：在地图上通过点击或拖拽稳定地选中一块地板区域，为后续区域类型设置打基础。
- **输入动作**：鼠标左键单击、拖拽框选；`Shift` 扩选并集；`Ctrl` 按格切换增删；点击网格外空白处清空。
- **画面反馈**：当前选区立即高亮；拖拽中显示草稿预览；`Ctrl` 预览能区分“将添加”和“将剔除”的格子。
- **状态承诺**：选区状态由独立的 `selection-ui` 纯状态承载；格子命中与矩形展开由 `world-grid` 统一计算；`GameScene` 只负责编排输入与绘制，不另立一套区域选择规则。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `selection-ui` | 玩家可通过单击/框选/修饰键稳定建立、合并或切换当前地板选区 | `docs/ai/system-standards/selection-ui.md` | `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md` | acceptance |
| `world-grid` | 玩家拖拽时的格子命中与矩形边界使用统一网格语义，选区始终贴合格子 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/2026-04-05-floor-area-selection-foundation.md` | domain |

## 依赖系统

- `scene-hud`：后续区域类型按钮或菜单会消费当前选区，但本轮不新增 HUD 入口，只在集成文档中记录为后续依赖。
- `pawn-state`：小人与地板选区可视重叠，但本轮不改变角色状态或交互规则。
- `task-planning`：本轮不改变 AI 决策，仅要求新的选区绘制不干扰既有更新循环。

## SubAgent 分派计划

- `selection-ui` → 读取 `docs/ai/system-standards/selection-ui.md`，写回 `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md`。
- `world-grid` → 读取 `docs/ai/system-standards/world-grid.md`，写回 `docs/ai/systems/world-grid/2026-04-05-floor-area-selection-foundation.md`。

## 汇总注意事项

- 选区 key 统一沿用 `coordKey` 的 `"col,row"` 语义，后续区域系统直接消费这组 key。
- `Ctrl` 的组合规则明确为“对新框中的每个格做对称差切换”，不是整块覆盖或整块删除。
- 本轮允许石头格、交互点格和小人脚下格被选中；“是否允许设区”留给后续区域类型规则决定。
