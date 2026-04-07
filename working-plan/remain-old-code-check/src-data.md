# 审计：`src/data/`

对照文档：`oh-gen-doc/UI系统.yaml`、`oh-gen-doc/地图系统.yaml`、`oh-gen-doc/工作系统.yaml`、`oh-acceptance/UI系统.yaml`、`oh-acceptance/地图系统.yaml`、`oh-acceptance/工作系统.yaml`（下文按条款语义引用，不贴全文）。

---

## 一句结论

`src/data/` 主要承载**三类东西**：(1) **命令菜单 + 村民工具条 + Phaser 键位**的静态配置，把 UI 选中的「指令/结构/家具」映射到**领域动词字符串**与任务标记用 `toolId`；(2) **任务标记叠加层**逻辑，直接依赖 `WorldSnapshot` 里的 `markers` / `entities` / `workItems` 形态；(3) **演示用静态表**：格子 hover 的 mock 生物群系、`MOCK_SCATTERED_GROUND_ITEMS`、以及与小人之 id 对齐的 **mock 人物小传**。与 `oh-gen-doc/UI系统.yaml`、`oh-gen-doc/交互系统.yaml` 相比，**菜单层级被压平为三类 + 热键槽位**，且多出开采/拆除/割草/巡逻/待机等**文档未逐条展开的指令**；与 `oh-gen-doc/地图系统.yaml` / `oh-gen-doc/实体系统.yaml` 相比，**地面散落物与物资类型枚举不对齐**，hover 文案与领域 `resource` 并行；与 `oh-gen-doc/工作系统.yaml` 相比，`task-markers` 里写死的 `workItems.kind` 分支是**实现契约**而非 YAML 字段。整体偏「可玩原型 + .headless 观测共用的单一事实源」，其中明确标注 mock 的文件与**场景 mock 重导出**（`src/scenes/mock-*.ts`）强绑定。

---

## 要解决什么问题（审计视角）

从 `oh-gen-doc/UI系统.yaml` / `oh-acceptance/UI系统.yaml`（如 **UI-001** 菜单进入模式、**UI-004** 多层反馈）出发，策划关心的是**菜单结构、模式切换、地图反馈**。本目录的 `command-menu.ts` 提供**命令 id、输入形态（矩形/笔刷/单格）、modeKey、领域动词**的一站式表，是 HUD 与 `commit-player-intent` 的中间层；`villager-tools.ts` 则把**展示标签与 Q–P 热键**钉死在另一张表上，并与 `COMMAND_MENU_HOTKEY_COMMAND_IDS` **运行时校验长度一致**。

从 `oh-gen-doc/地图系统.yaml` / `oh-acceptance/地图系统.yaml`（如 **MAP-001** 初始化散落物资、`oh-gen-doc` 中「物资分布」）出发，策划关心的是**格子上真实物资与占用**。`grid-cell-info.ts` 与 `ground-items.ts` 却在注释中写明**未来接入真实地图/库存时替换**，当前用固定坐标 + 虚构「生物群系」字符串服务 hover。

从 `oh-gen-doc/工作系统.yaml` / `oh-acceptance/工作系统.yaml`（如 **WORK-001** 伐木标记、**WORK-002** 拾取）出发，任务标记层要把**玩家意图**与**领域工单**在格子上对齐；`task-markers.ts` 通过快照里的 `chop-tree`、`mine-stone`、`pick-up-resource` 等分支生成展示用 `label`，与文档里的工作类型**语义相近但命名完全是代码内部枚举**。

从 `oh-gen-doc/实体系统.yaml` 出发，小人属性列的是位置、状态、携带物、饱食度等；`pawn-profiles.ts` 的绰号、bio、mockTags **未见于 YAML**，属纯展示用虚构内容。

---

## 设计上怎么应对（文档应然 vs 代码现状）

### 对照 `oh-gen-doc/UI系统.yaml` 与 `oh-acceptance/UI系统.yaml`

