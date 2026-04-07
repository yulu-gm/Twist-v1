# 审计：`src/game/work/`（T-10）

对照文档：[`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml)、[`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml)（及 [`working-plan/remain-old-code-check/README.md`](README.md) 三类定义）。`oh-acceptance/工作系统.yaml` 头部声明的 `gen_doc_ref: "oh-gen-doc/工作系统.yaml"` 与本次对照一致。

---

## 一句结论

本目录同时维护 **挂在 `WorldCore.workItems` 上的 `WorkItemSnapshot` 工单**（`work-operations.ts`、`work-item-duration.ts`）与 **内存 `WorkRegistry` 内的 `WorkOrder`**（`work-registry.ts`、`work-scheduler.ts`、`work-generator.ts`、`work-settler.ts`）；`work-types.ts` 已写明二者「并存」。这与 [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml) 中单一的「工作队列 / 工作状态」叙述在**实现层是两条运行时链路**，且 **采矿、拆除障碍** 等工单类型**未出现在该策划文档**中；`WorkOrderStatus` 虽含 `failed`，`settleWorkFailure` 实际将工单打回 `open`，与文档「失败」终态表述**不完全对齐**。

---

## 要解决什么问题

从「初创期理想态」与 route-demand 出发，判断本目录是否存在**无文档背书的能力**、**多套并行注册/调度/结算**、或**与验收场景脱节的路径**。

**与 [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml) 的对照要点**

| 文档节点 | 代码侧对应（事实简述） |
| --- | --- |
| 工作类型：拾取 / 搬运到存储区 / 伐木 / 建造 | `WorkItemKind` 含 `pick-up-resource`、`haul-to-zone`、`chop-tree`、`construct-blueprint`；`WorkOrderKind` 含 `pick-up`、`haul`、`chop`、`construct`。另：**`mine-stone`、`deconstruct-obstacle` 仅在 `WorkItemKind` / `completeWorkItem` 分支中出现**，策划 YAML **未列举**。 |
| 工作队列：待执行列表、优先级、分配 | `WorkRegistry` + `getAvailableWork`（按 `priority` 降序、`workId` 稳定序）与 **`world.workItems` 的 Map** 两套容器；文档未区分「领域工单」与「世界快照工单」。 |
| 工作状态：待执行 / 执行中 / 已完成 / 失败 | `WorkItemSnapshot.status` 为 `open` \| `claimed` \| `completed`（**无独立 `failed`**，失败倾向 reopen + `failureCount`）；`WorkOrder.status` 含 `failed`，但 **`settleWorkFailure` 写回 `open`**，**生产代码未见将工单设为 `failed`**。 |
| 自动工作检测 | 文档描述系统检测可拾取物资、标记伐木、蓝图等；代码中 **工作条目创建** 分散在 `world-internal`、各 flow、以及 `completeChopWork` 内派生 `pick-up-resource` 等（本目录提供**类型与结算**，不单独封装「检测器」模块）。 |
| 读条机制「待定（需配置）」 | `work-item-duration.ts` 为**仅覆盖 `WorkItemKind`** 的锚格读条秒数表；**`WorkOrder` 路径无同级集中时长配置**。 |

