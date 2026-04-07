# 审计：`src/player/`（T-13）

对照文档（事实源与验收）：

- 需求设计：[`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) — 定义「选区工具」「蓝图笔刷」「菜单选择」三种玩家输入，以及存储区创建、物资拾取标记、伐木标记、蓝图绘制、家具放置等 **交互模式**，并描述视觉/状态反馈与首日决策流程。
- 验收场景：[`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) — `gen_doc_ref` 指向同上；场景 **INTERACT-001～004** 将「选区会话 / 笔刷会话 / 模式注册 / 命令生成 / 无效模式屏蔽」写成可验收的 `given` / `when` / `then`（含 `domain_state` 与 `presentation`）。

---

## 一句结论

`src/player/` 把「菜单命令 + 地面选区/笔刷/单点格集合」收成 **`DomainCommand`**，经 **`PlayerWorldPort.submit`** 交给世界（真实 **`WorldCoreWorldPort`** 会改 **`WorldCore`**，**`MockWorldPort`** 只记日志并可选拒收），再在网关**接受**后叠加任务标记并与世界快照合并。这与 [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) 里「选区 / 笔刷输出格列表、菜单进入模式、领域产生建造或标记类结果」的方向一致；但 **Mock 路径对「格级过滤」恒等放行**，与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-001** 所说的「过滤出格内物资实体」在**测试替身语义**上并不等价。另：**`submit` 前检票逻辑**在 **`mock-world-port.ts`** 与 **`world-core-world-port.ts`** 中**重复实现**，属于可维护性上的双份兼容层。

---

## 要解决什么问题（审计视角）

从 [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) 看，策划期望玩家用**框选**或**笔刷轨迹**得到格集合，再用**菜单**区分模式，最终在世界里留下存储区、蓝图、工单或标记等结果，并有选区框、虚影、标记图标等反馈要点。

从 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) 看，**INTERACT-001～003** 明确点名「选区会话管理器 / 笔刷会话管理器 / 交互命令生成器 / 建筑或实体系统」等职责；**INTERACT-004** 要求无有效工具模式时**不生成领域命令**、呈现上不出现选区/虚影（允许地图平移若支持）。

本目录审计要回答：**上述承诺里，哪些落在 `src/player` 的边界内、Mock 与真实网关是否表达同一契约、以及是否存在「并行实现 / 文档用语与动词命名」带来的漂移风险**。

---

## 设计上怎么应对（应然与现状偏差）

**应然（对齐两份 YAML）：**

- [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml)：**蓝图笔刷**对应路径格集合，**选区工具**对应矩形内全部格；各模式应对应一致的领域结果（存储区、拾取标记、伐木标记、墙蓝图、床放置等）。
- [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml)：**INTERACT-002** 要求笔刷路径去重格集合；**INTERACT-003** 要求单点确认；**INTERACT-001** 要求命令侧过滤格内物资并更新可拾取相关状态；**INTERACT-004** 要求无模式时不派命令。

**现状偏差（代码事实）：**

1. **网关双实现、检票重复**  
   **`MockWorldPort`**（`mock-world-port.ts`）与 **`WorldCoreWorldPort`**（`world-core-world-port.ts`）共享 **`PlayerWorldPort`**，二者对 `rejectIfTouchesCellKeys`、`alwaysAccept` 的**早拒逻辑几乎同构**，仅后者在通过后调用 **`applyDomainCommandToWorldCore`**。这是刻意的 **A/B 线并行**，但「合并冲突格 / 关闭 alwaysAccept」规则一旦要改，需要改两处。

2. **Mock 对「任务标记可画格」不做领域过滤**  
   **`MockWorldPort.filterTaskMarkerTargetCells`** 原样返回传入 `cellKeys`。**`commitPlayerSelectionToWorld`** 在端口**不带** `getWorld()` 时走该接口；因此在 **Mock** 上，**接受后**的标记叠加可能与 **`WorldCoreWorldPort` + `filterCellKeysForToolbarTaskMarkers`** 的「只标会接单/可探测成功的格」不一致。对照 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-001** 的 presentation「被选物资上出现可拾取标记」，**B 线单测若仅用 Mock，可能看不到「空格不标」类差异**。

