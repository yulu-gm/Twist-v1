# 审计：`src/game/building/`

**对照文档**：`oh-gen-doc/建筑系统.yaml`、`oh-acceptance/建筑系统.yaml`（验收场景 BUILD-001～BUILD-004）。  
**范围**：仅 `src/game/building/` 内源码；与玩法链路的衔接点到 `world-core`、`flows/build-flow`、`entity`、`work` 为止便于说明，不展开改代码。

---

## 一句结论

本目录**未发现**显式 mock、stub、legacy 等占位实现（`rg` 无命中），但存在**两套可并行抵达「蓝图 + 建造工单」的事实路径**（`EntityRegistry` + `createBlueprint`/`BUILDING_SPECS` vs `WorldCore` + `safePlaceBlueprint`），且 `building-spec-catalog` 中的 **`onCompleteRules` 在本目录及当前结算链未被读取**，与 `oh-gen-doc/建筑系统.yaml` 中「数据驱动、建成结算」的叙述及 `oh-code-design/建筑系统.yaml` 的模块分工存在**语义间隙**（规格更像文档化目标，而非单一事实源）。与 `oh-acceptance/建筑系统.yaml` 对比：**主交互路径**（玩家指令 → `safePlaceBlueprint`）能覆盖 BUILD-001/003 的大致领域行为，但 **BUILD-002（木床建成自动归属）** 不在本目录实现；World 侧完工逻辑也未在本目录内触发「归属规则器」式自动分配。

---

## 要解决什么问题

从**遗留与双轨审计**视角，本目录需要回答三件事：

1. 建筑类型、占地、交互与「建成后规则」是否在代码中有**唯一、可 trace** 的来源，并与 `oh-gen-doc/建筑系统.yaml`、`oh-acceptance/建筑系统.yaml` 一致。
2. 是否存在仅为旧入口或演示保留的分支（**无用兼容**）。
3. 是否存在**同一验收维度下**两条并行实现、且缺少「仅测试用」边界（**多套并行**）。

---

## 设计上怎么应对

| 文档承诺（摘要） | 应然（设计意图） | 本目录现状与偏差 |
| --- | --- | --- |
| `oh-gen-doc/建筑系统.yaml`：墙体/家具蓝图、施工、落成；木床建成自动分配给无床小人；蓝图无碰撞等待确认 | 类型规格、放置校验、蓝图记录、与工作系统协同、落成与归属规则可串联 | **`BUILDING_SPECS`** 与 **`createBlueprint`** 体现规格与蓝图形状；**`safePlaceBlueprint`** 走 `WorldCore`，**不读取** `BUILDING_SPECS`，占地默认单格（由 `occupiedCells` 或 `cell` 推出），与规格中的多格扩展模型未统一。 |
| `oh-acceptance/建筑系统.yaml` BUILD-001～004 | 放置拦截、蓝图与工作生成、落成实体、床铺归属或可明确无归属 | BUILD-003 的「空间不合法」在 `safePlaceBlueprint` 依赖 `spawnWorldEntity` 冲突/越界，**语义可对齐**；BUILD-002/004 的归属**不在本目录**，而在 `entity/relationship-rules`、`flows/build-flow` 或 World 完工路径。 |
| `building-spec-catalog` 注释：`onCompleteRules` 供建成结算器消费 | 数据驱动的建成后行为 | **`onCompleteRules` 无读取方**（本仓库内落成在 `entity/lifecycle-rules.transformBlueprintToBuilding` 与 `work/work-operations.completeBlueprintWork` 等，均未按该字段分支）。 bed 的交互能力在 **registry 路径** 由 `lifecycle-rules.buildingInteractionCaps` 硬编码，与 **`BUILDING_SPECS` 并行重复**。 |

---

## 代码里大致怎么走

