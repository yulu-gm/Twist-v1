# 审计：`src/game/` 根目录单层 `*.ts` 与 `src/game/util/`

对照文档（策划事实源与验收）：`oh-gen-doc/实体系统.yaml`、`oh-gen-doc/地图系统.yaml`、`oh-gen-doc/工作系统.yaml`；验收侧补充：`oh-acceptance/实体系统.yaml`、`oh-acceptance/地图系统.yaml`、`oh-acceptance/工作系统.yaml`。本文在以下小节中按需引用上述路径的语义，不展开全文。

---

## 一句结论

根目录层是「**世界核 + 与模拟/场景的桥 + 每帧 tick 顺序**」：`world-core` / `world-internal` 承载实体与工单写入；`world-bootstrap` 经 `WorldCoreWorldPort` 把场景挡在构造细节外；`world-sim-bridge` 把 `WorldCore` 压回 `WorldGridConfig` 的阻挡与交互点；`world-work-tick` / `world-construct-tick` 与 `GameOrchestrator` 串联**失效工单清理 → 开放单自动认领 → 行为 tick → 中断 fail → 锚格读条完成 → 床位分配**。与三份 `oh-gen-doc` 相比，**石料开采类工单、`deconstruct-obstacle` 标记流、模板交互点 fallback** 等能力在策划工作/实体叙事中**未逐项对齐**；与 `oh-acceptance` 相比，**工单互斥（WORK-004）的「广播—抢锁」叙事**在代码侧更接近「排序后就近认领」，需在问题清单中单独标注。未发现典型 `mock-*.ts` 命名文件；**随机源混用（`Math.random` vs 种子 RNG）与 `PawnState.needs` 过渡期双写**更符合「双轨/过渡」而非场景 mock 目录。

---

## 要解决什么问题（审计视角）

**为何涉及多份文档：** 根目录这批文件**不做单系统闭环**，而是**横切编排**——`WorldCore` 同时承载实体与工单（`oh-gen-doc/实体系统.yaml`、`oh-gen-doc/工作系统.yaml`），网格可走性又与地图占用、初始化语义交叉（`oh-gen-doc/地图系统.yaml`、`oh-acceptance/地图系统.yaml`），`PawnState` 与 `restSpots` 把「木床所有者」和休息需求接到行为链上（实体 YAML 与 `oh-acceptance/行为系统.yaml` 中无床场景相关）。**单一 YAML 说不清同一帧内谁先谁后**；故正文对齐策划事实源之外，还须引用 `oh-acceptance/` 用例，补上「条款 ↔ 运行顺序」的缝隙。

从 `oh-gen-doc/工作系统.yaml` 出发，验收关心的是：伐木/建造/拾取/搬运的生成、队列状态、目标消失（对应 `oh-acceptance/工作系统.yaml` **WORK-001～003**）及多小人争单（**WORK-004**）。从 `oh-gen-doc/地图系统.yaml` 与 `oh-acceptance/地图系统.yaml` 出发，格子可走、障碍与占用、开局实体分布（**MAP-001** 等）须与领域状态一致。从 `oh-gen-doc/实体系统.yaml` 与 `oh-acceptance/实体系统.yaml` 出发，木床所有者、物质/树的生命周期与关系一致性是长期约束。

根目录代码显式解决的问题是：**把这些文档按子系统拆开描述的能力，在同一帧内按固定顺序落到可运行的 `WorldCore` + `PawnState` + `WorldGridConfig` 上**。任务树侧重点——**与场景/mock 纠缠的兼容层**——在本范围内主要体现在：`OrchestratorWorldBridge` 扩展 `PlayerWorldPort`（网关边界）、`world-sim-bridge` 对模板网格与真相同步（表现/寻路共用 grid 引用）、`pawn-state` 中仍标记 `@deprecated` 的 `needs` 与 `satiety`/`energy` 并行字段，以及 `world-bootstrap` 里石格采样与装饰 RNG **来源不一致**。

---

## 设计上怎么应对（文档应然 vs 代码现状）

### 对照 `oh-gen-doc/实体系统.yaml`

- **小人状态、木床所有者、物资/树**：`bed-auto-assign.ts` 将无主的 `restSpots` 按小人 id 字典序分配给无床小人，并回写 `building` `bed` 的 `ownership`，与文档「木床 · 所有者 · 自动分配」方向一致。`pawn-state.ts` 为小人维护逻辑格、移动、需求相关字段；其中 `needs` 与 `satiety`/`energy` **双轨**注释写明过渡期——与文档「饱食度/精力值」作为小人属性的**单一叙述**不完全同构。
- **未在文档直接展开的能力**：`world-core.ts` 中 `registerMineStoneWork`、`miningMarked` 及 `mine-stone` 工单依赖 `obstacle` + `label: "stone"`，**实体系统设计仅写树木不写可开采石料**；`placeTaskMarker` / `clearTaskMarkersAtCells` 与 `deconstruct-obstacle` 工单对应 **「拆除障碍」** 玩法，**`oh-gen-doc/工作系统.yaml` 所列工作类型未包含该项**。