3. **命令装配与 YAML 名词的对应关系分散**  
   **`build-domain-command.ts`** 将 **`command-menu`** 语义打成 **`DomainCommand`**；**`apply-domain-command.ts`** 将动词落到 **`WorldCore`**（含 **`assign_tool_task:haul`** → 拾取类工单等）。**[`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml)** 使用「物资拾取**标记**模式」等策划用语，验收 **INTERACT-001** 写「可拾取状态」；代码侧则是**工单登记**口径，**命名与文档不一一对应**，对齐成本在 `player` + `data/command-menu` + `game` 之间分摊，而非本目录单独能闭合。

4. **`interaction-mode` 兼容分支**  
   **`taskMarkerToolIdForDomainCommand`** 仍为 `menuId === "interaction-mode"` 的旧式 `itemId` 保留映射。与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) 强调的「菜单进入真实模式」相比，这是**第二套菜单宇宙**的余量，易与 **`command-menu`** 主路径漂移（另见 `src-game-interaction.md` 双轨叙述）。

5. **目录内的「非交互」薄文件**  
   **`s0-contract.ts`**、**`need-signals.ts`** 仅为重导出，**`scenario-loader.ts`** 偏重场景注水与 **`WorldCoreWorldPort` + commit** 的编排：它们服务玩家/世界管线，但与 [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) 的 UI 交互条款**距离较远**，阅读边界时需注意「player 目录 ≠ 仅交互」。

---

## 代码里大致怎么走（入口与协作）

- **笔刷格累积（对齐策划「蓝图笔刷」轨迹）**：**`brush-stroke.ts`** 在网格上沿线段扩张 **`accumulatedKeys`**，与 Phaser 解耦；形状上支撑 [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml)「拖拽划过路径」与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-002**「去重格坐标集合」的输入侧。
- **工具 → 选区/笔刷形态**：**`tool-input-policy.ts`** 将 **`build`** 映射为 **`brush-stroke`**，其余为 **`rect-selection`**，与策划「建造类笔刷、其余框选」一致。
- **HUD 文案（交互反馈中的状态提示子集）**：**`interaction-mode-presenter.ts`** 按 **`command-menu`** 的 **`inputShape`** 生成 **`modeLine`** / **`usesBrushStroke`**，不做法域裁决。
- **意图提交主链路**：**`build-domain-command.ts`** → **`commitPlayerSelectionToWorld`**（**`commit-player-intent.ts`**）：先构命令，再 **`submit`**；**拒绝**时保持 **`currentMarkers`**，**接受**后用 **`applyTaskMarkersForSelection`** + **`mergeTaskMarkerOverlayWithWorld`** 更新叠加层——与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-004**「无效则不改世界」精神在「网关拒绝不回写标记」上同向，但 **INTERACT-004 整条「无模式不派发」** 仍依赖上游不传 **`commandId` / 不 commit**（ orchestrator / 场景侧），**不在本目录单独完成**。
- **领域生效**：**`WorldCoreWorldPort.submit`** → **`apply-domain-command.ts`**；**`MockWorldPort.submit`** 只记日志并返回 **`MockWorldSubmitResult`**。
- **场景注入**：**`scenario-loader.ts`** 在 **`WorldCoreWorldPort`** 上重放 **`playerSelectionAfterHydrate`**，与实机 **`commandId` + inputShape** 对齐（注释已写明）。

---

## 尚不明确或需要产品/策划拍板

1. **Mock 的契约范围**：**`MockWorldPort`** 是否应逐步模拟 **`filterTaskMarkerTargetCells`** 的关键过滤（至少在「无实体格不标」层面），以便 B 线更贴近 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-001～003** 的呈现口径；还是明确约定「Mock 仅测命令日志与拒收，不做呈现等价」。
2. **`interaction-mode` 旧 `itemId` 生命周期**：是否在某一里程碑删除 **`taskMarkerToolIdForDomainCommand`** 中 **`interaction-mode`** 分支，统一以 **`command-menu`** 为唯一 **`InteractionSource`**，减少与 [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) 菜单示例不一致的第二来源。
3. **文档动词与实现动词**：[`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml)「物资拾取标记」与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml)「可拾取状态」是否**必须**在 `oh-code-design` 或数据表里映射到现有 **`assign_tool_task:haul`** / 实体字段名——避免策划、验收、代码三端各说各话。
4. **网关检票重复**：**`submit` 内 `rejectIfTouchesCellKeys` / `alwaysAccept`** 是否应抽成**单处**纯函数供 Mock 与 WorldCore 共用，属于工程卫生，但若牵涉「仅 B 线行为」需与集成测试约定一起拍板。

---

## 问题清单

| 编号 | 类型 | 摘要 | 对照依据 |
| --- | --- | --- | --- |
| P1 | 多套并行 | **`MockWorldPort` 与 `WorldCoreWorldPort` 的 `submit` 前半段（冲突格、`alwaysAccept`）逻辑重复**，规则变更需双改。 | 与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) 网关式 **接受/拒绝** 行为一致，但实现上为双份。 |
| P2 | 无用兼容 / 来源漂移 | **`taskMarkerToolIdForDomainCommand` 保留 `interaction-mode` + 旧 `itemId` 映射**，与主 **`command-menu`** 宇宙并存。 | [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) 菜单层级与 [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml)「通过菜单进入模式」宜单一事实来源。 |
| P3 | 多套并行（语义） | **Mock 的 `filterTaskMarkerTargetCells` 恒等返回全部格**，与 **`WorldCoreWorldPort` + `task-marker-target-cells`** 的「按世界状态过滤」**不等价**；B 线验证呈现时可能**假阳性**。 | [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-001** `domain_state` / `presentation` 隐含「命中实体才应出现标记」类预期。 |
| P4 | 文档 vs 实现（命名） | **策划「物资拾取标记 / 可拾取」** 与代码 **`haul` + 拾取工单** 及实体字段的**用词未在本目录闭合**。 | [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) **物资拾取标记模式**；[`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml) **INTERACT-001**。 |
| P5 | 孤立需求 / 边界 | **`need-signals.ts` 仅为 `../game/need/need-signals` 再导出**，与交互 YAML 无直接关系；列入本审计仅说明 **player 目录职责混杂**。 | 「孤立」相对 [`oh-gen-doc/交互系统.yaml`](../../oh-gen-doc/交互系统.yaml) / [`oh-acceptance/交互系统.yaml`](../../oh-acceptance/交互系统.yaml)；未必是缺陷，但增加读者心智负担。 |

---

**说明**：本次仅新增本 Markdown，**未修改源码**；`npx tsc --noEmit` 以任务树验收条款为准在集成节点执行（本子报告不引入 TS 变更）。