- **对外聚合**：`index.ts` 汇总 `blueprint-placement`、`building-spec-catalog`、`blueprint-manager`。
- **World 主路径（玩家/domain）**：`safePlaceBlueprint` / `placeBlueprint` → `spawnWorldEntity` 创建蓝图快照 → 若无重复工单则写入 `construct-blueprint` 类工单并挂到实体；`world-core.ts` 再导出给 `apply-domain-command`、`scenario-loader`、headless 等。**不经过** `getBuildingSpec`。
- **Registry + 编排路径（测试/流程）**：`flows/build-flow.ts`（目录外）使用 `BUILDING_SPECS` + `createBlueprint` → `WorkRegistry` 的 `kind: "construct"` 工单 → `settleWorkSuccess` → `transformBlueprintToBuilding`。木床 **`assignBedToPawn`** 仅在 `runBuildFlowScenario` 中显式调用，**不是** `onCompleteRules` 解析结果。
- **规格目录**：`BUILDING_SPECS` 含 `wall`/`bed`、占地偏移、`blocksMovement`、`interactionCapabilities`、`onCompleteRules`；与 `oh-gen-doc` 中「木墙、木床」为概念对应，标识符为代码侧 `wall`/`bed`。
- **蓝图管理器**：在 `EntityRegistry` 上维护 `coveredCells`、`buildProgress01`、`buildState` 等，与 World 快照里「蓝图 + occupiedCells」的建模并存。

---

## 尚不明确或需要产品/策划拍板

1. **`oh-gen-doc/建筑系统.yaml` 已写明**蓝图阶段无碰撞为「待确认」——与占用格/寻路表现是否一致，需与地图/行为系统牵头定案（不限于本目录）。
2. **材料消耗**在 gen-doc 中为待确认；本目录无材料逻辑，但若后续写入「建造校验/结算」，需策划与 `工作系统` 文档对齐。
3. **BUILD-002**：自动分配是否在**所有**完工路径（World 的 `completeBlueprintWork` vs Registry 结算）上**必须**一致执行，还是仅部分场景（例如仅 demo flow）需要；这决定 `onCompleteRules` 是否应真正成为运行时代码路径。
4. **BUILD-003 presentation**：红虚影/失败音效是否在现行 UI 已验收；领域侧仅有 `safePlaceBlueprint` 失败与跳过计数，表现需对照 `oh-acceptance/UI系统.yaml` 等（若已拆验收）。

---

## 问题清单（类型标注）

1. **【多套并行】** 蓝图创建：`createBlueprint`（`EntityRegistry` + `coveredCells` + 规格占地）与 `safePlaceBlueprint`（`WorldCore` + `occupiedCells` + 可选多格由调用方传入）并存；玩家路径走后者，`runBuildFlowScenario` 走前者。二者工单类型亦分化为 `construct`（WorkRegistry）与 `construct-blueprint`（World `workItems`），易出现「同一验收口径、两套状态机」的长期维护成本。
2. **【多套并行 / 无用兼容（待判定）】** 建筑交互与阻挡语义：`BUILDING_SPECS` 与 `entity/lifecycle-rules.buildingInteractionCaps` 对 bed/wall **重复表达**；`blocksMovement` 在落成时是否进入实体字段需结合 `entity` 模块核对，本目录未消费该字段驱动结算。
3. **【孤立需求（相对文档）】** `onCompleteRules`（含 `assign-bed-ownership`、`refresh-pathfinding-cache` 注释）在运行链上**无消费者**，相对 `oh-gen-doc/建筑系统.yaml` / `oh-code-design` 的「规则 id 列表、结算器读取」属于**文档化或超前数据结构**；若不打算短期接线，建议在需求或 code-design 中标明「仅规划字段」以免误读为已实现。
4. **【孤立需求（跨目录）】** `oh-acceptance/建筑系统.yaml` BUILD-002/BUILD-004 的「归属规则器」行为：主 World 完工路径是否自动执行等价逻辑，需对照 `work-operations.completeBlueprintWork` 与 `entity/relationship-rules`（**不在本文件展开**），产品需确认是否 acceptance 已满足或存在缺口。

---

*本报告仅记录审计结论，不包含代码修改。*
