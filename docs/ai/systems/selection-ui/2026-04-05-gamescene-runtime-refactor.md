# selection-ui aidoc：GameScene runtime refactor

## 目标

把选区运行时责任从 `GameScene` 拆出去，改由 `src/game/floor-selection.ts` 负责状态，`src/scenes/renderers/selection-renderer.ts` 负责绘制，`src/data/task-markers.ts` 负责任务标记数据。

## 本系统负责的玩家可见结果

- 地板选区高亮的外观与交互保持不变。
- 任务标记圆圈和文本仍按当前状态渲染在格子上。
- 这次拆分不应带来玩家可见行为变化。

## 前置依赖

- `GameScene` 已完成布局、输入和状态 wiring。
- `floor-selection` 提供稳定的选区状态。
- `task-markers` 提供任务标记显示所需的只读状态。

## 本系统输入

- 选区状态与提交结果，来自 `src/game/floor-selection.ts`。
- 任务标记状态，来自 `src/data/task-markers.ts`。
- 场景布局与网格坐标转换结果。

## 本系统输出/反馈

- `selection-renderer` 绘制 floor selection overlays。
- `selection-renderer` 也绘制 task marker circles/text。
- `GameScene` 只负责把状态送进渲染器，不再自己画这些层。

## 假实现边界

- 允许继续沿用现有选区语义和任务标记语义，不改玩家操作方式。
- 不允许把渲染逻辑留在 `GameScene` 内部。
- 不允许把任务标记文本和圆圈改成另一套场景内临时状态来源。

## 最先失败的测试

- `tests/domain/floor-selection.test.ts`
- 现有任务标记相关组件测试

## 最小通过实现

- `src/game/floor-selection.ts` 继续承载选区状态。
- `src/scenes/renderers/selection-renderer.ts` 统一绘制选区和任务标记。
- `src/data/task-markers.ts` 作为任务标记的只读数据入口。

## 后续反推到底层的接口/规则

- 若后续加入更多选区样式或标记类型，优先扩展渲染器和数据模块，不要把逻辑回塞到 `GameScene`。
- 当任务标记接入真实领域数据时，保留渲染器接口不变，只替换数据来源。
