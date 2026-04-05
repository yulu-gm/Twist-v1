## 主题

`2026-04-05-time-of-day-system`

## 原始需求

给 V1 项目添加 TOD 系统。

补充确认与实现约束：

- 采用 `24h` 连续时间，不做离散昼夜两段。
- 一个完整昼夜对应 10 分钟真实时间。
- 开局从 `Day 1 06:00` 开始。
- 第一版只影响视觉表现，不改变 AI 规则。
- 时间信息显示在菜单栏；若本地尚未同步远端菜单栏实现，则兼容落到当前 `scene-hud` 容器。

## route-demand 路由结果

- 玩家目标：进入场景后，能直观看到世界时间流逝和昼夜变化。
- 输入动作：玩家打开游戏或切换测试场景，场景从初始时间开始推进。
- 画面反馈：
  - 菜单栏出现 `Day N HH:MM` 时间文本。
  - 背景、格线和文字标签随时间平滑变化。
  - 场景重启后时间回到 `Day 1 06:00`。
- 状态承诺：
  - `time-of-day` 需要维护世界时间、跨天归一化和昼夜调色板。
  - `scene-hud` 需要展示当前时间，但不负责任何时间计算。
  - `GameScene` 只消费 `time-of-day` 输出并更新表现层。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `time-of-day` | 玩家能看到世界从 `Day 1 06:00` 开始连续推进，并触发昼夜视觉变化 | `docs/ai/system-standards/time-of-day.md` | `docs/ai/systems/time-of-day/2026-04-05-time-of-day-system.md` | `domain` |
| `scene-hud` | 玩家能在菜单栏或兼容 HUD 容器看到 `Day N HH:MM` | `docs/ai/system-standards/scene-hud.md` | `docs/ai/systems/scene-hud/2026-04-05-time-of-day-system.md` | `component` |

## 依赖系统

- `world-grid`：继续提供网格绘制上下文，本轮不改变地图规则。
- `pawn-state`：继续提供头顶标签，本轮只改变文字颜色，不改变状态语义。
- `task-planning`：本轮不接入昼夜评分。
- `selection-ui`：本轮不改变选区交互，只要求高亮颜色继续可辨认。

## 汇总注意事项

- 第一版的关键帧与调色板允许写死在 `time-of-day` 模块内。
- 不允许把时间推进和颜色插值规则直接散落在场景代码里。
- 若远端菜单栏未完整同步，本轮必须保证在现有本地 HUD 容器里也能看到时间。
