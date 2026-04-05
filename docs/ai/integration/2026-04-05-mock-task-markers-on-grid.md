# 集成文档

## 主题

`2026-04-05-mock-task-markers-on-grid`

## 玩家路径

1. 玩家在 `GameScene` 中通过工具栏或 **Q–O** 选中一件小人工具（见 `2026-04-05-villager-tool-bar.md`）。
2. 玩家在 **地图网格内** 左键点击某一格。
3. 若当前工具在 mock 规则下视为下达指令：该格显示 **半格直径** 圆线框与 **格心** 任务名（黑色描边）；若为 **待机** 工具：仅清除 **该格** 上的标记（若有）。
4. 小人 wandering / 目标驱动等行为不变；无模拟层状态回写。

## 参与系统

- **scene-hud**：`mock-task-marker-commands`、`GameScene` 内指针处理与 Phaser 绘制。

## 相关系统（本次无领域文件变更）

以下系统在索引中登记了本集成文档以便变更可追溯；**本次提交**未修改其 `src/game/` 或已登记的 domain 测试：

- `pawn-state`、`task-planning`、`world-grid`、`selection-ui`（表现逻辑仍集中在 `GameScene.ts`）。

## TDD 与回归

- component：`tests/component/mock-task-marker-commands.test.ts`。
- 手工：`npm run dev` 验证圆框尺寸、格心文字与待机清标记。

## fake-to-real 反推顺序

1. 用领域层任务/工单列表驱动格上标记；移除或收窄 `mockIssuedTaskLabelForVillagerToolId`。
2. 更新 `task-planning` / 跨系统 aidoc，并补充 domain 或集成测试（若规则非平凡）。
