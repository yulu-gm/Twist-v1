# 审计：`src/ui/`（T-14）

对照文档（事实源与验收）：

- 需求设计：[`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) — 定义 **主菜单结构**（如「区域 → 存储区 → 新建」「建造 → 墙 → 木墙」「家具 → 木床」）、**工具栏/交互组件**（伐木工具、物资拾取标记工具、通用选区 UI、蓝图笔刷）、**地图界面**展示内容、**状态反馈**（小人状态、目标实体上方进度条）、以及 **第一天 UI 交互流程** 三步。
- 验收场景：[`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) — `gen_doc_ref` 指向 `oh-gen-doc/UI系统.yaml`；场景 **UI-001～UI-004** 分别约束：**层级菜单进入模式与状态区提示**、**地图叠加进度条**、**选中小人时需求条与行为文案**、**多重视觉反馈的 Z 轴层次**。

---

## 1. 一句结论

`src/ui/` 主要交付 **命令菜单状态机**（`menu-model.ts` + 数据在 `src/data/command-menu.ts`）、**DOM 化 HUD**（`hud-manager.ts`）、以及 **无 DOM 的状态读模型**（`status-display-model.ts`）与若干 **类型桩**（`ui-types.ts`）。它与 [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) 里「菜单 + 模式提示 + 详情区状态」方向部分重合，但 **菜单层级文案与结构**（如「区域/建造」对照「指令/结构」）及 **首日工具集范围** 与策划树**不一致**；与 [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) 相比，**地图叠加进度条**、**饱食度警戒色条**、**统一 Z-index 排序** 等能力 **未在本目录落地**（多数应在场景/画布层，而 **`SceneHudViewModel.mapFeedback` 目前无仓库内引用**）。另有 **未导出的 `runtime-debug-log-store`**、**仅测试使用的扁平旧菜单模型**、**未使用的 `UiMenuTree` / `SceneHudViewModel` 类型面** 等「遗留或闲置」信号。

---

## 2. 要解决什么问题（相对两份 UI YAML 的关注点）

[`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) 期望玩家通过 **树状菜单** 进入存储区创建、木墙蓝图笔刷、木床放置等模式，并在界面侧看到 **选区框/高亮、蓝图虚影、状态图标与读条**（见该文件 **「菜单系统」「工具栏/交互组件」「地图界面」「状态反馈」** 各节）。

[`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) 则把上述能力收束为可测陈述：例如 **UI-001** 要求「建造 → 墙 → 木墙」路径、子菜单展开高亮与 **状态展示区模式提示**；**UI-002** 要求地图叠加层 **进度条**；**UI-003** 要求 **饱食度条警戒色** 与 **行为文本**（如前往进食）；**UI-004** 要求多反馈项 **Z 序** 清晰。

本目录审计只回答：**这些条款中哪些由 `src/ui` 直接承担、哪些明显缺席或落在其他目录、以及是否存在与文档不同步的占位/旧代码**。

---

## 3. 应然与现状偏差（对照 YAML 条款）

**（A）主菜单结构 — [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) `菜单系统`**

策划示例为 **区域 / 建造 / 家具** 及子层级（如 **建造 → 墙 → 木墙**）。实现侧命令菜单分类由 `COMMAND_MENU_CATEGORIES` 驱动（见 `src/data/command-menu.ts`，被 `hud-manager` / `menu-model` 使用），标签为 **指令 / 结构 / 家具**，且 **「木墙」与「储存区」同属「结构」**，**没有独立的「墙」子菜单**。这与策划 **「建造 → 墙」** 的二层路径 **不等形**；**UI-001** 中的 **「建造 → 墙 → 木墙」** 点击序列在现 UI 上需 **映射为「结构 → 木墙」** 才可能复现同一呈现，**验收用语与实机路径需人工对齐**。

