# 集成文档

## 主题

`2026-04-05-mock-task-markers-on-grid`

## 玩家路径

1. 玩家在 `GameScene` 中通过工具栏或 **Q–O** 选中一件小人工具（见 `2026-04-05-villager-tool-bar.md`）。
2. 玩家在 **地图网格内** 左键按下并拖拽，或直接单击单格完成最小矩形框选。
3. `selection-ui` 根据修饰键把本轮操作解释为替换、`Shift` 并集扩选或 `Ctrl` 切换增删，并在松开鼠标后提交本次选中的格集合。
4. 若当前工具在 mock 规则下视为下达指令：本轮提交的每个格都显示 **半格直径** 圆线框与 **格心** 任务名（黑色描边）。
5. 若为 **待机** 工具：仅清除 **本轮提交格集合** 上已有的标记。
6. 小人 wandering / 目标驱动等行为不变；无模拟层状态回写。

## 参与系统

- **scene-hud**：`mock-task-marker-commands`、`mock-task-marker-selection`、`GameScene` 内指针处理与 Phaser 绘制。
- **selection-ui**：提供框选草稿、修饰键语义与提交后的 cell key 集合。

## 相关系统（本次无领域文件变更）

以下系统在索引中登记了本集成文档以便变更可追溯；**本次提交**未修改其 `src/game/` 或已登记的 domain 测试：

- `pawn-state`、`task-planning`、`world-grid`、`selection-ui`（表现逻辑仍集中在 `GameScene.ts`）。

## TDD 与回归

- component：`tests/component/mock-task-marker-commands.test.ts`、`tests/component/mock-task-marker-selection.test.ts`。
- 手工：`npm run dev` 验证拖拽矩形、`Shift` 扩选、`Ctrl` 切换，以及待机工具批量清标记。

## fake-to-real 反推顺序

1. 用领域层任务/工单列表驱动格上标记；移除或收窄 `mockIssuedTaskLabelForVillagerToolId`。
2. 若后续引入“选区确认”或“区域类型面板”，继续消费同一批 `selection-ui` cell key，而不是重新做一套拖拽解释。
3. 更新 `task-planning` / 跨系统 aidoc，并补充 domain 或集成测试（若规则非平凡）。
