## 目标

在默认网格上引入静态阻挡格子（石头），并且可以从全图随机抽取若干个格子作为阻挡，同时永远不会占用默认的出生格子。

## 本系统负责的玩家可见结果

- 玩家会看到部分格子上出现石头占位图块。
- 角色不会占据或者走入这些格子（由规划层配合可走规则来实现）。

## 前置依赖

- 默认地图尺寸、格子坐标与五个默认出生点已经定义（参见 `2026-04-05-default-grid-wandering-pawns`）。

## 本系统输入

- `WorldGridConfig`（包含可选的 `blockedCellKeys`）
- 需要排除的格子键值集合（开局时为全部默认出生格子）
- 目标阻挡数量与可以注入的 `GridRand`

## 本系统输出/反馈

- `isWalkableCell`：对于落在 `blockedCellKeys` 中的格子返回不可走状态
- `pickRandomBlockedCells`：返回一组互相差异、在网格内部、并且不在排除集合中的 `GridCoord`
- `blockedKeysFromCells`：由坐标列表生成阻挡键值集合，供配置合并使用

## 假实现边界

- 允许在场景创建时使用 `Math.random()` 驱动抽样；允许阻挡数量为代码常量。
- 允许阻挡仅支持正交可走语义（不对对角线穿角做特殊处理）。
- 不允许在 Phaser 场景中私自设置第二套“可走或阻挡”判断，必须与 `world-grid` 保持一致。

## 最先失败的测试

- 测试层级：`domain`
- 触发方式：配置包含 `blockedCellKeys` 时，对阻挡格子调用 `isWalkableCell` 期望返回 `false`；`pickRandomBlockedCells` 在固定的随机数生成器序列下不得采集到排除键值
- 预期失败原因：未实现阻挡字段或者可走判断未读取阻挡表

## 最小通过实现

- 扩展配置类型与可走判断
- 提供 Fisher–Yates 洗牌抽样函数以及键值集合辅助函数
- 为上述行为补充 `tests/domain/world-grid.test.ts` 回归测试用例

## 后续反推到底层的接口/规则

- 阻挡数据源改为 `data/` 下的地图资产时，仍然产出相同的 `blockedCellKeys` 或者等价结构
- 如果增加多类地形成本，扩展配置而不是在场景中进行分支