- **文档**：`菜单系统` 下 **区域→存储区→新建**、**建造→墙→木墙**、**家具→木床**；`工具栏/交互组件` 强调伐木工具、物资拾取标记、选区、蓝图笔刷等。
- **代码**：`COMMAND_MENU_CATEGORIES` 将「指令」槽与「结构」「家具」并列；`storage-zone` / `build-wall` / `place-bed` 与文档三类**能对应**，但 **orders** 下另有 mine、demolish、mow、lumber、farm、haul、patrol、idle 等，**超出** UI YAML 中「第一天流程」与工具栏枚举的篇幅。
- **热键**：`VILLAGER_TOOL_KEY_CODES` 写死 Phaser 键码与 Q–P 顺序；文档未规定具体按键，属**实现细节**。
- **验收**：`oh-acceptance/UI系统.yaml` 的 **UI-001** 描述的是层级点击与模式指令；代码侧由 `CommandMenuCommandId` + `commandMenuDomainSemantics` 统一转发，**路径不同、目标可对齐**，需在问题清单记录「策划菜单树 vs 热键扁平槽」的张力。

### 对照 `oh-gen-doc/地图系统.yaml` 与 `oh-acceptance/地图系统.yaml`

- **文档**：地图格、可走性、存储区、选区、初始化时**散落物资**与树木等。
- **代码**：`formatGridCellHoverText` 拼接 **mock 地形名** + `isWalkableCell` + `groundItemAt`；`MOCK_SCATTERED_GROUND_ITEMS` 使用「木柴、石块、浆果…」等 **displayName**， neither 来自 `oh-gen-doc/实体系统.yaml` 里物资类型的 **枚举可选值**（仅列了初始物资/木头/包装食品等），也**不与** `WorldCore` 播种的 `resource` 表同源。
- **验收**：**MAP-001** 期望领域侧占用与渲染一致；若 hover 仍读静态 mock，**验收观测到的「地上有什么」可能与领域快照分叉**。

### 对照 `oh-gen-doc/工作系统.yaml` 与 `oh-acceptance/工作系统.yaml`

- **文档**：伐木、建造、拾取、搬运等工作类型与状态机词汇。
- **代码**：`mergeTaskMarkerOverlayWithWorldSnapshot` / `worldDerivedTaskLabelForCell` 依赖 **`deconstruct-obstacle` marker、`blueprint` 实体、`chop-tree` / `mine-stone` / `pick-up-resource` workItems**；这些是 **TypeScript 领域模型字符串**，YAML 未逐字列出，属于**实现层契约**；玩家侧 `domainVerb` 如 `assign_tool_task:lumber` 同样**未出现在 oh YAML**。
- **验收**：**WORK-001/002** 谈标记与工单语义；`task-markers` 负责**格上短文案**而非完整工单生命周期，边界清晰，但 **YAML 改版时无法从文档 diff 驱动**这些分支。

### 对照 `oh-gen-doc/实体系统.yaml`（小人）

- **文档**：小人属性无「档案文案」。
- **代码**：`MOCK_PAWN_PROFILES` 为 `pawn-0`…`pawn-4` 提供叙事字段；与模拟层 id 对齐，**玩法上不承诺**，但 HUD 已依赖 `pawnProfileForId`。

---

## 代码里大致怎么走（入口与协作）

- **`command-menu.ts`**：`COMMAND_MENU_*` 表、`commandMenuDomainSemantics`、`COMMAND_MENU_HOTKEY_COMMAND_IDS` 与 `villager-tools` 联动校验。消费者含 `GameScene`、`hud-manager`、`menu-model`、`commit-player-intent`、`build-domain-command`、`game-scene-keyboard-bindings`、`scenario-observers` 等。
- **`villager-tools.ts`**：`VILLAGER_TOOLS`、键码数组、`validateVillagerToolBarConfig`。槽位 4 的 `id: "build"` 注释说明与命令菜单里 **木墙/木床** 的分工；槽位 9 为 `zone_create`，与菜单 `storage-zone` 的 `markerToolId` 一致。
- **`task-markers.ts`**：`applyTaskMarkersForSelection`、`mergeTaskMarkerOverlayWithWorldSnapshot`、`issuedTaskLabelForToolId`；依赖 `../game/world-core` 与 `../game/map/world-grid`，**data 目录并非纯静态表**。
- **`grid-cell-info.ts`**：调用 `ground-items` 与 `world-grid` 可走性，输出多行 hover 文本；`game-scene-presentation` 使用。
- **`ground-items.ts`**：`MOCK_SCATTERED_GROUND_ITEMS`、`groundItemAt`；`mock-ground-items.ts` 再导出给场景层。
- **`pawn-profiles.ts`**：`hud-manager`、场景 `mock-pawn-profile-data.ts`。

