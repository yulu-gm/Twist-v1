# scene-hud aidoc：小人指令工具栏（mock）

## 目标

在原型阶段提供底部居中的「小人指令」工具栏，支持快捷键 **Q W E R T Y U I O** 与点击切换当前选中工具；数据全部为 mock，不向模拟层写入。

## 本系统负责的玩家可见结果

- 屏幕底部居中显示一排工具格；每格展示热键字母与中文标签。
- 当前选中格有明显的选中样式（类名 `selected`、键盘可聚焦按钮的 `aria-pressed`）。
- 鼠标悬停可通过 `title` 看到简短说明（mock `hint`）。
- 场景重启后选中复位为第一项。

## 前置依赖

- `index.html` 提供 `#villager-tool-bar` 容器与样式。
- `GameScene` 已启动且 `this.input.keyboard` 可用。

## 本系统输入

- Mock 工具表：`MOCK_VILLAGER_TOOLS`、`MOCK_VILLAGER_TOOL_KEY_CODES`（`src/scenes/villager-tool-bar-config.ts`；`mock-villager-tools.ts` 为同内容 re-export）。
- 指针点击、Phaser 键盘 KeyCodes Q–O。
- 场景生命周期：`SHUTDOWN` 需卸载监听。

## 本系统输出/反馈

- DOM：动态生成的 `<button class="tool-slot">` 列表。
- 场景内状态：`selectedToolIndex`（仅表现层，仅供后续扩展读取）。
- 清理：销毁 Key 对象、中止 `AbortController` 上的点击监听，避免 `restart` 泄漏。

## 假实现边界

- **允许**：固定 9 槽、热键写死为 QWERTYUIO；标签/文案全部 mock；不调用 `src/game/`。
- **不允许**：在 HUD 内实现开采/伐木等领域结算；在纯配置模块中引用 Phaser（键码使用与 `KeyCodes` 一致的数值常量，便于 Node 下单测）。

## 最先失败的测试

- **测试层级**：component（配置不变量，无头、无浏览器）。
- **触发方式**：`npm run test` 中的 `tests/component/villager-tool-bar-model.test.ts`。
- **预期失败原因**：槽位数与键码数组不一致、热键顺序非 QWERTYUIO、或 tool `id` 重复。

## 最小通过实现

- 实现并导出 `validateMockVillagerToolBarConfig()`，保证与 `MOCK_VILLAGER_TOOLS` / `MOCK_VILLAGER_TOOL_KEY_CODES` 一致。
- `GameScene.setupVillagerToolBar` 渲染槽位、绑定键与点击、同步选中样式；`teardownVillagerToolBar` 在 `SHUTDOWN` 与重复 `setup` 前清理。

## 后续反推到底层的接口/规则

- **数据**：迁至 `data/` 或服务器配置；键位与槽位由数据驱动时，保留或替换校验函数。
- **模拟**：`task-planning` 根据当前工具 id 过滤可派发工作；需 domain 测试与跨系统集成文档更新。
