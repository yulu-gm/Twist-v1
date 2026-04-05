## 主题

`2026-04-05-goal-driven-pawn-ai-prototype`

## 原始需求

我希望游戏内的角色单位可以使用一套目标驱动型的方式来决策行为。最终实现的效果要类似 RimWorld 里的人物单位。

你可以基于这套 AI 方案进行方案设计，并且在当前的游戏框架下填充一些内容进行测试。

补充确认与实现约束：

- 首轮切片为“需求驱动原型”，不是完整殖民调度系统。
- 需求集合为：`饥饿`、`疲劳`、`娱乐`。
- 当前决策可视化采用“角色头顶目标标签 + 调试日志”。
- 测试世界使用固定地图样板，不从 `data/` 读取。
- 两个角色争同一个交互点时，先实现“单槽预定”，不做排队。

## route-demand 路由结果

- 玩家目标：打开游戏后，看到 5 个角色不再只是随机游荡，而是会基于自身需求在吃饭、睡觉、娱乐和游荡之间切换。
- 输入动作：当前无需玩家主动下达命令，角色在场景创建后自动进行需求评估、目标选择、移动和使用交互点。
- 画面反馈：
  - 地图上出现固定的食物点、床位和娱乐点。
  - 角色头顶显示“名字 + 当前目标/动作”。
  - 角色会朝不同交互点移动，并在冲突时改选其他目标或短暂停留。
- 状态承诺：
  - `world-grid` 需要提供固定交互点样板和单槽预定快照。
  - `pawn-state` 需要统一维护需求值、当前目标、当前动作、预定目标和调试标签。
  - `task-planning` 需要从随机游荡升级为目标评分、目标回退和执行阶段切换。
  - 场景层只读取模拟状态并做渲染，不直接决定 AI 规则。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `world-grid` | 玩家能在默认地图上看到固定食物点、床位和娱乐点，且角色不会同时占用同一个交互点 | `docs/ai/system-standards/world-grid.md` | `docs/ai/systems/world-grid/2026-04-05-goal-driven-pawn-ai-prototype.md` | `domain` |
| `pawn-state` | 玩家能看到角色需求驱动下的目标切换，并且头顶文本稳定反映当前目标/动作 | `docs/ai/system-standards/pawn-state.md` | `docs/ai/systems/pawn-state/2026-04-05-goal-driven-pawn-ai-prototype.md` | `domain` |
| `task-planning` | 玩家能看到角色根据饥饿、疲劳、娱乐做出不同目标选择，而不是单纯随机游荡 | `docs/ai/system-standards/task-planning.md` | `docs/ai/systems/task-planning/2026-04-05-goal-driven-pawn-ai-prototype.md` | `domain` |

## 依赖系统

- `scene-hud`：本次只在角色头顶补充调试标签，不新增独立 HUD 面板，因此作为依赖系统由集成文档记录。
- `selection-ui`：本次没有新增选中、切换或交互命令，因此不单独产出新 aidoc。

## SubAgent 分派计划

- `world-grid` → 读取 `docs/ai/system-standards/world-grid.md`，写回 `docs/ai/systems/world-grid/2026-04-05-goal-driven-pawn-ai-prototype.md`
- `pawn-state` → 读取 `docs/ai/system-standards/pawn-state.md`，写回 `docs/ai/systems/pawn-state/2026-04-05-goal-driven-pawn-ai-prototype.md`
- `task-planning` → 读取 `docs/ai/system-standards/task-planning.md`，写回 `docs/ai/systems/task-planning/2026-04-05-goal-driven-pawn-ai-prototype.md`

## 汇总注意事项

- 本次允许继续使用固定地图样板和简单图形占位，但不允许把目标评分和预定规则直接写进 Phaser 场景对象。
- 首轮不引入寻路、工作优先级、社交、情绪、建造、战斗或正式任务池。
- `wander` 仍保留，但只能作为没有更高优先级目标时的兜底行为。
- 场景调试日志只在目标切换、预定成功/失败、使用完成时输出，避免每帧刷屏。
