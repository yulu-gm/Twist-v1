# 结构化 Pawn 工作评估设计

## 目标

通过引入一层统一的工作评估层，让 pawn 的工作选择更具结构、也更容易检查，其能力包括：

1. 以有序的抽象工作单元来表示每个 pawn 可执行的工作，而不是临时拼接的 candidate 函数。
2. 将每次选工过程的结果冻结为一份决策快照。
3. 让 pawn inspector 可以按优先级顺序显示：
   - 考虑过哪些工作类别，
   - 哪些工作被阻塞以及原因，
   - 哪个工作被选中并正在执行，
   - 哪些更低优先级的条目被延后。

## 已确认的产品决策

1. 新结构应当是正式的 simulation 层单元，而不是仅仅套在 `pawn.ai.currentJob` 外的一层 UI 包装。
2. inspector 应显示最近一次选工的冻结快照，而不是在 pawn 已经执行工作时仍持续重算并实时变化的排名。
3. 第一版展示工作类别，而不是每一个具体目标实例。

## 当前问题

`src/features/ai/job-selector.ts` 当前的表现更像一个大型编排函数：

- 它通过若干硬编码扫描来收集 candidates，
- 每个分支以不同的形态计算 score 和可用性，
- 最终的选择路径把评估、reservation 失败、assignment 和 fallback 混在了一起，
- UI 只能看到当前分配到的 `Job`，看不到被拒绝或被延后的其他备选项。

这使得“为什么这个 pawn 在做这件事而不是别的事”很难解释，也使 selector 难以扩展，只会让同一个文件继续膨胀。

## 设计总览

保留现有的 `Job` 与 `Toil` 执行模型不变，但在 assignment 之前插入一层新的工作评估层。

新的流程变为：

1. `job-selector` 调用一组固定的工作评估器来评估某个 pawn。
2. 每个评估器为一个工作类别返回统一格式的工作评估结果。
3. selector 按类别优先级和分数对结果排序。
4. selector 从高到低尝试分配。
5. selector 将排序后的列表冻结为一份 pawn 本地的决策快照。
6. UI 只读取这份冻结快照以及当前活跃 toil 的投影信息。

这样就把以下概念分开了：

- `Job`：真实可执行的任务，包含 toils 与 reservations。
- `WorkOption`：展示在 inspector 里的抽象决策单元。
- `PawnWorkDecisionSnapshot`：对一次选工过程的冻结说明。

## Simulation 数据模型

### `Job` 继续聚焦执行

现有 `Job` 模型继续作为运行时执行单元：

- `toils`
- `currentToilIndex`
- `reservations`
- `state`

它不应变成 selector 存储被拒绝备选项或仅用于展示的诊断信息的地方。

### 新增 `WorkOption`

引入一个统一的抽象工作单元，用于决策和展示。

建议字段：

- `kind`：稳定的工作类别 id，例如 `sleep`、`eat`、`designation_mine`、`designation_harvest`、`deliver_materials`、`construct`、`haul_to_stockpile`、`resolve_carrying`
- `label`：面向用户的类别显示名
- `status`：下文定义的一种决策状态
- `priority`：用于排序的类别优先级
- `score`：该类别内的数值分数
- `failureReasonCode`：用于 blocked 状态的稳定原因码
- `failureReasonText`：给 inspector 展示的人类可读解释
- `detail`：可选的简短上下文，比如床位标签、材料 id 或目标摘要
- `jobDefId`：如果该项被选中，将会分配的 job 类型
- `evaluatedAtTick`：本次决策发生的 tick

### 决策状态模型

使用一组较小的共享状态词汇：

- `available`：评估器找到了一个有效选项，并且它当前可被选中
- `blocked`：该类别已被检查，但当前无法分配；需要显示原因
- `active`：该类别已被选中，并且就是当前正在执行的工作；需要显示当前 toil
- `deferred`：该类别在冻结快照中排在已选工作之后；不需要额外解释

`inactive` 在 v1 中刻意省略，以保持模型更小。每一行展示项都应对应最近一次排序中真实参与过的一个类别。

### 新增 `PawnWorkDecisionSnapshot`

在 pawn 的 AI 状态下新增一份冻结的决策快照。

建议字段：

- `evaluatedAtTick`
- `selectedWorkKind`
- `selectedWorkLabel`
- `selectedJobId`
- `activeToilLabel`
- `activeToilState`
- `options: WorkOption[]`