### 对照 `oh-gen-doc/地图系统.yaml` 与 `oh-acceptance/地图系统.yaml`

- **可走性与占用**：`world-internal.spawnWorldEntity` 等与占用表协作，`world-sim-bridge.simulationImpassableCellKeys` 将障碍、墙、树、蓝图格并入寻路阻挡，注释解释与 idle 认领工单、振荡问题相关——属于**地图可走性在「领域占用」与「模拟 grid」之间的第二套推导**，与 `oh-gen-doc/地图系统.yaml`「地图格可通行」在**实现上拆成两条来源**（参见 `src-game-map.md` 交叉说明）。
- **交互点**：`simulationInteractionPoints` 合成模板非床点、模板床、`restSpots`、以及 **地面且 `pickupAllowed` 的食物资源**；缺模板时 **bed/food fallback 落在 (0,0) 格**。文档侧地图 YAML **未描述 InteractionPoint 样板**，与「孤立需求/原型数据」类问题一致。

### 对照 `oh-gen-doc/工作系统.yaml` 与 `oh-acceptance/工作系统.yaml`

- **开放工单合并、目标失效**：`findExistingWorkItem` + `registerChopTreeWork` / `registerPickUpResourceWork` 等与文档「自动工作检测」「同一目标重复单」方向一致；`cleanupStaleTargetWorkItems` 对缺失 `targetEntityId` 的 open/claimed 单做删除或 `failWorkItem(stale-target)`，与 **WORK-003**「目标消失」验收条款接近。
- **认领策略**：`autoClaimOpenWorkItems` 对小人稳定排序，按 `minManhattanToWorkOperatorStand` 选最近开放单；**WORK-004** 表述为广播后「第一个响应者锁定」——代码是**确定性排序下的贪心就近**，语义上都是互斥领取，但**与验收措辞并非逐字同构**。
- **扩展工单种类**：`mine-stone`、`deconstruct-obstacle`、`haul-to-zone`（在 `WORK_WALK_KINDS` 等处与 construct/chop/pick-up 并列）超出 `oh-gen-doc/工作系统.yaml` 所列四类标准工作名称，属**策划文档未列项的实现扩展**。

---

## 代码里大致怎么走（入口与协作）

- **`world-core-types.ts`**：定义 `WorldCore`、`WorldSnapshot`、`MarkerSnapshot`、`EntityDraft`；工单与 `restSpots` 与世界时间并排。
- **`world-internal.ts`**：克隆世界、`spawnWorldEntity`、占用规范化、`findExistingWorkItem`、`attachWorkItemToEntityMutable` 等纯函数式变更基础。
- **`world-core.ts`**：`createWorldCore`、`moveWorldEntity`、`getWorldSnapshot`；注册伐木/拾取/采矿工单；`clearTaskMarkersAtCells`、`placeTaskMarker`；`removeWorldEntitiesOccupyingCells` 注释点明**场景热载入**前先清 footprint。
- **`world-bootstrap.ts`**：`bootstrapWorldForScene` 调 `createWorldCore`、障碍播种、随机石格（`pickRandomBlockedCells` 使用 **`() => Math.random()`**）、`seedInitialTreesAndResources` 使用 **`createSeededRng`**；返回 `WorldCoreWorldPort` 作为 `OrchestratorWorldBridge`。
- **`world-sim-bridge.ts`**：`syncWorldGridForSimulation` 就地更新共享 `worldGrid` 的 `blockedCellKeys` 与 `interactionPoints`。
- **`world-construct-tick.ts`**：`pickWorkOperatorStandCell`、`buildWorkWalkTargets`——认领工单后走向锚格四邻的可走「操作站立格」。
- **`world-work-tick.ts`**：`cleanupStaleTargetWorkItems`、`autoClaimOpenWorkItems`、`tickAnchoredWorkProgress`（与 `work-item-duration` 配置读条时长）。
- **`game-orchestrator.ts`**：`tick` 内顺序为时钟推进 → `syncWorldGrid` → 时间事件总线（如 `night-start` 释放走向工单）→ Stale 清理 → 自动认领 → `tickSimulation` → 需求打断导致的 `failWorkItem` → 读条完成 → `assignUnownedBeds` → 各 hooks；`getLastPawnDecisionTraces` **固定返回空数组**，注释写明 API 兼容。
- **`orchestrator-world-bridge.ts`**：`getWorld`/`setWorld` 与 `PlayerWorldPort` 合一接口。
- **`pawn-state.ts`**：小人状态工厂、路径与移动插值、`needs`/`satiety`/`energy` 并存；**`pickRandomAltPawnNames` 默认 `Math.random`**。
- **`bed-auto-assign.ts`**：每帧末填充无主床的 `ownerPawnId` 并同步床实体 `ownership`。
- **`util/seeded-rng.ts`**：Mulberry32，供可复现装饰播种。
- **`README.md`**：说明顶层职责与导入约定，与当前目录结构一致。

