# 审计：`src/game/interaction/`（T-06）

对照文档（事实源与验收）：

- 需求设计：`oh-gen-doc/交互系统.yaml`（玩家输入：选区工具、蓝图笔刷、菜单层级与多种交互模式；交互反馈与首日流程等）。
- 验收场景：`oh-acceptance/交互系统.yaml`（INTERACT-001～004：`gen_doc_ref` 指向同上 `oh-gen-doc/交互系统.yaml`）。

---

## 一句结论

`src/game/interaction/` 里**真正跑进 Phaser 主路径**的是「地面框选/修饰键」纯函数（`floor-selection.ts`）与领域命令类型（`domain-command-types.ts`）；而 `mode-registry.ts` + `session-manager.ts` 所表达的「模式注册表 + 选区/笔刷会话 → 领域命令」与 **`src/player/build-domain-command.ts` + `src/data/command-menu.ts` 已构成第二套、且已接线的命令装配链**，前者目前**几乎只活在单测里**，属于明显的双轨。另：`oh-gen-doc/交互系统.yaml` 与 `oh-acceptance/交互系统.yaml` 中的**物资拾取标记**（INTERACT-001）在现有命令菜单与默认 mode 种子中**没有同名、同意图的稳定入口**，文档承诺领先于或可执行路径。

---

## 要解决什么问题（审计视角）

从 `oh-gen-doc/交互系统.yaml` 出发，期望玩家通过**选区工具 / 蓝图笔刷 / 菜单**进入不同模式，并在领域侧产生与模式一致的命令与状态更新；`oh-acceptance/交互系统.yaml` 进一步把「选区会话 / 笔刷会话 / 模式注册表 / 命令生成 / 无效模式屏蔽」写成了可验收的 `given/when/then`。

本目录审计要回答的是：**这些承诺在代码边界上由谁实现、是否只有一条权威路径、是否与 UI/场景层重复造了「同一类命令」**。

---

## 设计上怎么应对（应然与现状偏差）

**应然（对齐 YAML）：**

- `oh-gen-doc/交互系统.yaml` 的「选区工具」输出格列表，「蓝图笔刷」输出路径格集合，「菜单选择」进入对应模式；各 **交互模式**（存储区创建、物资拾取标记、伐木、蓝图绘制、家具放置）应对应一致的领域结果与反馈要点。
- `oh-acceptance/交互系统.yaml` **INTERACT-004** 要求：无有效工具模式时，**模式注册表**判定无解释规则，**不生成交互命令**；呈现上允许地图平移但不出现选区框/虚影。

**现状偏差（代码事实）：**

1. **双轨命令语义**  
   - `mode-registry.ts` 中 `seedDefaultModes` 将 `menuId` 写死为 `"interaction-mode"`，`itemId` 为 `zone-create` / `chop` / `build-wall` / `build-bed`（见该文件内 `interactionModeSource` 与默认模式条目），与 `command-menu.ts` 里真实的 `categoryId`（`orders` | `structures` | `furniture`）和 `CommandMenuCommandId`（如 `storage-zone`、`lumber`、`build-wall`、`place-bed`）**不是同一套来源**，但动词层（`zone_create`、`assign_tool_task:…`、`build_wall_blueprint`、`place_furniture:bed`）意图重叠。
   - 运行时的 **`GameSceneFloorInteraction`**（`src/scenes/game-scene-floor-interaction.ts`）在 pointer up 时走 **`orchestrator.commitPlayerSelection`**，内部用 **`buildDomainCommand`**（`commit-player-intent.ts`），**从不调用** `beginSession` / `commitSession`；全仓库 `rg` 可见后两者仅出现在 `src/game/interaction/*` 与 `tests/domain/mode-registry.test.ts`。

2. **`src/game/interaction/index.ts` 的边界模糊**  
   除本目录实现外，**重新导出** `../../player/apply-domain-command`、`build-domain-command`、`commit-player-intent`、`brush-stroke`、`tool-input-policy` 等。对外读者会以为「交互域」包含整条玩家链，实则**核心装配已在 `src/player`**。

3. **文档与菜单/模式的缺口**  
   - `oh-gen-doc/交互系统.yaml` 的 **物资拾取标记模式** 与 `oh-acceptance/交互系统.yaml` **INTERACT-001**（选区命中物资 → 「标记可拾取」命令 → 实体可拾取状态）在 **`mode-registry` 默认模式**与 **`command-menu` 命令列表**中均无直接对应项（命令表中有「搬运 `haul`」等工单类工具，但无文档用语下的专用「拾取标记」）。  
   - `oh-gen-doc/交互系统.yaml` 中伐木对应 **INTERACT-001/002** 以外的工单叙述；代码里 `chop` 模式与菜单 `lumber` 并存两套 id，加剧对齐成本。

4. **INTERACT-004 与地图平移**  
   验收写明无模式时「可能触发地图平移」；本审计未展开 `src/scenes` 相机拖拽实现，仅记录：**无命令时 `handleFloorPointerDown` 早退**（`game-scene-floor-interaction.ts` 在 `getCommandMenuCommand` 为空时 `return`），与「不生成领域命令」一致，但是否单独实现平移需结合场景其它输入绑定核对（不在本小节展开）。