**与 [`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml) 的对照要点**

- **WORK-001**（伐木全链路）：`runChopFlowScenario`（`flows/chop-flow.ts`）串联 `generateChopWork` → `claimWork` → `settleWorkSuccess`（伐木结算内 **`transformTreeToResource` + `generatePickUpWork` 入注册表**）→ 拾取/可选搬运；与验收「工作生成器 / 编排派生拾取与搬运」在 **Registry 流程**上可对应。运行主循环侧 **`world-work-tick` 使用 `WorkItemSnapshot` 与 `completeChopWork` 内联派生拾取工单**，是**另一条并行实现**。
- **WORK-002**（拾取与搬运）：`completePickUpWork`（`WorkItem` 路径）在存在存储格时会 **自动生成 `haul-to-zone`**；**`settleWorkSuccess` 的 `pick-up` 分支仅 `pickUpResource`，不自动追加 `haul` 工单**——搬运在 **`chop-flow` 等编排层**显式 `generateHaulWork` 补全。同一策划闭环在两条链上**拼接点不同**。
- **WORK-003**（目标消失）：`world-work-tick.ts` 中 `cleanupStaleTargetWorkItems` 针对 **`world.workItems`** 与实体缺失；**`WorkRegistry` 订单无对等集中清理**，失效依赖调用方或后续 `settleWork` 错误路径。
- **WORK-004**（互斥领取）：`claimWorkItem` 与 `claimWork` 均实现「仅一方认领」语义；**两套 API 对应两套存储**，不存在单一全局「工作占用表」类型。

---

## 设计上怎么应对

- **应然**：若以 [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml) 为单一事实源，应明确 **一种** 工单载体（ world 快照 vs 纯领域注册表）及其与 UI、读条、自动认领的边界，并把 **失败终态**、**派生搬运** 规则写清，避免 flow 与 tick **各编一半**。
- **现状偏差**：类型层已承认「任务树工作单」与「遗留 `WorkItemSnapshot`」并存（见 `work-types.ts` 内注释），**验收友好的 chop 全链路**在 headless/flow 中偏 `WorkOrder`，**主场景模拟**偏 `WorkItem`，易造成「同一 WORK-001 用例绑不同子系统」的测试与文档漂移。
- **现状偏差**：`WorkStep` 声明式步骤串（`work-generator.ts`）为 **YAML 未描述的扩展模型**，利于编排器却增加与策划文档的 **概念表** 差异。

---

## 代码里大致怎么走

- **对外聚合**：[`index.ts`](../../src/game/work/index.ts) 同时导出 `WorkItem` 相关操作与 `WorkOrder` 注册/调度/结算。
- **World 工单路径**：[`work-operations.ts`](../../src/game/work/work-operations.ts) — `claimWorkItem`、`failWorkItem`、`completeWorkItem` 及按 `kind` 分派的 `completeChopWork`、`completePickUpWork`、`completeHaulWork` 等；直接修改 **`cloneWorld` 后的 `world.workItems` 与实体**。[`work-item-duration.ts`](../../src/game/work/work-item-duration.ts) 为 `GameOrchestrator` / 渲染侧读条提供 **仅 `WorkItemKind`** 的秒数。
- **Registry 工单路径**：[`work-generator.ts`](../../src/game/work/work-generator.ts) 生成 `WorkOrder`；[`work-scheduler.ts`](../../src/game/work/work-scheduler.ts) `getAvailableWork` / `claimWork` / `releaseWork`；[`work-settler.ts`](../../src/game/work/work-settler.ts) `settleWorkSuccess` / `settleWorkFailure` 调用 `entity/lifecycle-rules` 并更新 `WorkRegistry`。
- **下游引用**：`world-work-tick.ts`、`world-core.ts` 依赖 **`work-operations`**；`flows/chop-flow.ts`、`flows/build-flow.ts`、`behavior/behavior-context.ts`、`flows/need-interrupt-flow.ts` 依赖 **`WorkRegistry` + scheduler + settler**；HUD [`status-display-model.ts`](../../src/ui/status-display-model.ts) 行为标签走 **`WorkItemSnapshot`**，另含 `workDisplayFromRegistry` 分支展示 **Registry**。

---

## 尚不明确或需要产品/策划拍板

1. **双轨是否阶段性保留**：是否计划最终以 `WorkOrder` 吞并 `WorkItemSnapshot`，或反过来的迁移里程碑；直接影响 [`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml) 自动化验收应绑定哪条存储。
2. **`failed` 语义**：策划 YAML 的「失败」是否要求 **可查询终态**；若 yes，则需约定何时写 `failed`、是否允许自动重试（当前 failure 多表现为 **reopen**）。
3. **采矿 / 拆除是否纳入「工作系统」文档**：若属于正式玩法，应补 [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml) 与验收条目；若仅为技术 Demo，应在文档中 **显式标为范围外**。
4. **拾取后搬运的单一规则**：验收 WORK-002 要求编排器生成搬运；需确认 **Registry 路径**是否必须在 `settleWorkSuccess("pick-up")` 内统一派生 `haul`，或 **保留由 flow 编排**（与 `WorkItem` 路径自动派生 **行为不一致**）。

---

## 问题清单（类型标注）

| 类型 | 说明 | 涉及路径（主要） |
| --- | --- | --- |
| **多套并行** | **`WorkItemSnapshot`（`world.workItems`）** 与 **`WorkOrder`（`WorkRegistry`）** 两套队列/认领/结算；类型文件已标注并存，运行时仍同时存在。 | `work-types.ts`、`work-operations.ts`、`work-registry.ts`、`work-scheduler.ts`、`work-settler.ts` |
| **多套并行** | **伐木 → 木头 → 拾取（+搬运）**：`completeChopWork` 内派生 `WorkItem` vs `settleWorkSuccess("chop")` + 外层 `chop-flow` 对 `WorkOrder` 的串联；与 [`oh-acceptance/工作系统.yaml`](../../oh-acceptance/工作系统.yaml) WORK-001 可对上不同实现线。 | `work-operations.ts`、`work-settler.ts`、`../flows/chop-flow.ts` |
| **多套并行 / 行为差异** | **拾取后是否自动生成搬运工单**：`completePickUpWork`（WorkItem）会建 `haul-to-zone`；`settleWorkSuccess` 的 pick-up **不**建 haul，由 flow 补。与 [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml)「拾取后搬运」叙事在 **Registry 子路径上依赖调用方**。 | `work-operations.ts`、`work-settler.ts`、`../flows/chop-flow.ts` |
| **孤立需求** | **`mine-stone`、`deconstruct-obstacle`** 及对应 `complete*` 逻辑：**未在** [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml) 工作类型表中列出。 | `work-types.ts`、`work-operations.ts` |
| **孤立需求 / 文档缺口** | **`WorkStep` 声明式步骤**与 **Generator 内 `navigateThen`**：策划 YAML 未描述该中间表示。 | `work-types.ts`、`work-generator.ts` |
| **无用兼容 / 语义悬空** | **`WorkOrderStatus` 含 `failed`**，但 **`settleWorkFailure` 仅将状态置回 `open`**，`rg` 未见生产代码赋 `failed`；与 [`oh-gen-doc/工作系统.yaml`](../../oh-gen-doc/工作系统.yaml)「失败」状态 **名义类型与行为不一致**。 | `work-types.ts`、`work-settler.ts` |
| **孤立需求（跨文件）** | **Registry 工单**缺少与 **`cleanupStaleTargetWorkItems`（WorkItem）** 对称的集中「目标实体失效」清理；WORK-003 在 **WorkOrder** 侧的完备性依赖外围。 | `work-settler.ts`、`../world-work-tick.ts`（引用对比） |

（`rg` 检索范围：`src/game/work/`；关键词含 `mock`、`compat`、`legacy`、`stub`、`deprecated`、`双轨` 等：**除 `work-types` 中「遗留」字样及 `incompatible` 变量名外无额外命中**；双轨结论主要来自类型注释与双容器结构。）