这份快照只应在 pawn 执行新的选工过程时被替换，而不应在 pawn 正忙于执行所选 job 时每 tick 重新排序。

## 评估器层

### 新增 `WorkEvaluator` 接口

把按类别区分的选工逻辑移动到统一的评估器接口之后。

每个评估器应定义：

- `kind`
- `label`
- `priority`
- `evaluate(pawn, map, world): WorkEvaluation`

每个 `WorkEvaluation` 都应该回答相同的问题：

1. 这个类别当前是否有有效选项？
2. 如果没有，原因是什么？
3. 如果有，它的分数是多少？
4. 如果它被选中，应该如何创建真实的 `Job`？

建议输出字段：

- `kind`
- `label`
- `priority`
- `score`
- `status`
- `failureReasonCode`
- `failureReasonText`
- `detail`
- `jobDefId`
- `createJob(): Job | null`

### 初始评估器集合

第一版的评估器列表应尽量贴近当前行为，以保证重构后 gameplay 保持稳定：

1. `EatWorkEvaluator`
2. `SleepWorkEvaluator`
3. `DesignationMineWorkEvaluator`
4. `DesignationHarvestWorkEvaluator`
5. `DeliverMaterialsWorkEvaluator`
6. `ConstructWorkEvaluator`
7. `HaulToStockpileWorkEvaluator`
8. `ResolveCarryingWorkEvaluator`

每个评估器只返回其类别下的最佳选项，而不是所有可能的具体目标。

## 重构后的 Selector 流程

`src/features/ai/job-selector.ts` 应变成编排代码，而不是一个巨大的规则文件。

某个空闲 pawn 的一次选工过程应执行以下步骤：

1. 按固定顺序调用所有已注册的评估器，构建评估结果。
2. 先按 `priority`、再按 `score` 排序。
3. 从上到下迭代并尝试真实 assignment。
4. 如果某个类别本来可以创建 job，但在 assignment 过程中因 reservation 失败，则把它转成 `blocked`，并赋予显式原因，例如 `target_reserved`。
5. 将第一个成功分配的类别标记为 `active`。
6. 将所有更低排名的类别标记为 `deferred`。
7. 将冻结后的结果持久化为 `PawnWorkDecisionSnapshot`。
8. 如果没有任何工作能被分配，并且使用了 wander fallback，则可以：
   - 存储一份没有 active 结构化工作的快照，并把 wander 作为列表外 fallback 处理，或者
   - 把一个低优先级的 `wander` 类别作为最终评估器纳入列表。

建议：在 v1 中把 `wander` 作为最终评估器纳入，这样即使没有任何生产性工作存在，快照也能始终解释实际被选中的工作。

## 失败原因

只有当原因稳定且有意义时，blocked 行才真正有价值。原因码和原因文案应由 simulation 层负责，而不是由 UI 去推断。

初始原因应覆盖当前常见的失败场景：

- 该类别下没有目标
- 目标已被 reservation
- 目标不可达
- 没有可用床位
- 材料尚未送达
- 没有可达的材料来源
- 没有合法的 stockpile 或 drop 目标位置
- 当前携带物阻塞了依赖 pickup 的工作

应使用稳定的 reason code 供逻辑和快照兼容使用，同时提供简短消息供 inspector 展示。

## UI 快照与 Inspector

### 快照边界

冻结的决策快照应属于 colonist snapshot，而不是 `presentation`。

`presentation` 仍然只负责瞬时 UI bridge 状态。决策快照属于 simulation 派生的诊断状态，应通过 `snapshot-reader` 读取。

在 `ColonistNode` 下新增一个 `workDecision` 投影，包含：

- `evaluatedAtTick`
- `selectedWorkKind`
- `selectedWorkLabel`
- `activeToilLabel`
- `activeToilState`
- `options[]`

UI 接收到的应该只是可展示的数据，而不是 evaluator 的内部细节或可变的 world 引用。

### Inspector 展示方式

保留当前 job 的摘要行，然后新增一个专门的 `Work Queue` 区块。

每一行应渲染：

- 工作标签
- 状态样式
- 可选的次级文本

状态行为：

- `active`：绿色，显示当前 toil 标签和 toil 状态
- `blocked`：blocked 灰色，显示失败原因
- `deferred`：deferred 灰色，不显示额外文本

如果当前还没有快照，则渲染一个简短的空状态，例如 `No decision snapshot yet`。

