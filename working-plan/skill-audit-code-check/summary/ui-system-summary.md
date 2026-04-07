# UI系统代码审计汇总报告

## 1. 现状总结

基于 `oh-code-design/UI系统.yaml` 的理想架构设计，对 `src/ui/` 与 `src/scenes/` 相关模块进行审计后，发现当前 UI 系统的实现与“以读模型驱动展示，避免 UI 直接承担领域规则”的核心目标存在较大差距。主要体现在以下几个方面：

### 1.1 架构与分层偏离（上帝对象与读模型闲置）
- **上帝对象问题**：`HudManager` 和 `GameScene` 承担了过多职责。`HudManager` 单类跨越了界面结构、状态、呈现和动作转发四层，负责从时间、悬停、调试面板到命令菜单 DOM 构建的所有事务。`GameScene` 则混合了 HUD 绑定、Graphics 生命周期、编排器实例化与地图空间重置逻辑。
- **ViewModel 闲置**：`ui-types.ts` 中已定义了高度契合设计的 `SceneHudViewModel`，`status-display-model.ts` 中也提供了 `aggregateStatusDisplay`，但**全仓无任何实质引用**。当前 UI 仍由分散的命令式 `sync*` 方法直接操作 DOM，未能实现“单一界面态视图模型”的数据流预期。
- **呈现与状态耦合**：在 `HudManager.syncPawnDetail` 等方法中，HTML 模板的拼接与读模型转换逻辑强耦合，未按设计分离界面状态层与界面呈现层。

### 1.2 领域逻辑泄漏与表现层不一致
- **展示侧重算领域逻辑**：`zone-overlay-renderer.ts` 在呈现层二次推导了存储格的连通分量，并且其 `groupKey` 拼接采用了字符串排序（`localeCompare`），这与领域层 `storage-zones.ts` 中的行优先几何排序不一致，导致映射失配并触发静默回退。
- **状态同步缺口**：`menu-model.ts` 中 `setCommandMenuCategory` 仅切换了分类，未同步约束 `activeCommandId`，可能导致分类与当前选中命令状态不一致。

### 1.3 历史包袱与 Mock 残留
- **玩家可见的 Mock 痕迹**：`HudManager` 中直接将带有“（mock）”字样的占位文案（如简介、备注、标签）暴露给玩家，削弱了沉浸感。
- **双轨制与死代码**：
  - `menu-model.ts` 仍保留了旧版扁平菜单（`MenuItem`/`MenuState`）的兼容代码。
  - `villager-tool-bar-config.ts` 仅作为一个 `@deprecated` 的薄层转发，与 `mock-villager-tools.ts` 职责重复。
  - `HudManager` 存在从未使用的 `buildSubmenuContainer` 等死字段。
  - `grid-renderer.ts` 存在未使用的 `drawStoneCells` 方法。

---

## 2. 修改建议

为了向 `oh-code-design/UI系统.yaml` 的理想架构靠拢，建议按以下步骤进行重构与修复：

### 2.1 全面推进“读模型驱动展示”
- **启用 ViewModel**：在 `HudManager` 或上层 Presenter 中正式接入 `SceneHudViewModel` 和 `aggregateStatusDisplay`。由单一同步入口（或按子 View）将 DOM 更新与 `GameScene` 状态对齐，替代现有的零散 `sync*` 方法。
- **状态一致性修复**：修复 `menu-model.ts` 中的分类切换逻辑，确保 `activeCommandId` 在切换分类时被正确重置或约束。

### 2.2 拆分解耦上帝对象
- **拆分 HudManager**：按照 YAML 定义的四层架构，将 `HudManager` 拆分为独立的 `CommandMenuDomView`、`PawnRosterDomView`、`DebugPanelDomView` 等纯呈现组件。`HudManager` 仅保留生命周期管理与整体编排职责。
- **瘦身 GameScene**：将 `GameScene` 中的编排逻辑提取为独立的装配器或控制器；将 `cleanupRuntimeBeforeNextScenario` 中涉及地图网格重置的逻辑下沉到领域或同步专用服务中。

### 2.3 修复呈现层与领域层的不一致
- **收敛 Zone 分组逻辑**：移除 `zone-overlay-renderer.ts` 中的本地连通分量计算和 `groupKey` 构造，改为直接消费 `storage-zones.ts` 导出的领域层一致性数据，彻底消除排序规则不一致导致的 Bug。
- **统一叠加层级**：针对 `selection-renderer.ts` 中硬编码的 `depth`（如 41），建议在地图叠加反馈层建立统一的 z-index/depth 配置表，避免选区、蓝图、进度条互相遮挡。

### 2.4 清理死代码与 Mock 债务
- **移除 UI 中的 Mock 文案**：清理 `HudManager` 中的 `(mock)` 占位符，对接真实的档案数据源或使用正式的缺省文案。
- **下线双轨与废弃代码**：
  - 删除 `menu-model.ts` 中的旧版扁平菜单兼容代码，推动测试用例迁移至 `CommandMenuState`。
  - 删除 `villager-tool-bar-config.ts` 冗余转发文件，全仓统一从 `data/villager-tools` 导入。
  - 清理 `HudManager` 和 `grid-renderer.ts` 中的未使用字段和死方法。