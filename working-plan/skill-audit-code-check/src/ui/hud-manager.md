# 审计报告: src/ui/hud-manager.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-code-design/UI系统.yaml` 在「分层 → 界面状态层」要求「订阅领域系统只读数据并转成界面态」；在「模块 → 状态展示模型」要求「聚合多个系统的只读字段」。`src/ui/status-display-model.ts` 中的 `aggregateStatusDisplay` 负责聚合小人/时间/工单读模型且无 DOM，但全仓仅定义处被引用，**未驱动任何 HUD**。本类 `syncPawnDetail` 等仍直接拼 `PawnState` 与零散字段，与「读模型驱动展示」存在缺口。
- [依据]: `oh-code-design/UI系统.yaml` 第 18–21 行（界面状态层）、第 41–44 行（状态展示模型）；`oh-code-design/UI系统.yaml` 目标第 12 行「以读模型驱动展示，避免 UI 直接承担领域规则」。
- [指控]: `src/ui/ui-types.ts` 已定义 `SceneHudViewModel`（聚合 commandMenu、hover、playerChannel、time、roster、bAcceptance、mapFeedback 等），但**全仓无引用**，HUD 仍由 `GameScene` + `HudManager` 多方法零散同步，与设计中「单一界面态视图模型」方向不一致（属设计意图未在实现中贯通）。
- [依据]: `ui-types.ts` 中 `SceneHudViewModel` 定义；对比本类分散的 `sync*` / `setup*` API。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 245 行区段注释写明「mock 网关反馈」；`syncPawnDetail` 中玩家可见文案含「简介（mock）」「备注（mock）」「标签（mock）」（约 715–720、740 行），直接暴露占位档案，与正式产品文案要求不符。
- [影响]: 测试/开发痕迹进入玩家可见 UI，削弱沉浸感；易让验收误以为档案系统已定型。
- [指控]: 第 89–91 行声明 `buildSubmenuContainer`、`buildToolIndex`，**全文无读写**，属命令菜单改版后遗留的死字段。
- [影响]: 增加误读成本，易让人以为仍存在「建造子菜单槽位」的旧 DOM 路径。
- [指控]: 第 13、27–28 行从 `villager-tools` 导入并再导出 `VILLAGER_TOOLS`、`VILLAGER_TOOL_KEY_CODES` 及类型 `VillagerTool`，**本类实现未使用**；仓库内调用方均自 `data/villager-tools` 引用，经 `ui/index` 的再导出主要为 barrel 表面积。
- [影响]: API 面膨胀，职责边界模糊（HUD 管理器兼作数据常量出口）。

## 3. 架构违规 (Architecture Violations)

- [指控]: 单类承担时间 HUD、悬停格、玩家通道文案、场景变体选择绑定、YAML/场景面板、调试面板、**命令菜单完整 DOM 构建**、名册与详情等，跨越 `oh-code-design/UI系统.yaml` 所划分的「界面结构层 / 界面状态层 / 界面呈现层 / 界面动作转发层」多类职责，形成典型上帝对象。
- [依据]: `oh-code-design/UI系统.yaml` 第 13–28 行「分层」四段职责描述。
- [指控]: `syncPawnDetail` 内联大块 `innerHTML`，同时调用 `pawnProfileForId`、`needSignalsFromNeeds`、`pawnDetailBehaviorLabelZh`，**呈现模板与读模型转换耦合**在同一方法中；虽未见直接写入领域状态（未违反「输入/输出」边界中的「向交互系统提交」的反向写回），但与「状态展示模型无 DOM」的理想拆分不一致。
- [依据]: 同文件「状态展示模型」职责（第 41–44 行）及风险第 93–95 行（UI 与真实规则一致性）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0352]: 删除未使用的 `buildSubmenuContainer`、`buildToolIndex` 字段；移除 `hud-manager` 中对 `VILLAGER_*` 的无用 re-export（若需 barrel 导出，改在 `ui/index.ts` 显式从 `villager-tools` 导出）。
- [行动点 #0353]: 引入或消费 `SceneHudViewModel`，由单一同步入口（或按子 View）把 DOM 更新与 `GameScene` 状态对齐，减少分散的 `sync*` 方法。
- [行动点 #0354]: 用 `aggregateStatusDisplay`（或扩展其字段以覆盖详情面板所需）统一聚合只读字段，HTML 模板移至纯函数/小类，**去掉 mock 字样的玩家可见标签**或改为真实档案数据源。
- [行动点 #0355]: 按 YAML 分层拆分为 `CommandMenuDomView`、`PawnRosterDomView`、`DebugPanelDomView` 等，`HudManager` 仅负责生命周期与编排，降低单文件维护成本。
---

**范围说明**: 本次仅审计 `src/ui/hud-manager.ts`（约 765 行，未触发 skill 熔断阈值）。未修改 `src/`。