---

## 尚不明确或需要产品/策划拍板

1. **`mine-stone` / 石料障碍 / `miningMarked` 是否纳入正式玩法**：若长期保留，应在 `oh-gen-doc/实体系统.yaml`、`oh-gen-doc/工作系统.yaml` 与对应 `oh-acceptance` 中补条目；否则属于实现超前于策划事实源。
2. **`deconstruct-obstacle` 与任务标记清理**是否等价于产品所说的「拆除/清理障碍」：与工作系统 YAML 当前四种类型并列还是子类，需定稿。
3. **工单认领规则**以「曼哈顿到操作站格」近似距离为准即可，还是必须按 **WORK-004** implement 字面「广播—抢锁」顺序；影响是否调整验收文案或代码。
4. **`PawnState.needs`  deprecate 时间表**：何时删除双写、仅保留 `satiety`/`energy`，避免行为与 UI 长期依赖两套字段。
5. **石格随机**（`Math.random()`）与 **`terrainDecorationSeed` 装饰播种**：是否要求整局可复现（含石格）；若要求，是否统一注入 orchestrator 的 `rng` 或一律种子化。
6. **模板交互点 fallback (0,0)** 在无边界的地图上是否可接受，或应改为显式错误/禁用寻路使用该点。

---

## 问题清单

| # | 摘要 | 类型（见 `working-plan/remain-old-code-check/README.md`） | 说明与文档对照 |
|---|------|----------------|---------------|
| R1 | `mine-stone`、`registerMineStoneWork`、`miningMarked` 与石料 `obstacle` | **孤立需求** | `oh-gen-doc/实体系统.yaml` 仅有树木资源线；`oh-gen-doc/工作系统.yaml` 未列采矿类工作。 |
| R2 | `deconstruct-obstacle` 标记与工单、 `placeTaskMarker` / `clearTaskMarkersAtCells` | **孤立需求** | `oh-gen-doc/工作系统.yaml` 工作类型枚举未含「拆除障碍」；若有产品意图应补文档与 `oh-acceptance/工作系统.yaml` 场景。 |
| R3 | `PawnState.needs` 与 `satiety`/`energy` 并行且标 `@deprecated` | **多套并行 / 无用兼容（过渡）** | `oh-gen-doc/实体系统.yaml` 从玩家视角描述饱食与精力；代码双轨增加维护与一致风险。 |
| R4 | `world-bootstrap` 石格用 `Math.random()`，树木/食物装饰用种子 RNG | **多套并行** | 与单局可复现期望是否一致需拍板；`oh-acceptance/地图系统.yaml` **MAP-001** 对「重复开局」未写死，但自动化测试可能依赖确定性。 |
| R5 | `simulationInteractionPoints` 模板缺失时的 bed/food fallback 坐标 (0,0) | **孤立需求** | `oh-gen-doc/地图系统.yaml` 未定义样板交互点；属实现兜底，产品需知悉。 |
| R6 | `autoClaimOpenWorkItems` 与 **WORK-004** 叙事差异 | **设计一致性** | `oh-acceptance/工作系统.yaml` **WORK-004** 强调广播与抢锁；实现为稳定排序 + 就近曼哈顿（到操作站格）。 |
| R7 | `GameOrchestrator.getLastPawnDecisionTraces` 恒为空 | **无用兼容 / API 桩** | 注释写明兼容；若长期无实现，验收中「决策追踪」类需求需另注册或删除 API。 |
| R8 | 领域工单种类（含 `haul-to-zone` 等）宽于策划四类命名 | **多套并行 / 文档缺口** | 以 `work-types` 为准时，策划 YAML 与工作注册函数应建立显式映射表，避免「文档四种、代码多种」静默分叉。 |

---

*本报告仅审计 `src/game/` 下仅一层 `*.ts` 与 `src/game/util/`，为说明网格同步与种子策略已交叉引用 `src/player/world-core-world-port.ts`、`src/game/map/` 等协作点；未修改任何源码。*
