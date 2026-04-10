# Zones 与 Pickup How It Work

这份文档解释两个紧密耦合的领域：

- `zones`：玩家在地图上划出来的功能区域，当前最重要的是 `stockpile`
- `pickup`：Pawn 把地面物品拿起来，再送到蓝图或存储区的那条搬运链

这两个领域之所以要放在一起讲，是因为在当前系统里，`zone` 决定“物品应该被送到哪里”，而 `pickup / haul / drop / deliver` 决定“物品如何真的移动过去”。

---

## 领域核心概念

### 1. Zone

`Zone` 是地图上的功能区块。它不是单个格子，而是一组格子的集合，每个 zone 都有：

- `id`
- `zoneType`
- `cells`
- `config`

当前最重要的 zone 类型是 `stockpile`，也就是存储区。

在代码里，zone 的底层数据结构由 [zone-manager.ts](D:/CC/Twist-v1/src/world/zone-manager.ts) 管理。`ZoneManager` 做两件关键事：

1. 维护所有 zone 的集合
2. 维护“某个格子属于哪个 zone”的索引

第二点很重要，因为 AI 和放置逻辑经常需要回答一个问题：

`这个格子是不是某个 stockpile 的一部分？`

如果没有格子索引，这个查询会很慢；有了 `cellIndex` 之后，很多判断都能做到接近 O(1)。

### 2. Stockpile

`Stockpile` 是一种特殊的 zone。它的核心作用不是渲染，而是定义一块“允许存放 haulable item 的目标区域”。

它的配置目前主要是：

- `allowAllHaulable`
- `allowedDefIds`

也就是说，stockpile 不只是“有一块区域”，而是“有一块带筛选规则的区域”。

现在的默认配置是允许所有 `haulable` 物品进入，但系统已经给以后扩展成白名单存储留好了结构。

### 3. Pickup

`Pickup` 不是独立业务，而是 haul job 里的一个 toil。

当前搬运 job 通常会拆成四步：

1. `GoTo item`
2. `PickUp`
3. `GoTo destination`
4. `Deliver` 或 `Drop`

其中 [haul-job.ts](D:/CC/Twist-v1/src/features/ai/jobs/haul-job.ts) 负责把这四步组装成一个 `Job`，而 [pickup.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/pickup.handler.ts) 负责真正执行“拿起物品”这一步。

所以 `pickup` 更准确地说，是“搬运链中的取货阶段”。

### 4. Reservation

`Reservation` 是防止多个 Pawn 抢同一个目标的机制。

在当前系统里，AI 在正式分配 job 之前，会先尝试 reserve 目标对象。对于 zone / pickup 相关领域，最常见的 reservation 对象有两类：

- 被搬运的 item
- 被施工或交付材料的 blueprint / construction site

如果 reservation 成功，job 才会真正分给 pawn；如果失败，AI 会尝试下一个候选工作。

这让系统避免出现这种情况：

- 两个 Pawn 同时去拿同一堆木头
- 两个 Pawn 同时占着同一个蓝图送材料或施工

### 5. Compatible Cell

在这个领域里，一个“可放置格子”不是随便一个空地，而是要同时满足多层条件：

- 地形可通行
- 空间上可放物品
- 如果在 stockpile 内，要满足 stockpile 的接受规则
- 格子里已有物品时，要和目标物品兼容，且栈容量没满

这个判断主要集中在 [item.queries.ts](D:/CC/Twist-v1/src/features/item/item.queries.ts) 里，比如：

- `canPlaceItemAtCell`
- `findNearestAcceptingCell`
- `getCellAvailableCapacity`

这也是 `zones` 和 `pickup` 真正接起来的地方：zone 提供语义边界，item query 负责把这个边界变成“这个格子能不能放这件东西”。

---

## 这些概念之间的关系

可以把它理解成一条链：

1. 玩家定义 zone
2. zone 变成地图上的可查询规则
3. AI 在选 job 时判断哪些 item 需要搬运、可以搬到哪里
4. AI 生成 haul job
5. pawn 通过 pickup / deliver / drop 执行搬运
6. reservation 保证同一目标不会被重复抢占
7. cleanup 在异常或中断后释放旧 reservation，让系统恢复流动

