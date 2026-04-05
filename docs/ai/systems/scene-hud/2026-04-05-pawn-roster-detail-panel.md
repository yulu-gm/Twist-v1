# scene-hud aidoc：人物略缩图条与右侧详情面板（mock 档案）

## 目标

在屏幕**上边居中**展示当前场景小人的略缩条（色块圆 + 名字），点击可选中；**右侧**显示该小人信息：mock 档案文案 + 实时模拟只读字段（需求、目标/行动、`debugLabel`）。

## 本系统负责的玩家可见结果

- `#pawn-roster`：`role="tablist"`，每格为 `button.pawn-roster-item`，含 `span.pawn-roster-thumb`（背景色对应 `PawnState.fillColor`）与名字。
- `#pawn-detail-panel`：选中后显示详情；未选中或找不到实体时隐藏。
- 默认选中第一个小人；选中样式与工具栏一致（`selected` 类、`aria-selected`）。

## 前置依赖

- `index.html` 提供 `#pawn-roster`、`#pawn-detail-panel` 及样式。
- `GameScene` 已创建 `this.pawns`。

## 本系统输入

- 表现数据：`this.pawns`（id、name、fillColor、needs、当前目标与行动、`debugLabel`）。
- Mock 档案：`mockPawnProfileForId`（`src/scenes/mock-pawn-profile-data.ts`，键为 `pawn-0` …）。

## 本系统输出/反馈

- DOM：动态生成的略缩按钮与详情面板 innerHTML（名称与展示字段经 `escapeHtml`）。
- 每帧 `update` 末尾 `syncPawnDetailPanel`，保证需求与 debug 行随模拟刷新。

## 假实现边界

- **允许**：档案全文 mock；id 与默认五人 spawn 顺序硬编码对齐。
- **不允许**：在 HUD 内写回 `src/game/` 状态；省略 `SHUTDOWN` 清理导致重复监听。

## 最先失败的测试

- **测试层级**：暂无组件单测；回归依赖 `npm run test` 与人工检视。

## 最小通过实现

- `setupPawnRosterUi` 构建槽位并默认选中首项；`selectPawnForRoster` 同步样式；`teardownPawnRosterUi` 在 `SHUTDOWN` 与重复 setup 前清理。

## 后续反推到底层的接口/规则

- **数据**：档案可迁至 `data/`；略缩条也可改为仅展示模拟层暴露的只读 DTO。
- **模拟**：若详情需领域事件时间线，应由 `pawn-state` / 任务系统提供查询接口，HUD 只订阅渲染。
