# selection-ui：笔刷覆盖与网关有序提交

## 背景

建造工具使用 **笔刷会话**（`brush-stroke`）在拖拽中累积格键；与普通框选共用松开后的提交流程。

## 实现要点

- 笔刷路径格集合：`src/player/brush-stroke.ts` + `world-grid.gridLineCells`。
- 松手后由 `commit-player-intent` 统一：**先** `MockWorldPort.submit`，**再**更新任务标记与 `selection-renderer` 同步，保证拒绝不产生脏标记。

## 相关

- `GameScene.handleFloorPointerUp` 分叉建造笔刷与矩形框选。
- `docs/ai/integration/2026-04-05-b-line-player-channel-mock-gateway.md`。