所以这不是两个独立子系统，而是：

`zone 提供搬运目的地语义，pickup 把搬运语义变成真实的地图状态变化。`

---

## 业务场景解释

## 场景一：玩家创建一个 Stockpile 区域

先从最外层开始看。

当玩家在地图上框选一块区域作为 stockpile 时，系统并不是直接“往地图上画个框”就结束了，而是会走正式的 zone 命令链。核心入口在 [zone.commands.ts](D:/CC/Twist-v1/src/features/zone/zone.commands.ts)。

这里最重要的命令是：

- `zone_set_cells`
- `zone_remove_cells`
- `zone_delete`

以 `zone_set_cells` 为例，执行过程可以分成三步：

1. 校验输入是否合法
2. 分析这次框选会影响哪些已有 zone
3. 把结果真正写回 `ZoneManager`

这中间的关键不是简单新增格子，而是 [zone.analysis.ts](D:/CC/Twist-v1/src/features/zone/zone.analysis.ts) 会先分析每个格子的状态：

- 是空地
- 已经属于同类型 zone
- 已经属于其他类型 zone
- 越界

这一步的意义是把“玩家框了一片区域”转成“系统应该新建、扩展还是合并 zone”。

比如：

- 如果全是空地，就创建新 zone
- 如果碰到了已有同类型 zone，就扩展那个 zone
- 如果同时碰到多个同类型 zone，就选一个作为锚点，把其他同类型 zone 合并进去

最后这些变化统一落到 [zone-manager.ts](D:/CC/Twist-v1/src/world/zone-manager.ts) 中。

所以 stockpile 的本质不是一堆渲染格子，而是地图中的一条正式世界状态：

`这几个格子，从现在开始，属于一个具有存储语义的 zone。`

---

## 场景二：为什么地上的物品会被搬进 Stockpile

当地图上已经存在 stockpile，且有闲置 Pawn 时，AI 的 job 选择系统会开始决定“有没有东西值得搬运”。

这个逻辑在 [job-selector.ts](D:/CC/Twist-v1/src/features/ai/job-selector.ts)。

它每 tick 会为没有当前 job 的 Pawn 收集候选工作。除了吃饭、施工、采集这些工作之外，还会专门检查：

`有没有地上的 haulable item 应该被送进 stockpile？`

这里最核心的入口是 `createStockpileHaulCandidate`。

它会依次检查地图上的 item：

- 物品没被销毁
- 物品带有 `haulable` 标签
- 当前没有被 reservation 占用
- 它现在不在一个“兼容的 stockpile”里

最后这一条尤其重要。

系统不是看到物品在 stockpile 里就认为它安全，而是会进一步判断：

- 这个格子所在 zone 是不是 stockpile
- 这个 stockpile 配置是否接受该物品
- 这个格子对该物品是不是仍然兼容

这意味着“物品已经放在某个 stockpile 区域里”和“物品已经放在一个正确的存储位置里”不是完全同一回事。

如果 item 还不在正确位置，AI 会继续尝试为它找一个目标格。这个目标格由 [item.queries.ts](D:/CC/Twist-v1/src/features/item/item.queries.ts) 里的逻辑决定：

- `findNearestAcceptingCell`
- `getItemPlacementCapacitySummary`

这一步本质上是在回答：

`从当前物品出发，最近的、合法的、能放下它的 stockpile 格子在哪里？`

一旦找到了目标格，系统就会创建 `haul job`。

---

## 场景三：Haul Job 是怎么把“搬运意图”拆成可执行步骤的

找到候选物品和目标格之后，AI 不会直接把物品瞬移过去，而是会创建一个正式 job。

这个 job 的工厂函数在 [haul-job.ts](D:/CC/Twist-v1/src/features/ai/jobs/haul-job.ts)。

它把搬运拆成 4 个 toil：

1. 去到 item 所在格
2. `PickUp`
3. 去到目标格
4. `Drop` 或 `Deliver`

这里的分叉取决于搬运目的地是什么：

- 如果目标是普通存储，就是 `Drop`
- 如果目标是蓝图，就是 `Deliver`

所以从设计上看，haul job 并不关心“这是 stockpile 业务还是 construction 业务”，它只关心：