### 颜色语义

不要对所有情况都使用同一种灰色。

- blocked 灰表示“这个类别被检查过，但当前失败了”
- deferred 灰表示“这个类别在冻结决策中排在已选工作之后”
- 绿色表示“这个类别就是当前被选中的活跃工作”

这种区分是必要的，这样面板传达的是推理过程，而不是一组扁平的 disabled 列表。

## 文件结构

建议的文件拆分：

- `src/features/ai/work-types.ts`
  - 工作选项、工作评估、原因码和快照类型
- `src/features/ai/work-evaluator.types.ts`
  - evaluator 接口和共享上下文类型
- `src/features/ai/work-evaluators/*`
  - 每个类别一个 evaluator，或按紧密关联类别拆分
- `src/features/ai/job-selector.ts`
  - 编排、排序、assignment、快照冻结
- `src/ui/kernel/ui-types.ts`
  - 快照投影类型
- `src/ui/kernel/snapshot-reader.ts`
  - 将 pawn AI 决策快照映射为不可变 UI 数据
- `src/ui/domains/colonist/colonist.types.ts`
  - inspector 视图模型类型
- `src/ui/domains/colonist/colonist.selectors.ts`
  - 派生工作队列的显示行
- `src/ui/domains/colonist/components/colonist-inspector.tsx`
  - 渲染新的队列区块
- `src/ui/styles/app.css`
  - active、blocked 和 deferred 三种行样式

## 迁移策略

### Phase 1：新增类型与空管线

- 新增工作评估与决策快照类型。
- 扩展 pawn AI 状态以持有冻结快照。
- 扩展 UI 快照类型与渲染逻辑，使其能够容忍 `null` 的决策数据。

这一阶段不应改变任何选工行为。

### Phase 2：用 evaluator 包装现有逻辑

- 将现有 candidate 逻辑抽取到 evaluator 模块中。
- 保持评分公式和类别顺序与当前行为一致。
- 让 `job-selector` 消费 evaluator 结果，而不再直接收集 candidates。

这一阶段应当在改变结构的同时保持 assignment 结果不变。

### Phase 3：补齐 blocked 原因覆盖

- 为主要失败路径补充显式 blocked 原因。
- 将最终 assignment 过程中的 reservation 失败转成 blocked 行。

这是赋予 inspector 解释能力的阶段。

### Phase 4：暴露到 snapshot 和 inspector

- 通过 `snapshot-reader` 投影冻结快照。
- 构建 `Work Queue` 的 inspector 视图模型。
- 用不同样式渲染 active、blocked 和 deferred 行。

## 测试

### AI evaluator 测试

为 evaluator 输出增加聚焦测试：

- 当该类别能够生成 job 时返回 `available`
- 当该类别无法生成 job 时返回带正确原因的 `blocked`
- 保持预期的 score 排序输入
- 报告正确的类别元数据和 job 类型

### Selector 集成测试

为一次完整选工过程增加集成覆盖：

- 评估结果按优先级和分数排序
- 被选中的类别变为 `active`
- 高于它但失败的类别变为 `blocked`
- 低于它的类别变为 `deferred`
- 分配到的 job 在行为上仍与重构前 selector 一致

### UI selector 与组件测试

为以下内容增加 UI 测试：

- `snapshot-reader` 将决策快照投影到 colonist 数据
- colonist selectors 把 snapshot 数据映射成 inspector 行
- inspector 渲染 active toil 细节
- inspector 渲染 blocked 原因
- inspector 渲染不带额外文本的 deferred 行
- 无快照时的空状态

## 不在范围内

第一版不应：

- 在 pawn 已执行工作时持续重新排序
- 暴露每个类别下的每一个具体目标实例
- 重设计 `Job` 或 `Toil` 执行模型
- 引入独立的 planner 或 scheduler 子系统
- 将 inspector 变成交互式调试控制面板

## 成功标准

当满足以下条件时，这个设计就是成功的：

1. `job-selector` 变成基于 evaluator 单元的编排层，而不是单个大型规则函数。
2. 每次空闲 pawn 的选工过程都会产出一份冻结的有序决策快照。
3. pawn inspector 可以展示当前被选中的活跃工作、带原因的高优先级 blocked 工作，以及被延后的低优先级工作。
4. 除非后续有意调整，否则 gameplay 行为应保持与当前工作选择规则一致。