---

## 尚不明确或需要产品/策划拍板

1. **命令全集**：`oh-gen-doc/UI系统.yaml` / `oh-gen-doc/交互系统.yaml` 是否应将 **mine / demolish / mow / patrol / idle** 等纳入正式菜单或工具规范，还是长期视为工程演示指令？
2. **领域动词命名**：`assign_tool_task:*`、`build_wall_blueprint`、`zone_create`、`place_furniture:bed`、`clear_task_markers` 是否应在某份 oh 文档或 `oh-code-design` 中登记为**稳定契约**，以便任务树与 headless 场景不偷偷漂移。
3. **地面物资单一事实源**：`MOCK_SCATTERED_GROUND_ITEMS` 与领域 `resource` / `oh-gen-doc/实体系统.yaml` 物资类型 —— 以谁为准、hover 是否必须只读快照。
4. **人物档案**：mock 小传是否在某一版需求中升级为「游戏内设定」；若否，是否应在 UI 验收中明确为 **可替换占位**（对照 `oh-acceptance/UI系统.yaml` **UI-003** 仅关心状态与需求而非档案文学性）。

---

## 问题清单

| # | 摘要 | 类型（见 `working-plan/remain-old-code-check/README.md`） | 说明与文档对照 |
|---|------|----------------|---------------|
| P1 | 命令菜单含多篇 oh 未列出的指令（开采、拆除、割草、巡逻、待机） | **孤立需求 / 超前实现** | `oh-gen-doc/UI系统.yaml` 主叙事偏「区域/墙/床 + 伐木/拾取标记」；若保留需补策划或标为 dev-only。 |
| P2 | `domainVerb` 与 `markerToolId` 字符串未在 oh YAML 登记 | **实现契约漂移风险** | 对照 `oh-gen-doc/工作系统.yaml` 仅有自然语言工作类型；改名只能靠代码检索。 |
| P3 | `task-markers.ts` 依赖 `WorldSnapshot` 内部 kind（`chop-tree`、`pick-up-resource` 等） | **与文档粒度不一致** | `oh-acceptance/工作系统.yaml` **WORK-001/002** 验语义不验这些 id；重构快照易漏改标记层。 |
| P4 | `VILLAGER_TOOLS` 槽「build」合并木墙与木床提示，与菜单两命令拆分 | **展示与心智模型分叉** | 与 `oh-gen-doc/UI系统.yaml`「墙」「木床」分菜单一致的是命令表，热键条是另一叙事。 |
| P5 | `grid-cell-info` / `ground-items` 固定 mock 坐标与 displayName | **多套并行** | `oh-gen-doc/地图系统.yaml` 初始化与 `oh-gen-doc/实体系统.yaml` 物资类型未涵盖这些具体名字与同格领域实体同步策略。 |
| P6 | `pawn-profiles` 档案字段无 `oh-gen-doc/实体系统.yaml` 依据 | **孤立需求（展示）** | 不影响领域状态，但会在 HUD 中长期出现「mock」叙事；若正式化需补文档或验收预期。 |
| P7 | `src/scenes/mock-*.ts` 对 data 模块再导出 | **场景强绑定** | 非 data 内文件，但说明本目录配置被**显式标为 mock 消费路径**；headless `scenario-types` 引用 `CommandMenuCommandId` 共享同一枚举。 |

---

*本报告仅审计 `src/data/`，未修改任何源码。*
