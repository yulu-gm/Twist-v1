# work、job、toil 概念说明

## 1. 先说结论

在这个项目里，`work`、`job`、`toil` 是三个不同层级的概念：

- `work`：世界里“有事要做”的待处理问题，通常还没有绑定到某个 pawn。
- `job`：AI 分配给某个 pawn 的一份具体任务单，是运行时实例。
- `toil`：一份 `job` 里面拆出来的具体执行步骤。

可以把三者关系记成：

`work source -> job -> toil`

更口语一点：

- `work` 是“哪里有活”
- `job` 是“谁接了这份活”
- `toil` 是“这份活怎么一步步做完”

## 2. `work` 是什么

`work` 不是一个单独的核心类名，而是这套系统里的业务概念。它表示地图上存在某种“待处理事务”，AI 后续会从这些事务里挑选候选项。

在当前项目中，常见的 `work` 来源有：

- 玩家创建的 `Designation`
- 缺材料的 `Blueprint`
- 还没完工的 `ConstructionSite`
- 紧急需求触发的行为需求，比如进食

对应代码入口主要在：

- [`designation.commands.ts`](/E:/Me/Twist-v1/src/features/designation/designation.commands.ts)
- [`designation.system.ts`](/E:/Me/Twist-v1/src/features/designation/designation.system.ts)
- [`construction.system.ts`](/E:/Me/Twist-v1/src/features/construction/construction.system.ts)
- [`job-selector.ts`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts)

这里最关键的一点是：`work` 往往还没有绑定执行者。

例如：

- 一棵树被标记成 `DesignationType.Cut`
- 一块岩石被标记成 `DesignationType.Mine`
- 一个木墙蓝图还缺 `wood`

这些都说明“地图上存在要做的事”，但还没有说明“哪个 pawn 现在就去做它”。

所以如果从职责上看，`work` 更接近“待分配的工作来源”或“待处理状态”，而不是“已经被某个 pawn 接下来的任务对象”。

## 3. `job` 是什么

`job` 是 AI 真正分配给某个 pawn 的任务单。它是运行时对象，表示“这个 pawn 当前正在做的一份工作”。

定义可以看：

- [`ai.types.ts`](/E:/Me/Twist-v1/src/features/ai/ai.types.ts)

`job` 通常会包含这些信息：

- `pawnId`：哪个 pawn 来做
- `defId`：这份任务是什么类型，比如 `job_harvest`、`job_mine`
- `targetId` / `targetCell`：任务目标是谁、在哪
- `toils`：这份任务拆成了哪些执行步骤
- `state`：任务当前生命周期状态
- `reservations`：为了执行任务而占用的预约资源

谁负责创建和分配 `job`：

- 创建通常发生在各类 `create*Job()` 工厂里
- 分配发生在 [`job-selector.ts`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts)

也就是说，AI 系统会先扫描地图上的各种 `work` 来源，再把其中一部分包装成具体 `job`，最后分配给空闲 pawn。

从抽象层级上说：

- `work` 更像“有活存在”
- `job` 更像“某个 pawn 接单了”

## 4. `toil` 是什么

`toil` 是 `job` 里的步骤。

一个 `job` 往往不是一步完成，而是要拆成若干个顺序执行的小阶段，比如：

- 先走过去
- 再拿东西
- 再把东西送过去
- 最后干活

这些步骤就是 `toil`。

它的执行入口主要在：

- [`toil-executor.ts`](/E:/Me/Twist-v1/src/features/ai/toil-executor.ts)

具体处理器在：

- [`goto.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/goto.handler.ts)
- [`pickup.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/pickup.handler.ts)
- [`deliver.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/deliver.handler.ts)
- [`work.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/work.handler.ts)
- [`wait.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/wait.handler.ts)

所以 `toil` 解决的问题不是“做哪份工作”，而是“这份工作当前走到哪一步了”。

## 5. 三者在代码里的衔接关系

这套代码的真实链路大致是：

1. 输入层或世界状态先产生 `work source`
2. AI 在 `jobSelectionSystem` 中扫描这些来源
3. AI 把某个来源转换成一份 `job`
4. `job` 内部再拆成多个 `toil`
5. `toilExecutorSystem` 逐 tick 推进这些 `toil`
6. 所有 `toil` 完成后，`job` 结束，pawn 回到空闲态

关键代码位置：

- 运行入口和 tick 推进：
  [`MainScene`](/E:/Me/Twist-v1/src/adapter/main-scene.ts)
- 阶段调度：
  [`TickRunner`](/E:/Me/Twist-v1/src/core/tick-runner.ts)
- AI 选工：
  [`job-selector.ts`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts)
- Toil 执行：
  [`toil-executor.ts`](/E:/Me/Twist-v1/src/features/ai/toil-executor.ts)
- Job 生命周期：
  [`job-lifecycle.ts`](/E:/Me/Twist-v1/src/features/ai/job-lifecycle.ts)

## 6. 用“砍树”举例

### 6.1 `work`

玩家用砍伐工具框选树木后，输入层会下发 `designate_cut` 命令。  
命令被处理后，地图里会新增 `DesignationType.Cut` 的 `Designation` 对象。

相关代码：

- [`input-handler.ts`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts)
- [`designation.commands.ts`](/E:/Me/Twist-v1/src/features/designation/designation.commands.ts)

这时可以说：地图上出现了一个“砍树 work”。  
注意，这时还只是“有树要砍”，并没有绑定到某个 pawn。

### 6.2 `job`

到了 `AI_DECISION` 阶段，[`job-selector.ts`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts) 会扫描这些 `Designation`。  
当它发现 `DesignationType.Cut` 时，会调用 [`createHarvestJob()`](/E:/Me/Twist-v1/src/features/ai/jobs/harvest-job.ts) 创建一个 `job_harvest`。

然后如果 reservation 成功，这个 `job` 会被分配给某个空闲 pawn。

这时可以说：  
“这棵树对应的 work，已经被转换成某个 pawn 当前持有的 job。”

### 6.3 `toil`

对砍树来说，这个 `job_harvest` 一般会拆成两个 `toil`：

- `GoTo`
- `Work`

含义分别是：

- `GoTo`：先走到树旁边
- `Work`：站在树旁边持续累积工作量，直到砍伐完成

其中：

- [`goto.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/goto.handler.ts) 负责寻路和到位判断
- [`movement.system.ts`](/E:/Me/Twist-v1/src/features/movement/movement.system.ts) 负责逐格移动
- [`work.handler.ts`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/work.handler.ts) 负责真正落地砍树结果

当 `Work` 完成后：

- 树对象被销毁
- 木头 item 被生成
- 对应 designation 被移除
- `job` 进入完成流程

## 7. 为什么设计成三层

把 `work`、`job`、`toil` 分开，有几个明显好处：

- 输入层和世界层只负责表达“哪里有事要做”，不用直接操心由谁执行
- AI 层只负责把候选工作分配给合适的 pawn
- 执行层只负责把已分配的任务一步步跑完

这样可以把“工作来源”“任务分配”“步骤执行”拆开，各自职责更清楚。

如果把三者揉在一起，常见问题会是：

- 输入直接控制 pawn，耦合过重
- 很难做 reservation 和抢占
- 很难处理中断、恢复、重选任务
- 很难把一份复杂任务拆成多个阶段推进

## 8. 一句话记忆

可以用下面这三句记：

- `work`：世界里待处理的问题
- `job`：某个 pawn 当前接到的任务单
- `toil`：这张任务单里的执行步骤

再压缩一点就是：

`work` 解决“做什么”，`job` 解决“谁来做”，`toil` 解决“怎么一步步做”。
