# PT008: 小人工作领取与执行基础

## 目标
扩展现有的 AI 决策系统，使空闲的小人能够主动从 `WorkRegistry` 中领取 `pending` 状态的工作（如伐木、开采），寻路前往目标并执行，最终结算掉落资源。

## 现状与背景
- PT007 已经实现了将玩家的指令转化为 `WorkRegistry` 中的 `pending` 工单。
- 目前小人的 AI（`goal-driven-planning.ts`）只有基于生存需求的目标（`eat`, `sleep`, `recreate`, `wander`），对工作系统毫无感知。
- 小人处于 `wander`（漫游）状态时，实际上是处于“空闲”状态，可以用来执行玩家下达的工作。

## 执行计划
1. **扩展 AI 目标类型 (GoalKind)**：
   - 在 `goal-driven-planning.ts` 中，为 `GoalKind` 新增 `"work"` 类型。
   - 扩展 `GoalDecision`，使其能够携带 `workId`，以便追踪当前正在执行的工单。
2. **实现工作领取逻辑 (Work Claiming)**：
   - 在 `chooseGoalDecision` 评估逻辑中加入对 `WorkRegistry` 的查询。
   - 当小人生存需求（饥饿、休息等）不紧急时，查询 `pending` 状态的工作。
   - 找到合适的工作后，生成 `"work"` 目标的决策。在应用决策时，调用 `WorkRegistry.setReservation` 锁定该工作，并将其状态更新为 `in_progress`。
3. **工作执行与寻路 (Work Execution & Pathing)**：
   - 当小人的 `currentGoal` 为 `"work"` 时，将其寻路目标设为工单的 `targetCell`。
   - 当小人移动到目标格（或相邻格，视具体工作类型而定）后，将 `currentAction` 切换为执行工作（如新增 `perform-work` 动作），并开始累加 `actionTimerSec`。
4. **工作结算 (Work Completion)**：
   - 当 `actionTimerSec` 达到工作所需时长时，完成工作。
   - 根据工单类型（伐木、开采等），调用 `EntityLifecycle` 中对应的结算方法（如 `fellingCompleteSpawnWood`）。
   - 将工作从 `WorkRegistry` 中移除（或标记为 `completed`），并清除小人的占用（Reservation），使小人恢复空闲状态。

## 验收标准
- [ ] 玩家框选树木/岩石生成工单后，空闲小人会自动结束漫游，领取该工单并走向目标。
- [ ] 领取工作后，`WorkRegistry` 中的工单状态正确变为 `in_progress`，且目标被锁定。
- [ ] 小人到达目标后，会在原地停留一段时间（模拟工作进度，可通过 `actionTimerSec` 实现）。
- [ ] 工作完成后，目标树木/岩石消失，原地掉落对应的资源（木柴/石块），小人重新寻找新工作或恢复漫游。
- [ ] 运行 `npm run build` 无编译错误。
