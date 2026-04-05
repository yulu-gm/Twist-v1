# scene-hud aidoc：格子 mock 掉落物（原型）

## 目标

在原型阶段于格子上叠加「掉落物」观感：每格至多一堆临时数据，用于验证线框、名称与数量展示，不向 `src/game/` 写入权威状态。

## 本系统负责的玩家可见结果

- 指定格内缩线框矩形、格心物品显示名、格内右下角数量。
- 指针悬停时，`#grid-hover-info` 文案在原有地形/通行信息基础上，若该格有 mock 堆叠则追加一行「掉落：名称 ×数量」。

## 前置依赖

- `world-grid`：`GridCoord`、`coordKey`、`cellAtWorldPixel` / `cellCenterWorld` 等由场景与 mock 模块复用。
- `GameScene` 在绘制交互点后调用 `drawGroundItemStacks`；悬停文案由 `formatMockGridCellHoverText` 经 `mockGroundItemAt` 拼接。

## 本系统输入

- `MOCK_SCATTERED_GROUND_ITEMS`、`mockGroundItemAt`（`src/scenes/mock-ground-items.ts`）。
- 格子悬停拼接：`src/scenes/mock-grid-cell-info.ts`。

## 本系统输出/反馈

- Phaser：`Graphics` 线框与 `Text`（名称、数量）；`depth` 高于网格/交互点填充，低于小人圆形（创建顺序）。

## 假实现边界

- **允许**：数据写死在场景 mock；每格一堆；仅表现层。
- **不允许**：在 HUD mock 内实现拾取/背包结算；将掉落物权威状态塞进 `world-grid` 核心类型而不走后续 routed 需求。

## 最先失败的测试

- 本批改动以肉眼验收为主；索引与文档完整性由 `node tools/aidoc/validate-index.mjs` 与 `npm run test:docs` 兜底。