- 拿什么
- 从哪里拿
- 送到哪里
- 最后是落地还是交付

这让一条搬运链既能服务存储区，也能服务蓝图施工。

---

## 场景四：Pickup 阶段到底做了什么

当 Pawn 真正走到物品格子上时，[pickup.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/pickup.handler.ts) 会执行 `PickUp`。

这个 handler 主要做了几件事：

1. 校验 pawn 当前没有在 carrying 其他物品
2. 校验目标 item 存在，而且 Pawn 真的站在 item 所在格
3. 读取这次计划要拿多少
4. 按数量从 item stack 中扣减
5. 把拿到的结果写进 `pawn.inventory.carrying`
6. 把 `defId` 等信息传给后续 `Drop/Deliver` toil

这里一个非常重要的点是：

`pickup 拿的是计划数量，不一定是整堆。`

这也是 4 月 10 日那批修复里最重要的行为之一。

系统会综合三件事决定实际拿多少：

- toil 里请求的 `requestedCount`
- item 当前的 `stackCount`
- pawn 的携带容量 `carryCapacity`

也就是说，pickup 不是“把目标物品整个拿走”，而是“按本次 job 的计划拿走一部分或全部”。

拿完之后，如果原始 stack 还有剩余，它会继续留在地图上；只有整堆被拿空时，地图对象才会被移除。

这正是后面数量搬运、堆叠和多 Pawn 接力的基础。

---

## 场景五：物品送到 Stockpile 后为什么有时会堆叠，有时会溢出

当 haul job 的最后一步是 `Drop` 时，执行逻辑在 [drop.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/drop.handler.ts)。

这里并不是简单“把物品丢在目标格”。

它会先尝试：

- 以目标格为优先
- 只在 `stockpile-only` 范围内搜索
- 优先复用已有 stack

也就是说，系统优先想做的是：

`把这批物品放回一个合法的 stockpile 格子里，并尽量叠到已有同类堆上。`

如果 stockpile 空间不足，才会进入第二层 fallback：

- 改成 `nearest-compatible`
- 在附近可兼容格子落地
- 必要时允许 overflow

这就是为什么你会看到两种结果：

1. 理想情况：物品在 stockpile 内合并到已有堆里
2. 极端情况：stockpile 放不下，物品被迫落在附近兼容格

这不是随机行为，而是显式设计出的两阶段策略。

而决定“哪些格子是合法 stockpile 目标”“哪些格子可以继续堆叠”的底层规则，仍然来自 `item.queries` 和 zone 配置。

---

## 场景六：物品送给蓝图时为什么不走 Drop，而走 Deliver

如果 haul job 的目标不是 stockpile，而是蓝图，那么最后一步会走 [deliver.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/deliver.handler.ts)。

这一步和 `Drop` 的差别在于：

- `Drop` 是把实体 item 放回地图
- `Deliver` 是把携带材料计入 blueprint 的 `materialsDelivered`

也就是说，交付材料并不一定意味着地图上会出现一个新的物品堆。

在 `Deliver` 里，系统会：

1. 检查 Pawn 是否到了目标格
2. 从 carrying 中扣出本次计划交付的数量
3. 更新 blueprint 的 `materialsDelivered`
4. 如果蓝图材料齐了，尝试把 blueprint 推进到下一阶段

如果交付不完整，或者多余材料没法继续交给蓝图，剩余部分会通过 `placeItemOnMap` 走地面兜底。

所以 `Deliver` 的核心意义是：

`把物品从“地图上的堆”转成“蓝图已收到的材料进度”。`

---

## 场景七：Reservation 为什么是这条链能稳定工作的关键

如果没有 reservation，下面这些问题会频繁发生：

- 两个 Pawn 同时去拿同一堆木材
- 一个 Pawn 已经拿了材料，另一个 Pawn 还以为它可用
- 同一个 blueprint 同时被多人争抢

当前流程是 AI 在真正分配 job 之前，先尝试 reserve 目标对象。

这意味着 reservation 是“分配的一部分”，不是“执行结束后的附加记录”。

