## 目标

记录 GameScene 运行时重构后，目标规划、游荡规划、配置和 tick 编排的职责拆分。

## 本系统负责的玩家可见结果

- 自主 pawn 的行为表现保持不变。
- 需求变化、目标选择、到达判定和动作时序仍按原来的节奏推进。
- 场景层不再直接拼接规划细节，而是读取 `tickSimulation` 的结果。

## 前置依赖

- `sim-config` 已集中移动时长、石头数量和需求增长率。
- `sim-loop` 已把每 tick 的需求、移动、动作计时、到达检查、目标选择、预定和 AI 事件消息串起来。

## 本系统输入

- `src/game/goal-driven-planning.ts` 的目标决策能力。
- `src/game/wander-planning.ts` 的兜底游荡能力。
- `src/game/sim-config.ts` 的仿真参数。
- `src/game/sim-loop.ts` 的 tick 编排入口。

## 本系统输出/反馈

- 目标规划继续返回可执行目标、回退和预定信息。
- 游荡规划继续提供合法兜底移动候选。
- `GameScene` 改为消费 `tickSimulation` 输出，不再 inline 改写规划状态。

## 假实现边界

- 允许先提取 orchestration 层，不改变 autonomous pawn 的实际行为。
- 允许 `sim-config` 先承载现有常量，再考虑后续参数化。
- 不允许把需求增长、到达判断和事件消息重新散落回场景更新函数里。

## 最先失败的测试

- 测试层级：`domain`
- 触发方式：执行一个 tick，验证目标选择、游荡兜底和动作计时仍按原规则输出。
- 预期失败原因：编排尚未从 GameScene 完整迁移到 `sim-loop`，或配置常量仍分散定义。

## 最小通过实现

- 保留 `goal-driven-planning` 与 `wander-planning` 的行为输出。
- 通过 `sim-config` 提供移动时长、石头数量和需求增长率。
- 让 `sim-loop` 统一驱动每 tick 的状态推进与事件派发。

## 后续反推到底层的接口/规则

- 后续如果增加新的自主行为类型，应优先接入 `sim-loop` 的 tick 流程。
- 若配置项继续增长，应保持集中定义，避免回到场景层常量散落。
