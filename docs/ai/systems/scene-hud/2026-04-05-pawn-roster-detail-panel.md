# scene-hud aidoc：人物略缩图条与右侧详情面板（模拟档案）

## 目标

在屏幕上方居中展示当前场景小人的略缩条（色块圆圈加名字），点击可以选中；右侧显示该小人信息：模拟档案文案与实时模拟只读字段（需求、目标/行动、`debugLabel`）。

## 本系统负责的玩家可见结果

- `#pawn-roster`：`role="tablist"`，每一个格子为 `button.pawn-roster-item`，包含 `span.pawn-roster-thumb`（背景颜色对应 `PawnState.fillColor`）与名字。
- `#pawn-detail-panel`：选中后显示详情；未选中或者找不到实体时隐藏。
- 默认选中第一个小人；选中样式与工具栏一致（`selected` 类名、`aria-selected`）。

## 前置依赖

- `index.html` 提供 `#pawn-roster`、`#pawn-detail-panel` 以及样式。
- `GameScene` 已经创建 `this.pawns`。

## 本系统输入

- 表现数据：`this.pawns`（标识符、名称、填充颜色、需求、当前目标与行动、`debugLabel`）。
- 模拟档案：`mockPawnProfileForId`（`src/scenes/mock-pawn-profile-data.ts`，键名为 `pawn-0` 等）。

## 本系统输出/反馈

- DOM：动态生成的略缩按钮与详情面板内部 HTML（名称与展示字段经过 `escapeHtml` 处理）。
- 每一帧 `update` 末尾执行 `syncPawnDetailPanel`，保证需求与调试行随着模拟刷新。

## 假实现边界

- **允许**：档案全文模拟；标识符与默认五人生成顺序硬编码对齐。
- **不允许**：在 HUD 内写回 `src/game/` 状态；省略 `SHUTDOWN` 清理导致重复监听。

## 最先失败的测试

- **测试层级**：暂无组件单元测试；回归依赖 `npm run test` 与人工检视。

## 最小通过实现

- `setupPawnRosterUi` 构建槽位并且默认选中首项；`selectPawnForRoster` 同步样式；`teardownPawnRosterUi` 在 `SHUTDOWN` 与重复设置之前清理。

## 后续反推到底层的接口/规则

- **数据**：档案可以迁移至 `data/`；略缩条也可以改为仅仅展示模拟层暴露的只读数据传输对象。
- **模拟**：如果详情需要领域事件时间线，应该由 `pawn-state` 或者任务系统提供查询接口，HUD 只订阅渲染。
