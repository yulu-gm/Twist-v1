## 目标

为 V1 提供可复用的地板选区底座：支持单击选格、拖拽矩形框选、`Shift` 并集扩选、`Ctrl` 按格切换增删，并产出后续区域系统可直接消费的选区 cell key 集合。

## 本系统负责的玩家可见结果

- 玩家可以稳定看出当前哪些格子被选中。
- 拖拽中会看到与最终结果一致的选区预览。
- `Ctrl` 操作时，玩家能区分哪些格子会被加入，哪些格子会被剔除。

## 前置依赖

- `world-grid` 提供世界坐标命中格子与矩形格集合展开 helper。
- `GameScene` 负责把鼠标事件和修饰键转换为本系统输入。

## 本系统输入

- 当前已提交选区（`ReadonlySet<string>`）
- 起始格、当前格
- 修饰键语义（replace / union / toggle）
- 来自 `world-grid` 的矩形格 key 集合

## 本系统输出/反馈

- 当前草稿选区
- 预览后的最终选区
- `addedCellKeys` / `removedCellKeys`，供场景区分 `Ctrl` 预览颜色
- 提交后的稳定 `selectedCellKeys`

## 假实现边界

- 允许选区只存在于场景内存中，并被 `scene-hud` 的 mock 任务标记逻辑直接消费，不接真实区域类型系统。
- 允许 `selection-ui` 先用纯函数/纯状态模块实现，不引入单独 UI 面板。
- 不允许把修饰键判断、矩形展开和最终选区提交散落在 `GameScene` 各处分支里，必须由可测试的选择状态模块统一承载。

## 最先失败的测试

- 测试层级：`acceptance`
- 触发方式：从既有选区出发，分别验证普通替换、`Shift` 并集、`Ctrl` 按格切换、网格外点击清空
- 预期失败原因：缺少独立 selection 状态模块，或 `Ctrl`/`Shift` 组合逻辑不正确

## 最小通过实现

- 新增 `src/game/floor-selection.ts`
- 定义 `FloorSelectionState`、`SelectionDraft`、`SelectionModifier`
- 提供开始、更新、提交、清空与修饰键解析函数
- 在 `GameScene` 中用该模块驱动场景高亮绘制

## 后续反推到底层的接口/规则

- 当前 mock 派工和后续区域类型系统都直接消费 `selectedCellKeys`，不要改成另一套选区标识格式。
- 若加入多选对象、优先级选择或笔刷工具，应在此状态模块上扩展，而不是把规则回写到场景层。
