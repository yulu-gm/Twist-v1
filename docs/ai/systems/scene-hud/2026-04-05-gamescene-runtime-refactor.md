# scene-hud aidoc：GameScene runtime refactor

## 目标

把 `GameScene` 的 HUD 责任拆成运行时编排、`HudManager` DOM 交互和只读数据模块，保留现有玩家可见表现，不引入行为变化。

## 本系统负责的玩家可见结果

- 时间 HUD、悬停信息、工具栏、小人名册和小人详情的显示与交互保持原样。
- 旧路径仍可继续导入，避免重构期间打断现有调用。

## 前置依赖

- `GameScene` 已接管布局、输入和状态 wiring。
- `HudManager` 可以拿到场景状态和根 DOM 容器。
- `src/data/*.ts` 提供只读展示数据。

## 本系统输入

- 场景内时间、悬停格、当前工具、名册和小人详情状态。
- `src/data/villager-tools.ts`、`src/data/ground-items.ts`、`src/data/grid-cell-info.ts`、`src/data/task-markers.ts`、`src/data/pawn-profiles.ts`。

## 本系统输出/反馈

- `HudManager` 更新 time HUD、hover info、tool bar、roster 和 pawn detail。
- 场景层只保留 wiring，不直接承担读写 DOM 的细节。

## 假实现边界

- 允许保留 `src/scenes/mock-*.ts` 和 `src/scenes/villager-tool-bar-config.ts` 作为兼容前向。
- 不允许把 DOM 交互逻辑继续散落在 `GameScene` 中。
- 不允许把 mock 展示数据回写到模拟或领域层。

## 最先失败的测试

- `tests/component/villager-tool-bar-model.test.ts`
- `tests/component/mock-task-marker-commands.test.ts`

## 最小通过实现

- `GameScene` 只做布局、输入和状态 wiring。
- `HudManager` 接管 HUD 的 DOM 交互。
- 只读展示数据移动到 `src/data/*.ts`，并保留兼容前向。

## 后续反推到底层的接口/规则

- 当 mock 展示数据切换为真实数据源时，优先替换 `src/data/*.ts` 的实现，再移除兼容前向。
- 若 HUD 继续增加新面板，先扩展 `HudManager` 的职责边界，再决定是否拆出新的 data 模块。
