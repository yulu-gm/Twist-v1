# scene-hud aidoc：格上 mock 任务标记（工具点格）

## 目标

在格子地图上以临时表现展示「当前工具对该格下达的 mock 任务」：半格直径的圆线框，任务名显示在格心并带黑色描边。

## 本系统负责的玩家可见结果

- 玩家在 **网格内** 使用 **左键** 点某一格时：若当前小人工具在 mock 规则下视为下达指令，则该格出现金色描边圆（半径为 `cellSizePx * 0.25`，即直径为半格）与对应中文任务名（与工具栏标签一致）。
- 当前工具为 **待机** 时，点击某一格会 **移除** 该格已有标记（若有）。
- 多格可同时保留不同格的标记；与小人 AI、模拟层无数据回写。

## 前置依赖

- `GameScene` 已布局网格原点与 `pointerToCell`。
- `MOCK_VILLAGER_TOOLS`（`villager-tool-bar-config.ts`）与 `mockIssuedTaskLabelForVillagerToolId`（`mock-task-marker-commands.ts`）。

## 本系统输入

- 当前选中槽位索引 → 工具 `id` / `label`。
- Phaser `POINTER_DOWN`、左键、`pointerToCell` 得到的格坐标。

## 本系统输出/反馈

- 场景对象：`taskMarkerGraphics`（圆描边）、按格复用的 `Text`（格心、`stroke` 黑色描边）。
- 场景内状态：`taskMarkersByCell: Map<coordKey, label>`，纯属表现层 mock。

## 假实现边界

- **允许**：`mockIssuedTaskLabelForVillagerToolId` 将除 `idle` 外所有工具视为派工；不向 `src/game/` 写入。
- **不允许**：在 HUD/场景内实现采矿、建造等领域结算或修改小人状态。

## 最先失败的测试

- **层级**：component（无 Phaser）。
- **路径**：`npm run test` → `tests/component/mock-task-marker-commands.test.ts`。
- **典型失败**：`idle` 或未知 id 未返回 `null`，或工具标签与配置不一致。

## 最小通过实现

- 导出 `mockIssuedTaskLabelForVillagerToolId` 并与工具表对齐。
- `GameScene`：`bindGridTaskMarkerInput`、`syncTaskMarkerView`，深度高于默认格子绘制以便可见。

## 后续反推到底层的接口/规则

- 标记数据源改为领域层「已派发任务 / 工单单元」只读快照；`idle` 的清格语义由产品设计确定。
- `task-planning` 与真实「指令」模型对接时，更新集成文档与 domain 测试，并缩减或删除本 mock 判定函数。
