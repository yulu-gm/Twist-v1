## 目标

游荡规划在挑选下一格时，必须把地图阻挡格与occupied格同样视为不可进入的邻格候选排除条件。

## 本系统负责的玩家可见结果

- 玩家看到角色会绕过石头，不会在石头格上停留或走入。

## 前置依赖

- `world-grid` 已对阻挡格返回不可走（`isWalkableCell`）
- `pawn-state` 提供角色当前逻辑格与占用快照

## 本系统输入

- 带可选 `blockedCellKeys` 的 `WorldGridConfig`
- 角色状态、邻格枚举结果、全员逻辑占用表
- 可注入随机源（用于在多个合法邻格中选一个）

## 本系统输出/反馈

- 过滤后的合法游荡邻格列表
- 移动或等待决策（无新格式）

## 假实现边界

- 允许继续仅为「正交邻格 + 随机选一个」；阻挡仅通过 `isWalkableCell` 体现。
- 不允许在 `GameScene.update` 中手写「若下一步是石头则撤销」一类绕过规划层的逻辑。

## 最先失败的测试

- 测试层级：`domain`
- 触发方式：pawn 某邻格被标为阻挡时，`legalWanderNeighbors` 不得包含该格
- 预期失败原因：`legalWanderNeighbors` 未调用可走判断或未传入含阻挡的配置

## 最小通过实现

- 保持 `legalWanderNeighbors` 内对 `isWalkableCell` 的既有调用；测试使用传入 `blockedCellKeys` 的 grid 固件

## 后续反推到底层的接口/规则

- 若引入加权移动或寻路，`isWalkableCell` 可能扩展为代价无穷大；规划层仍应以统一地图语义为准
- 更复杂任务规划接入时，阻挡过滤应复用同一 helpers，避免重复规则
