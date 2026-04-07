# 审计：`src/scenes/`

对照文档：`oh-gen-doc/UI系统.yaml`、`oh-gen-doc/地图系统.yaml`、`oh-acceptance/UI系统.yaml`、`oh-acceptance/地图系统.yaml`（下文对验收场景 **UI-001～UI-004**、**MAP-001～MAP-004** 做显式语义对照，不逐字转抄 YAML）。

---

## 一句结论

`src/scenes/` 以 `GameScene` 为 Phaser 中枢，把 **DOM 侧 HUD**（命令菜单、名册、悬停信息、调试与 YAML 场景面板）与 **画布侧地图叠层**（格线、障碍石格、树/物资/建筑/存储区、框选与笔刷草稿、任务标记、小人视图含工时条）串到 `GameOrchestrator` / `bootstrapWorldForScene` 上。与策划文档相比：**表现层能力多数能落到** `oh-gen-doc/UI系统.yaml` 的「地图界面显示内容」与 `oh-gen-doc/地图系统.yaml` 的「选区 + 初始化树木/散落资源」方向；同时存在 **整目录几乎无人引用的 `mock-*.ts` 兼容转发**、**若干仅工程/调试用途的能力未写入 oh 文档**，以及 **悬停文案仍依赖 `src/data/grid-cell-info.ts` 内的 mock 地形名**（与地图策划文档的抽象格模型不对齐）。

---

## 要解决什么问题（审计视角）

从 `oh-gen-doc/UI系统.yaml` 出发，要验证的是：层级菜单与模式切换、伐木/拾取等**工具 + 选区/笔刷**、地图主画面元素、状态与进度反馈、第一天交互流程等是否由代码诚实支撑。从 `oh-acceptance/UI系统.yaml` 出发，验收直接用 **UI-001**（菜单进蓝图模式等）、**UI-002**（地图空间工时条）、**UI-003**（小人状态与需求面板）、**UI-004**（多层叠层 Z 序清晰）四句 `then` 区来卡。

从 `oh-gen-doc/地图系统.yaml` 与 `oh-acceptance/地图系统.yaml` 出发，场景侧最相关的是：**格与可走性可视化**、**选区创建存储区等交互**、**开局实体分布的呈现**（**MAP-001**）、**合法选区与越界裁剪的可视反馈**（**MAP-002**、**MAP-004**）以及与**占格冲突**相关的蓝图反馈（**MAP-003** 的呈现部分往往在建筑渲染与领域结果摘要一行）。

本审计聚焦：`mock-*.ts` 是否仍为真实依赖、场景与 `src/data` / `src/game` 的职责是否重叠、上述 oh 文档与当前实现之间是否存在「文档未写却已做」或「文档写了却仍在 mock 层」的裂缝。

---

## 设计上怎么应对（文档应然 vs 代码现状）

### 显式对照 `oh-gen-doc/UI系统.yaml`

- **「菜单系统 / 工具栏 / 选区工具 UI / 蓝图笔刷」**：命令与热键数据在 `src/data/command-menu.ts`、`src/data/villager-tools.ts`，`HudManager` 渲染菜单；`GameSceneFloorInteraction` 处理矩形框选与笔刷手势，`GameSceneCameraControls` 用中键平移、滚轮缩放。**对照结论**：框选、笔刷形态与文档描述的交互大类一致；**与文档差异**：`oh-gen-doc/UI系统.yaml` 中「地图界面 · 缩放与平移」写的是**待后续需求补充**，而代码里相机缩放/平移**已实现**（属「文档滞后于实现」或孤立超前能力，视产品是否追认而定）。
- **「地图界面 · 显示内容」**（格、小人、物资、树、存储区边界、标记、蓝图虚影、建筑实体）：`GameScene` 内多路 `renderers/*` 与 `syncTreesAndGroundLayer` 与此列表**逐项对应**；任务标记圆环由 `selection-renderer` 等绘制。
- **「状态反馈 · 进度条 / 小人状态」**：`pawn-renderer` 在小人工作时绘制细长进度填充（与文档「目标实体上方」接近，绑定在 pawn 视图）。**对照 `oh-acceptance/UI系统.yaml` UI-002**：验收写的是「地图叠加反馈层在目标树木或小人上方渲染进度条」——当前实现落在 **pawn 视图侧条**，是否算严格满足「树木或小人上方」需结合伐木时镜头与动画再验收，但语义上属于同一类**地图空间工时反馈**。
- **「第一天 UI 交互流程」**：文档分「区域→存储区→新建」「建造→墙→木墙」「家具→木床」三步；代码侧由 **命令菜单指令 id** 与 **地板交互** 承载，具体菜单文案/层级需与 `command-menu` 数据核对——本目录不重复枚举 id，但架构上**具备**按菜单进入不同 `inputShape`（单击/框选/笔刷）的路径。

