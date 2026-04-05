## 主题

`2026-04-05-a-line-world-core-and-build-loop`

## 原始需求

阅读 `working-plan` 里的双人并行任务文档，本次只负责落实其中的 A 线需求，按照项目的规范来实现。

## route-demand 路由结果

- 玩家目标：让世界内核先具备稳定的实体、时间、工作与建造闭环，为后续 AI 与 UI 接线提供真相源。
- 输入动作：通过命令放置标记或蓝图，推进时间，领取/失败/完成工作。
- 画面反馈：后续 UI 可据此读取稳定的实体快照、占用结果、工作状态与建造结果。
- 状态承诺：实体与占格一致；暂停时无隐式推进；工作有锁定；蓝图能转为建筑并派生床位结果。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| `world-core` | 统一维护 A 线的世界真相源、工作锁定和建造落地结果 | `docs/ai/system-standards/world-core.md` | `docs/ai/systems/world-core/2026-04-05-a-line-world-core-and-build-loop.md` | `domain` |

## 依赖系统

- `world-grid`：提供格子边界和占格键语义，本次不单独新增承诺。
- `time-of-day`：提供暂停、调速和跨天时间语义，本次不单独新增承诺。
- `task-planning`：后续 B 线会消费工作候选与结果，本次只保留依赖说明。

## SubAgent 分派计划

- 本次未启用 SubAgent；由主 agent 直接在 `world-core` 切片内实现并补齐 aidoc。

## 汇总注意事项

- 本次只落实 A 线，不触碰 B 线的交互与行为编排。
- 先以 domain tests 和命令回放证明世界闭环成立，再考虑场景接入。
