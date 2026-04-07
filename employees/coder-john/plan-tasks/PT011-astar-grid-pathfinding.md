# PT011：网格 A* 确定性寻路接入

## 需求依据（oh-gen-doc）

- `oh-gen-doc/行为系统.yaml`：移动状态下行为为 **「沿路径移动」**；工作/需求相关文档均要求小人 **移动到指定地图格或邻格**。当前实现为每步对邻格按曼哈顿距离贪心选一步，在障碍与其它小人占位存在时易出现 **局部最优卡死**，与「存在可达路径时应能沿路径靠近目标」的预期不一致。
- `oh-gen-doc/实体系统.yaml`：小人可 **移动到指定地图格** —— 需要可达性在离散网格上可判定、可执行。

## 现状（代码）

- `src/game/goal-driven-planning.ts` 中 `chooseStepTowardCell`：过滤可走邻格与其它小人占位后，按 `manhattanDistance(neighbor, target)` 排序取最小者，**无全局路径保证**。
- `src/game/sim-loop.ts` 在工作目标锚点、交互点目标等处统一步调用 `chooseStepTowardCell`；另有 `plannedStepTargets` 避免同 tick 多小人抢同一格，与寻路算法正交。
- `src/game/world-grid.ts` 已提供 `orthogonalNeighbors`、`isWalkableCell`（静态阻挡）、`isCellOccupiedByOthers`（动态阻挡）等，可作为 A* 的扩展代价与可走性依据。**本计划不改变闲逛逻辑**（`chooseWanderStep` / `wander-planning` 仍为随机邻格，除非后续单独立项）。

## 目标话题（单一）

在 **目标驱动移动**（非闲逛）路径上，用 **网格 A\*** 得到 **下一步合法格**，替换（或作为 `chooseStepTowardCell` 的唯一实现）当前贪心一步，使在静态障碍与其它小人当前占位下，只要存在从当前格到目标格的orthogonal可走路径，本 tick 就选出的那一步属于某条最短（或一致代价）路径上的首步。

## 实现要点

1. **新模块**（建议 `src/game/grid-pathfinding.ts` 或 `pathfinding-a-star.ts`）  
   - 输入：`WorldGridConfig`、起点、`targetCell`、`logicalCellsByPawnId`、当前 `pawnId`。  
   - 可走性：格在图内、`isWalkableCell`、且未被其它小人占用（与现 `chooseStepTowardCell` 过滤一致）。  
   - 图模型：四邻接，边权均为 1（与现每步移动等价）。  
   - 启发式：曼哈顿距离（与四向网格可采纳，保证最优步数）。  
   - 开放集：二叉堆或按 `(f, tie-break)` 排序的简单优先队列；地图规模小（如 20×10）时也可用数组线性取最小作第一版。  
   - 输出：**无路径** 时返回 `undefined`；有路径时返回 **路径上第二个格（即第一步要走进的邻格）**，或直接复用 `chooseStepTowardCell` 的签名「返回下一步 `GridCoord | undefined`」。

2. **接入点**  
   - 将 `chooseStepTowardCell` 内部改为调用 A* 求下一步；保持函数签名与其它调用方不变，降低 `sim-loop` 改动面。  
   - 不在本计划中要求「整条路径缓存到 `PawnState`」；若实现中发现每 tick 全量 A* 有可测性能问题，可作为同一 PT 内的小优化：目标格未变且上一步仍可行时复用路径队列（可选，非必须）。

3. **边界与一致性**  
   - 目标格本身若被其它小人占住：现逻辑本就无法「站上去」；A* 应要么 **以目标邻格集合为 goal**（与工作任务 anchor 语义对齐），要么保持调用方传入的 `targetCell` 语义不变 —— **以实现前对齐 `sim-loop` 里 work / 交互点两种 `targetCell` 的含义为准**，避免只吃「单格目标」而工作邻接目标失败。  
   - 无路径：行为与现实现一致倾向——返回 `undefined`，由上层维持 idle / release work 等逻辑（已存在于 `sim-loop`）。

4. **验证**  
   - 单元测试：构造小网格带凹障碍，`贪心一步` 会来回震荡或无法前进、`A*` 能到达；多小人占位堵路时无路径返回 `undefined`。  
   - 手工：场景中绕石/树到达食物或工作锚点，确认不再因贪心贴墙卡死。

## 非范围

- 多智能体协同避碰、预留通道、分层地图 —— 不属于本 PT。  
- 修改 `estimateWorkTravelDistanceLocal` 等仍用曼哈顿估计距离的**规划打分** —— 可另立 PT 用「真实最短步数」优化工作挑选；本 PT 仅 **执行层一步移动**。

## 验收标准

- 目标驱动移动路径上不再使用「仅按曼哈顿贪心邻格」作为唯一策略；存在 orthogonal 路径时 `chooseStepTowardCell`（或等价入口）返回的路径首步与 A* 一致。  
- 无路径时仍安全降级，不引入无限循环或断言失败。  
- 至少有针对障碍场景的自动化测试覆盖 A* 模块。