### 显式对照 `oh-acceptance/UI系统.yaml`

- **UI-001**（菜单展开、领域切到蓝图模式、表现上模式提示）：`GameScene` 中 `selectCommandMenuCommand` → `HudManager.syncCommandMenuSelection` + `syncPlayerChannelUi`（`game-scene-hud-sync.ts` 调 `presentationForCommandMenuCommand` 生成 **modeLine**）。「子菜单高亮、指针变笔刷」等需在 HUD 实现里逐条对；场景文件负责**触发同步**而非 DOM 细节。
- **UI-002**（行为系统输出进度 → 地图叠加进度条）：表现用 `pawn-renderer` 的 `workTimerSec`/`totalSec` 驱动填充；**领域数据自 orchestrator/world**，场景只在 tick 后刷新视图，与验收「只读进度」分工基本一致。
- **UI-003**（实体与需求状态 → 面板）：`GameScene.syncPawnDetailPanel` → `hud.syncPawnDetail`，档案侧使用 **`src/data/pawn-profiles`**（非 `mock-pawn-profile-data.ts` 转发文件）。
- **UI-004**（多反馈 Z 序）：`GameScene` 对各类 `Graphics`/`Depth` 有显式分层（例：树冠 13、建筑 14、存储区 overlay 30、地面物资 31、地板选区 32、草稿 34、任务标记 40、悬停框 80），与验收「按 Z-Index 排序」**方向一致**。

### 显式对照 `oh-gen-doc/地图系统.yaml`

- **「地图格 / 可通行」**：石格与可走性通过 `drawStoneCellsToGraphics` 与格线配色表达；与文档「默认可通行 + 阻挡」一致。
- **「选区工具」**：地板选区与 `orchestrator.commitPlayerSelection` 衔接，应用面含存储区与任务标记类工具，与文档列举的三种用途**同构**（具体是否全覆盖以 `player`/`game` 过滤逻辑为准）。
- **「地图初始化 · 物资/树木」**：世界实体由 `bootstrapWorldForScene` / `WorldCore` 播种，`GameScene` 只负责**画**；与文档「散落、未标记可拾取」等对的是**领域状态**，场景无第二套权威数据。
- **「悬停信息与 mock 地形」**：`game-scene-presentation.ts` 的 `formatGridCellHoverText` 实际引用 **`../data/grid-cell-info`**，其中硬编码 **`mock · …`  biome 旋转串**与「障碍（mock 石块）」文案——这与 `oh-gen-doc/地图系统.yaml` 纯抽象「地图格属性」**无对应条目**，属于**未文档化的展示用假数据**（或应在 UI/地图文档中明确为临时表现）。

### 显式对照 `oh-acceptance/地图系统.yaml`

- **MAP-001**：场景负责「地图上能看见地形、小人、散落物、树木」；小人开局列表在 `GameScene.create` 由 `createDefaultPawnStates` 生成，与世界 bootstrap 并列存在，**完整初始态**需与 `world-bootstrap` 合看。
- **MAP-002 / MAP-004**：选区提交走 orchestrator；`pointerCell(..., clampToGrid)` 在拖动时对像素**钳到网格范围**，与 **MAP-004「剔除越界」**的交互侧预期相符；存储区边界绘制在 `zone-overlay-renderer`。
- **MAP-003**：不可放置时领域拒绝；若仅以 foot HUD **一行结果**反馈，红色虚影等需对照建筑渲染与 command 配置——场景目录内 `building-renderer` 承担实体/蓝图绘制，是否含「红虚影」需单独看 renderer 与数据字段（本报告只标为待核对项）。

---

## 代码里大致怎么走（入口与协作）