此外，[`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) 首日菜单未列举 **开采、割草、耕种、巡逻** 等；`指令` 分类下列出多项命令，属于 **超出策划 UI 树的功能扩张**（未必错误，但与 `菜单系统` 描述 **未逐条对齐**）。

**（B）工具栏与选区/笔刷 — 同文档 `工具栏/交互组件`**

策划强调 **伐木工具**、**物资拾取标记工具**、通用 **选区工具 UI**、**蓝图笔刷** 的视觉规格。代码侧：**输入形态**（`rect-selection` / `brush-stroke` / `single-cell`）与 **模式键** 由 `command-menu` 表达，`hud-manager` 渲染命令列表与热键；**选区框/虚影/高亮的绘制** 不在 `src/ui`（通常在场景或渲染层）。因此：**交互语义数据源** 部分对齐 **`inputShape` + `modeKey`**；**视觉规范**（半透明边框、虚影等）**本文档未在 `src/ui` 内验证**。

**（C）地图界面 — 同文档 `地图界面`**

文档列举地图格、小人、物资、树木、边界、标记、蓝图虚影等；**缩放与平移** 标注 **「待后续需求补充」**。`src/ui` **不渲染地图实体**；`ui-types.ts` 中 `SceneHudViewModel.mapFeedback` 为 **地图反馈项列表的类型占位**，全仓库 **无消费方引用**，与 [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「地图界面」** 所列 **标记图标、建筑蓝图虚影** 等呈现需求相比，**仅有类型层占位、无本目录内实现**。

**（D）状态反馈 — 同文档 `状态反馈` + [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) UI-002 / UI-003**

- **进度条**（伐木/建造读条，文档 **「状态反馈」·「进度条」**）：**未在 `hud-manager` 或 `status-display-model` 实现**；**UI-002** 的呈现义务落在 **地图叠加层**，本目录 **无对应实现**。
- **小人状态**：`status-display-model.pawnDetailBehaviorLabelZh` 将工单 kind / 目标 kind 映射为中文（含「伐木中」「建造中」等），`hud-manager.syncPawnDetail` 展示 **原始数值型需求** 与 **需求信号摘要**，**没有** UI-003 所要求的 **条形进度 + 警戒配色**；行为文案也未必覆盖 **「前往进食」** 等细粒度叙事（取决于 `goal`/`workItems` 数据是否传到该函数）。

**（E）多图层清晰度 — [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) UI-004**

文档要求 **Z-Index 排序**、减轻 **Z-fighting**。**`src/ui` 无渲染排序逻辑**；若实现存在，应在画布/Phaser 或专门叠加层模块，**不在本次目录审计的正证范围内**。

**（F）首日流程 — [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) `第一天UI交互流程`**

三步操作与反馈（存储区框选、木墙笔刷、木床放置）依赖 **交互系统 + 场景**，`src/ui` 仅提供 **命令入口与部分 HUD 文案**；**流程完整性** 不能仅靠本目录论证。

---

## 4. 代码结构与协作关系（`src/ui` 内）

| 文件 | 角色 | 与 YAML 关系 |
| --- | --- | --- |
| `menu-model.ts` | **命令菜单**纯函数状态 + **旧版扁平 `MenuState`**（注释写明供少量组件测试） | 对齐 **UI-001** 的「菜单模型」一则；旧 API 与策划 **菜单树** 无关 |
| `hud-manager.ts` | **DOM**：时间控制、悬停格信息、玩家通道文案、**命令菜单 UI**、名册与小人详情、YAML 场景选择、调试面板 | 承担 **模式提示/详情** 子集；**非地图叠加** |
| `status-display-model.ts` | **读模型**：行为中文标签、`aggregateStatusDisplay`（仪表盘聚合） | 与 **状态反馈** 部分相关；**`aggregateStatusDisplay` 在 `src/` 内无调用**（仅工作项文档提及） |
| `ui-types.ts` | `SceneHudViewModel`、`MapOverlayFeedbackItem`、`UiMenuTree` 等 | **多处类型未被引用**；与 **地图反馈层** 设计 **脱节** |
| `runtime-debug-log-store.ts` | 运行时日志条目的存储与筛选 | **被 `GameScene` / `runtime-log` 使用**，但 **`index.ts` 未再导出**，与公开 API 面不一致 |
| `index.ts` | 导出 hud、menu-model、status-display、ui-types | **未导出** `runtime-debug-log-store` |

**协作**：`GameScene` 使用 `createCommandMenuState`、`HudManager`、`selectRuntimeDebugLogEntries`；命令条目定义在 **`src/data/command-menu.ts`**（严格说不属 `src/ui/`，但决定 **策划菜单树 vs 实机菜单** 的差异）。

---

## 5. 尚不明确或需要产品/策划拍板（待澄清与文档建议）

1. **验收路径命名**：是否在 [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) **UI-001** 中将「建造 → 墙 → 木墙」**改为与 `command-menu` 一致的「结构 → 木墙」**（或反之在数据层增加 **策划 ID**），避免 **手测与自动化描述不一致**。
2. **`SceneHudViewModel` / `mapFeedback` 的定位**：是作为 **未来地图 HUD 单一视图模型** 保留，还是删除/迁出，以免与 [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「地图界面」** / [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) **UI-002/UI-004** 所要求的叠加呈现 **长期只在类型层悬空**。
3. **UI-003 的「警戒色」与条形需求**：是否必须由 `hud-manager` 实现，还是转交独立 **信息面板组件**；若留在 `syncPawnDetail`，需补 **设计 token**（颜色阈值）。
4. **旧扁平菜单 `MenuState`**：是否在 **测试迁到命令菜单** 后可以删除，减少 [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) 读者看到 **双套菜单模型** 的困惑。

---

## 问题清单

| 编号 | 类型 | 摘要 | 对照依据 |
| --- | --- | --- | --- |
| P1 | 文档 vs 结构 | **策划菜单**（`oh-gen-doc/UI系统.yaml` **「菜单系统」**：区域/建造/家具、建造→墙→木墙）与 **实装命令分类**（指令/结构/家具，木墙与储存区并列于结构）**路径不一致**。 | [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml)；[`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) **UI-001** |
| P2 | 文档 vs 范围 | **`指令` 分类下多项命令** 超出 [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) 首日 **「菜单系统」** 列举；是否属有意扩展未在 UI YAML 中声明。 | [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「菜单系统」** |
| P3 | 验收缺口 | **地图叠加进度条**（[`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「状态反馈」·「进度条」**；**UI-002**）**不在 `src/ui` 实现**；需明确负责模块（场景/Phaser）并完成与验收对齐。 | [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) **UI-002** |
| P4 | 验收缺口 | **选中对象时饱食度条 + 警戒色 + 行为叙事**（**UI-003**）与当前 `syncPawnDetail` **数字展示 + 行为映射** **不完全对齐**。 | [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) **UI-003** |
| P5 | 验收缺口 / 边界 | **多反馈 Z 序与防闪烁**（**UI-004**）**不在本目录**；若未在他处实现，则整体验收条款悬空。 | [`oh-acceptance/UI系统.yaml`](../../oh-acceptance/UI系统.yaml) **UI-004** |
| P6 | 闲置类型 | **`SceneHudViewModel`、含 `mapFeedback`、及 `UiMenuTree`/`UiMenuFocus` 等** 在 `src` 内 **无引用**，与 [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「地图界面」**/**地图反馈** 叙事 **脱节**。 | [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「地图界面」**；`src/ui/ui-types.ts` |
| P7 | 遗留 / 双轨 | **`MenuState`/`MenuItem` 扁平菜单** 标注为旧版，**仅 `tests/component/menu-model.test.ts` 使用**；与主命令菜单并存。 | `src/ui/menu-model.ts`（注释「旧版扁平菜单动作」） |
| P8 | 工程卫生 | **`aggregateStatusDisplay` 在 `src/` 无调用方**，可能为 **未完成接入的读模型**。 | `src/ui/status-display-model.ts` |
| P9 | 导出不一致 | **`runtime-debug-log-store` 未从 `src/ui/index.ts` 导出**，但被 `GameScene`、`runtime-log` 直接路径导入；**公开边界不清晰**。 | `src/ui/index.ts`；`src/ui/runtime-debug-log-store.ts` |
| P10 | 跨层 | **选区框/蓝图虚影/标记图标等视觉** 归属 **场景或渲染层**，[`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「工具栏/交互组件」** 与 **「地图界面」** 的完整落地 **不能仅从 `src/ui` 签收**。 | [`oh-gen-doc/UI系统.yaml`](../../oh-gen-doc/UI系统.yaml) **「工具栏/交互组件」**、**「地图界面」** |