---

## 代码里大致怎么走（入口与协作）

- **地面矩形选区与修饰键**（对齐 `oh-gen-doc/交互系统.yaml` 选区工具的大半行为）：`floor-selection.ts` 维护 `FloorSelectionState`、矩形 `rectCellKeysInclusive`、`replace`/`union`/`toggle`。被 **`GameSceneFloorInteraction`** 与 **`selection-renderer`**、**`commit-player-intent`** 等引用，是**跨场景与玩家的共享纯逻辑**。
- **领域命令形状**：`domain-command-types.ts` 定义 `DomainCommand`、`InteractionSource`、`MockWorldSubmitResult` 等；**`src/player/s0-contract.ts` 仅 re-export**，作为「线间契约」入口。
- **模式 + 会话（当前未接主线）**：`createModeRegistry` 注册默认四种模式；`session-manager.ts` 的 `commitSession` 调用当前模式的 `explainRule` 生成 `DomainCommand`。该路径与 **`buildDomainCommand`（基于 `commandMenuDomainSemantics`）功能重叠**，但数据源不同。
- **对外聚合**：`index.ts` 把上述与 `player` 层多条 API 捆在一起，方便单点 import，但也**模糊了子系统边界**。

---

## 尚不明确或需要产品/策划拍板

1. **权威链路是否应收敛为一条**：保留 `mode-registry`+`session-manager` 作为唯一「从模式到命令」实现，并让菜单只驱动 `modeId`；或删除/冻结测试专用第二轨，以 **`command-menu` + `buildDomainCommand`** 为唯一来源。涉及重构范围与测试策略，需拍板。
2. **INTERACT-001 / `oh-gen-doc/交互系统.yaml` 物资拾取标记** 与现有 **工单工具（如 `haul`）** 是合并为一种交互还是分立工具；若分立，菜单、modeId、`domainVerb` 与实体「可拾取」字段由谁消费，需策划与系统设计对齐。
3. **`interaction/index.ts` 对 `player` 的 re-export** 是否为长期公开的「门面 API」，还是过渡期的便利导出；若长期，是否应在文档（`oh-code-design/交互系统.yaml` 若有）中写明模块依赖方向。

4. **T-06 验收中的 `npx tsc --noEmit`**：本次未改源码；当前仓库仍有与 behavior/ui/tests 等相关的既有 TS 报错，与 `src/game/interaction/` 无直接因果。若验收要求全仓零报错，需在其它任务处理基线。

---

## 问题清单

| 编号 | 类型 | 摘要 | 对照依据 |
| --- | --- | --- | --- |
| P1 | 多套并行 | `mode-registry`+`session-manager` 与 `command-menu`+`buildDomainCommand` 两条链并行定义「从输入形状 + 选中格 → DomainCommand」，主线场景只走后者；前者主要在 `tests/domain/mode-registry.test.ts` 使用。 | `oh-acceptance/交互系统.yaml` INTERACT-001～003 的 domain_state 描述「选区会话 / 笔刷会话 / 模式注册表 / 命令生成器」——实现上职责被拆到两条链，易出现漂移。 |
| P2 | 多套并行（来源漂移风险） | 默认模式的 `InteractionSource` 使用 `menuId: "interaction-mode"`，与真实 HUD 菜单的 `categoryId`/`CommandMenuCommandId` 不一致；`build-domain-command.ts` 内虽对 `interaction-mode` 做了 `taskMarkerToolIdForDomainCommand` 分支，但增加「两套菜单宇宙」的维护成本。 | `oh-gen-doc/交互系统.yaml` 菜单层级示例与 `oh-acceptance` 中「菜单进入某模式」叙述要求来源一致、可回放。 |
| P3 | 边界模糊 / 技术债 | `interaction/index.ts` 大量 re-export `src/player`，使「交互子系统」目录与「玩家意图装配」目录耦合；新读者难以从目录名判断单一事实来源。 | 与 `oh-acceptance/交互系统.yaml` 中 domain_state 与 presentation 分层意图相关——层次存在，但物理模块边界不清。 |
| P4 | 文档承诺 vs 实现缺口 | `oh-gen-doc/交互系统.yaml` **物资拾取标记模式** 与 `oh-acceptance/交互系统.yaml` **INTERACT-001** 未在 `mode-registry` 默认模式或 `command-menu` 中找到等价命名与动词闭合链路。 | 两文件显式条款；当前代码为部分工单类 rect 工具，缺少验收中的「过滤物资实体 → 可拾取状态」专用路径表述。 |
| P5 | 待确认（非自动判死） | `domain-command-types.ts` 注释写明 S0 mock/可替换契约，属过渡说明；是否在 route-demand 链路中已登记为「显式 stub」、替换时间表，需与 `oh-code-design/交互系统.yaml`（若存在）核对；本报告仅标为跟踪项。 | 与 README「测试替身与生产路径分离且文档登记则不一定算问题」一致——需文档侧确认后再归类。 |