- **`GameScene.ts`**：`create` 中 `bootstrapWorldForScene` → 多 `Graphics` 图层 → `GameOrchestrator`（含 sim 读写器与 hooks：同步树与地面、重画石格/交互点、小人视图、标记叠层、悬停、详情面板）→ `GameSceneFloorInteraction` / `GameSceneCameraControls` / `GameSceneKeyboardBindings`；`update` 每帧 `orchestrator.tick` 并可选写入 runtime 日志。
- **`game-scene-floor-interaction.ts`**：指针 → `floor-selection` / `brush-stroke` → `commitPlayerSelection` → 更新 `taskMarkersByCell` 并重画标记。
- **`game-scene-presentation.ts`**：昼夜调色盘刷新格线与标签色；指针 → 格悬停高亮 + `formatGridCellHoverText`；标记合并 `mergeMarkerOverlayIfChanged` 委托 orchestrator。
- **`game-scene-hud-sync.ts`**：把当前命令的 **modeLine** 与世界快照脚注打到 HUD（对应 UI-001 的「模式提示」骨架）。
- **`renderers/*.ts`**：格线、树、地面物、建筑/蓝图、存储区、小人（含工时条）、选区线与任务标记圆环。
- **`mock-*.ts` 与 `villager-tool-bar-config.ts`**：均为 **`@deprecated`，仅 Re-export `src/data/*`**；全仓库 **未发现** 从 `src/scenes/mock-*` 或 `villager-tool-bar-config` 的 TypeScript import；测试组件 **`tests/component/mock-task-marker-*.test.ts` 直接引用 `src/data/task-markers`**。因此这些文件当前是**纯兼容层 / 文档陈旧路径的残留**。

---

## 尚不明确或需要产品/策划拍板

1. **`src/scenes/mock-*.ts` 与 `villager-tool-bar-config.ts` 是否保留、更名还是删除**：已无代码引用，但 `docs/ai/index/system-index.json` 等仍登记旧路径，与「单一真实来源在 `src/data`」是否冲突需定维护策略。
2. **相机缩放平移**：已实现；是否升格写入 `oh-gen-doc/UI系统.yaml` 并补验收（替代「待补充」）由策划与 QA 决定。
3. **`grid-cell-info` 中 mock 地形名**：是否替换为与 `oh-gen-doc/地图系统.yaml` 一致的地形/区域模型，或明确为**仅限开发演示**的 UI 文案。
4. **YAML 场景面板、`applyHeadlessScenarioDefinition`、运行时调试日志面板、英文变种 `alt-en`**：工程能力提升明显，但 **oh-gen-doc / oh-acceptance 的 UI 与地图条目中未描述**；需标记为**非交付能力**或补充文档/验收边界。
5. **UI-002 与 pawn 上进度条**：若产品上强调「树上方」而非「小人身上」，是否需要独立树附着的进度 UI，属表现规格问题。

---

## 问题清单

| # | 摘要 | 类型 | 涉及路径 / 说明 |
|---|------|------|----------------|
| S1 | `mock-*.ts`、`villager-tool-bar-config.ts` 为弃用 Re-export，**零 TS 引用** | **无用兼容** | `src/scenes/mock-*.ts`、`src/scenes/villager-tool-bar-config.ts`；建议统一迁移文档索引到 `src/data/*` 后删除或保留极薄 shim 再评估。 |
| S2 | aidoc **`system-index.json` 仍指向 `src/scenes/mock-*`**，与真实 import（`src/data`、`hud-manager`）不一致 | **多套并行**（文档 vs 代码入口） | `docs/ai/index/system-index.json`；易造成「改动误改 scenes 转发层」的认知偏差。 |
| S3 | 格悬停文案含 **mock 地形**与「mock 石块」 | **孤立需求**（相对 `oh-gen-doc/地图系统.yaml`） | `src/data/grid-cell-info.ts`，由 `game-scene-presentation.ts` 调用；策划文档未定义该类展示数据。 |
| S4 | **相机缩放/平移**已实现，`oh-gen-doc/UI系统.yaml` 仍写「待后续需求补充」 | **文档滞后** | `game-scene-camera-controls.ts` vs `oh-gen-doc/UI系统.yaml`「地图界面 · 缩放与平移」。 |
| S5 | **YAML 场景热切换、调试面板、runtime tick 日志** | **孤立需求**（相对当前 oh UI/地图） | `GameScene.applyHeadlessScenarioDefinition`、`setupYamlScenarioPanel`、`syncDebugPanel` 等；非 story-1 UI/地图验收明文范围。 |
| S6 | **UI-002**「树或小人上方进度条」vs 实现为 **pawn-renderer 条形** | **待验收对齐** | `src/scenes/renderers/pawn-renderer.ts`；需 QA 按 `oh-acceptance/UI系统.yaml` **UI-002** 表决是否通过。 |
| S7 | **MAP-003** 红虚影/禁放反馈是否在 `building-renderer` 与 foot HUD 间完整闭环 | **待核对** | `src/scenes/renderers/building-renderer.ts` 与 orchestrator 返回摘要；未在本审计中展开每分支。 |

---

*本报告仅新增说明性 Markdown，未修改任何源码。*
