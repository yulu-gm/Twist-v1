## 目标

记录 A 线世界核心与 B 线玩家通道合并后的接缝：`WorldCoreWorldPort`、`applyDomainCommandToWorldCore`，以及场景侧将世界真相同步到 `sim-loop` 用网格的路径。

## 本系统负责的结果

- 领域命令接受/拒绝与 `WorldCore` 状态一致。
- 网格级障碍与 `restSpots` 可被自主行为与寻路消费（经由 `world-sim-bridge`，由 `GameScene` 调用）。

## 边界

- 小人尚未在 `sim-loop` 内直接 `claimWorkItem` / `completeWorkItem`；工单仍主要经领域与测试验证。

## 相关测试

- `tests/domain/world-core.test.ts`
- `tests/domain/apply-domain-command.test.ts`
- `tests/game/world-sim-bridge.test.ts`