在 [job-selector.ts](D:/CC/Twist-v1/src/features/ai/job-selector.ts) 里，候选 job 即使评分最高，也要先过 reservation 这一关。只有 reserve 成功，job 才会真正被 assign 给 Pawn。

这让系统能在“选工作”的时候就做去冲突，而不是等 Pawn 走过去之后才发现撞车。

---

## 场景八：为什么中断后系统还能恢复，而不是永远卡死

只做 reservation 还不够，系统还必须有 cleanup。

否则一旦发生这些情况：

- 目标 item 被销毁
- pawn 被征召
- 当前 job 被强制替换
- 旧的 carrying 状态没清掉

reservation 就可能永远挂在地图上，导致后续 Pawn 再也接不到这项工作。

当前这层兜底主要在 [reservation.cleanup.ts](D:/CC/Twist-v1/src/features/reservation/reservation.cleanup.ts) 和相关 AI 生命周期清理逻辑里。

以 `releaseMissingTargetReservations` 为例，它会遍历所有 reservation，把目标对象已经不存在或已销毁的 reservation 释放掉。

这层逻辑的价值在于：

`reservation 不是一次性成功就永远有效，它必须随着世界状态持续校正。`

所以一个更完整的心智模型是：

- reservation 在 job 分配时建立
- pickup / deliver / drop 在执行阶段消费这份独占权
- cleanup 在中断或异常后把坏掉的独占权回收

这样系统才能恢复流动性，让别的 Pawn 接手后续工作。

---

## 这两个领域放在一起时，最该记住的规则

### 1. Zone 解决的是“哪里可以放”

`zone` 本身不搬东西，它负责定义：

- 哪些格子属于某种功能区
- 哪些格子具有存储语义
- 哪些格子对某类物品是合法目的地

### 2. Pickup 解决的是“怎么把东西搬过去”

`pickup / haul / drop / deliver` 才是把地图状态真正改掉的执行链。

它负责：

- 找到物品
- 按计划数量拿走
- 走到目标位置
- 放下或交付

### 3. Item Query 是二者之间的桥

`item.queries` 把 zone 的语义和物品放置规则接起来。

如果没有这一层，AI 只知道“有 stockpile”，但不知道：

- 哪个格子更合适
- 哪个格子还能继续堆叠
- 哪个格子虽然在 zone 里，但实际上已经不能放

### 4. Reservation 解决的是并发冲突

它不是可选优化，而是多 Pawn 环境里保证稳定性的基础设施。

### 5. Cleanup 解决的是异常恢复

没有 cleanup，系统迟早会积累脏 reservation 和脏 carrying 状态，最后表现为：

- 物品没人搬
- 蓝图没人送
- AI 看起来“没事可做”

---

## 可以怎么理解整个系统

如果把这套系统压缩成一句话，可以这样理解：

`Zone 决定“合法目的地”，Job Selector 决定“值不值得搬”，PickUp/Drop/Deliver 决定“物品如何流动”，Reservation 与 Cleanup 保证这条流动链在多 Pawn 和异常情况下仍然稳定。`

这也是为什么在当前版本里，`zones` 和 `pickup` 其实应该被当成同一条业务链的上下游，而不是两个彼此独立的小功能。

---

## 相关代码入口

- [zone.commands.ts](D:/CC/Twist-v1/src/features/zone/zone.commands.ts)
- [zone.analysis.ts](D:/CC/Twist-v1/src/features/zone/zone.analysis.ts)
- [zone.queries.ts](D:/CC/Twist-v1/src/features/zone/zone.queries.ts)
- [zone-manager.ts](D:/CC/Twist-v1/src/world/zone-manager.ts)
- [job-selector.ts](D:/CC/Twist-v1/src/features/ai/job-selector.ts)
- [haul-job.ts](D:/CC/Twist-v1/src/features/ai/jobs/haul-job.ts)
- [pickup.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/pickup.handler.ts)
- [drop.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/drop.handler.ts)
- [deliver.handler.ts](D:/CC/Twist-v1/src/features/ai/toil-handlers/deliver.handler.ts)
- [item.queries.ts](D:/CC/Twist-v1/src/features/item/item.queries.ts)
- [reservation.cleanup.ts](D:/CC/Twist-v1/src/features/reservation/reservation.cleanup.ts)
