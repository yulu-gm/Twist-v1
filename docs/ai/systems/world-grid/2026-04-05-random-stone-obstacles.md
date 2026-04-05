## 目标

在默认网格上引入静态阻挡格（石头），并可从全图随机抽样若干格作为阻挡，且永不占用默认出生格。

## 本系统负责的玩家可见结果

- 玩家看到部分格子上出现石头占位图块。
- 角色不会占据或走入这些格子（由规划层配合可走规则实现）。

## 前置依赖

- 默认地图尺寸、格坐标与 5 个默认出生点已定义（见 `2026-04-05-default-grid-wandering-pawns`）。

## 本系统输入

- `WorldGridConfig`（含可选 `blockedCellKeys`）
- 需排除的格键集合（开局为全部默认出生格）
- 目标阻挡数量与可注入的 `GridRand`

## 本系统输出/反馈

- `isWalkableCell`：对落在 `blockedCellKeys` 中的格返回不可走
- `pickRandomBlockedCells`：返回一组互异、在网格内、且不在排除集合中的 `GridCoord`
- `blockedKeysFromCells`：由坐标列表生成阻挡键集合，供配置合并

## 假实现边界

- 允许在场景创建时用 `Math.random()` 驱动抽样；允许阻挡数量为代码常量。
- 允许阻挡仅支持正交可走语义（不对角穿角做特殊处理）。
- 不允许在 Phaser 场景中私设第二套「可走/阻挡」判断，必须与 `world-grid` 一致。

## 最先失败的测试

- 测试层级：`domain`
- 触发方式：配置含 `blockedCellKeys` 时，对阻挡格调用 `isWalkableCell` 期望 `false`；`pickRandomBlockedCells` 在固定 RNG 序列下不得采到排除键
- 预期失败原因：未实现阻挡字段或可走判断未读阻挡表

## 最小通过实现

- 扩展配置类型与可走判断
- 提供 Fisher–Yates 洗牌抽样函数及键集合辅助函数
- 为上述行为补充 `tests/domain/world-grid.test.ts` 回归用例

## 后续反推到底层的接口/规则

- 阻挡数据源改为 `data/` 下地图资产时，仍产出相同的 `blockedCellKeys` 或等价结构
- 若增加多类地形成本，扩展配置而非在场景中分支
