# Scenario 边界与长剧本回归设计

**日期：** 2026-04-10
**主题：** 为 `Twist-v1` 的 simulation scenario 测试体系补充清晰的测试边界，并设计覆盖 `zone / stockpile / pickup / reservation` 改动的长剧本回归场景
**关联文档：**
- [2026-04-10-simulation-scenario-testing-design.md](D:/CC/Twist-v1/docs/superpowers/specs/2026-04-10-simulation-scenario-testing-design.md)
- [scenario-testing.md](D:/CC/Twist-v1/docs/testing/scenario-testing.md)

---

## 1. 背景与问题

项目已经有一套可运行的 scenario 测试框架，包含：

- scenario DSL
- headless runner
- visual runner
- 4 个基础业务场景

这套框架已经足以承载回归测试，但当前 helper 的组织方式仍然偏“按用途混放”：

- `setup-actions.ts`
- `player-actions.ts`
- `wait-conditions.ts`

这种结构在项目早期够用，但当 scenario 开始覆盖更复杂的业务链时，会逐渐出现两个风险：

1. 写场景的人容易为了尽快把测试写通过，直接改 `pawn.ai`、`inventory.carrying`、`map.zones` 等内部状态，而不是走正式命令入口。
2. 业务动作、测试造数、状态观察混在一起后，不熟悉项目的人很难判断一个 helper 是在“模拟正式行为”，还是在“直接篡改世界”。

对于这次 2026-04-10 提交涉及的改动，这个问题尤其明显。因为本次改动覆盖了两条连续主线：

- `zone / stockpile` 创建、扩展、移除、重新选点
- `pickup / haul / drop / deliver / reservation cleanup` 的整条物品搬运链

如果 scenario 直接绕过正式入口，这些场景虽然可能“测绿”，但并不能真正保护线上逻辑。

因此，本设计的目标不是再加一批 helper，而是先把 scenario 的边界定义清楚，再基于这个边界去设计更长、更接近真实游玩的回归场景。

---

## 2. 设计目标

### 2.1 主要目标

1. 用目录结构和上下文能力，明确区分：
   - 初始世界搭建
   - 正式业务驱动
   - 状态观察与断言
2. 让写 scenario 的人即使不熟悉项目，也能从 helper 所在目录和可用上下文判断“能做什么、不能做什么”。
3. 保证 scenario 的 `script` 阶段尽量复用正式环境入口，而不是发明测试专用捷径。
4. 设计一组以“长剧本”为主的 scenario，覆盖 2026-04-10 当天 `zone / stockpile / pickup / reservation` 的高风险改动。
5. 保持 scenario 的业务语言可读性，让 headless 输出和 visual HUD 都能直接展示场景步骤。

### 2.2 非目标

- 本设计不覆盖 Preact 工具栏、下拉菜单、按钮高亮等 UI 组件行为；这些应继续由组件测试或 selector 测试保护。
- 本设计不把 scenario 做成精确到每次内部 toil 状态切换的白盒测试。
- 本设计不通过 import 规则或 CI 脚本强制约束边界；本次只采用目录和上下文能力分层。

---

## 3. 核心原则

### 3.1 一句话规则

`fixture 造局，command 发命令，probe 做观察。`

这是整个方案最重要的边界约束。

### 3.2 setup 可以造世界，script 不可以

`setup` 阶段允许直接使用 factory 建立测试世界，因为“生成一棵树”“生成一堆木材”“生成一个 pawn”本身并不是正式玩家操作。

但 `script` 阶段一旦开始，就应尽量只通过正式环境的业务入口推进：

- `commandQueue.push(...)`
- 正式 command handler
- `stepTicks(...)`

不能在 `script` 阶段直接改以下内容：

- `pawn.ai.currentJob`
- `pawn.ai.currentToilIndex`
- `pawn.ai.toilState`
- `pawn.inventory.carrying`
- `map.zones`
- `map.reservations`
- 物品瞬移
- 建筑/蓝图瞬移到目标态

### 3.3 wait / assert 只能读，不改

`waitFor` 和 `assert` 的 helper 只负责观察世界是否达到条件：

- job 是否切换
- 物品是否出现在目标格
- reservation 是否释放
- 建筑是否落地

这些 helper 不允许修世界状态，也不允许主动触发 cleanup。

### 3.4 单元测试和 scenario 测试的职责分离

如果一个验证必须直接改内部状态才能稳定表达，那么它更适合作为 feature/unit test，而不是 scenario。

scenario 主要验证：

- 玩家/系统意图进入 world
- AI 选 job
- toil 推进
- 物品 / 建筑 / reservation 状态变化
- 最终业务结果

feature/unit test 主要验证：

- 特定 handler 的边界条件
- cleanup 的纯逻辑
- selector / helper 的实现细节

---

## 4. 目录重组方案

现有目录：

```text
src/testing/scenario-actions/
  setup-actions.ts
  player-actions.ts
  wait-conditions.ts
```

直接替换为：

```text
src/testing/
  scenario-fixtures/
    world-fixtures.ts
  scenario-commands/
    zone-commands.ts
    player-commands.ts
  scenario-probes/
    pawn-probes.ts
    item-probes.ts
    reservation-probes.ts
    building-probes.ts
```

### 4.1 `scenario-fixtures/`

职责：只用于 `setup`，只负责搭建初始世界。

允许：

- `createPawn`
- `createItem`
- `createPlant`
- 直接往 map 中添加对象
- 设置初始 need 数值

不允许：

- 作为“中途事件”去篡改运行中世界
- 在 `script` 阶段被调用

建议 helper：

- `spawnPawnFixture`
- `spawnItemFixture`
- `placeTreeFixture`
- `setPawnFoodFixture`

### 4.2 `scenario-commands/`

职责：只用于 `script`，只负责发正式命令和推进 tick。

允许：

- 推送正式命令
- 通过命令触发业务链
- 推进 `stepTicks`
- 用只读 query 查找对象 id 或当前目标

不允许：

- 直接写 `World`
- 直接改 `pawn` / `item` / `zone` / `reservation`
- 直接调用内部 cleanup 函数“模拟流程”

建议 helper：

- `createZoneCommand`
- `removeZoneCellsCommand`
- `deleteZoneCommand`
- `designateCutCommand`
- `placeBlueprintCommand`
- `draftPawnCommand`
- `forceGotoCommand`

### 4.3 `scenario-probes/`

职责：只用于 `waitFor` 和 `expect`，只负责读取状态。

允许：

- 读对象状态
- 读 zone / reservation / building 状态
- 汇总 item 数量

不允许：

- 修改世界
- 发命令
- 推进 ticks

建议 helper：

- `waitForPawnJobDef`
- `waitForPawnCarrying`
- `assertPawnNotCarrying`
- `waitForItemAt`
- `assertItemStackAt`
- `assertNoItemAt`
- `assertTotalItemCountInCells`
- `waitForReservationReleased`
- `waitForBlueprintDelivered`
- `waitForBuildingCreated`
- `assertBuildingExists`

---

## 5. 上下文能力分层

仅靠目录命名还不够，还需要在 DSL 层把不同阶段可用的能力切开。

### 5.1 新的上下文模型

```ts
type SetupContext = {
  harness: ScenarioHarness;
};

type ScenarioQueryApi = {
  findPawnByName(name: string): Pawn | null;
  findItemAt(defId: string, cell: CellCoord): Item | null;
  findItemsByDef(defId: string): Item[];
  getZoneAt(cell: CellCoord): Zone | null;
  getZonesByType(zoneType: ZoneType): Zone[];
  isReserved(targetId: string): boolean;
  totalItemCountInCells(defId: string, cells: CellCoord[]): number;
};

type CommandContext = {
  issueCommand(command: Command): void;
  stepTicks(ticks?: number): void;
  query: ScenarioQueryApi;
};

type ProbeContext = {
  query: ScenarioQueryApi;
};
```

### 5.2 为什么要这样拆

当前所有 helper 都能拿到完整 `harness`，这意味着：

- `setup` helper 能直接改世界，合理
- `script` helper 也能直接改世界，危险
- `wait/assert` helper 也能直接改世界，最危险

把上下文拆开之后：

- `fixture` 拿到 `SetupContext`，可以造局
- `command` 拿到 `CommandContext`，只能发命令和推进世界
- `probe` 拿到 `ProbeContext`，只能读状态

这样边界会直接体现在函数签名上，而不是靠口头约定。

### 5.3 Builder 的建议变化

建议把 [scenario.builders.ts](D:/CC/Twist-v1/src/testing/scenario-dsl/scenario.builders.ts) 从“一个 action builder”扩成 3 种 builder：

```ts
createSetupStep(title, (ctx: SetupContext) => void, detail?)
createCommandStep(title, (ctx: CommandContext) => void, detail?)
createWaitForStep(title, (ctx: ProbeContext) => boolean, options)
createAssertStep(title, (ctx: ProbeContext) => boolean, options)
```

这会让 scenario 文件读起来更直观：

- setup 看到的是 world fixture
- script 看到的是 command step + wait step
- expect 看到的是 assert step

---

## 6. 场景覆盖策略

### 6.1 为什么从“多短场景”改成“长剧本”

针对 2026-04-10 这批改动，单纯拆成很多短场景虽然容易定位，但会丢掉最关键的“业务连续性”：

- zone 创建后是否真的能驱动 AI 选 haul
- quantity-aware pickup 是否真的会影响 deliver / drop
- reservation cleanup 是否真的允许后续 pawn 接手原目标

这些不是孤立函数行为，而是一整段链路是否还能跑通。

因此，这次回归策略改为：

- 保留 1 个基础 smoke 场景
- 新增 3 个长剧本场景

整体目标是既保留最低成本回归，又用长剧本覆盖高风险主链路。

### 6.2 建议保留的基础场景

- `stockpile-haul`

它继续承担最小冒烟职责：

- 创建 stockpile
- 生成木材
- AI 自动搬运
- 木材进入 stockpile

这个场景用来快速回答一个问题：

`最基本的 stockpile 搬运链是否还活着？`

---

## 7. 新增长剧本 Scenario 草案

以下 3 个 scenario 是本次设计的核心。

### 7.1 `zone-stockpile-lifecycle`

**建议文件：**
[zone-stockpile-lifecycle.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/zone-stockpile-lifecycle.scenario.ts)

**目标：**
验证 stockpile zone 从创建、扩展、局部移除到继续服务 AI 搬运的完整生命周期。

**覆盖业务点：**

- `zone_set_cells` 创建 zone
- 相邻格二次框选后的扩展或合并
- `zone_remove_cells` 后 zone 可用范围变化
- AI 在 zone 变化后仍能重新找到有效目标格
- 被移除格不再接收新搬运

**建议 setup：**

- 生成 1 个 `Hauler`
- 在左侧分三批放置 `wood`
  - `wood x4` at `(6, 10)`
  - `wood x3` at `(6, 12)`
  - `wood x2` at `(6, 14)`

**建议 script：**

1. 创建初始 stockpile：`(16,10) (17,10)`
2. 等待第一批木材进入 stockpile
3. 扩展 stockpile：新增 `(18,10) (18,11)`
4. 等待第二批木材进入扩展后的区域
5. 移除旧格：`(16,10)`
6. 等待第三批木材被搬入剩余有效格

**建议 expect：**

- `(16,10)` 在移除后不再接收第三批新物品
- 剩余有效格中木材总数达到 `9`
- zone 内至少存在 2 个有效落点

**接近代码的草案：**

```ts
export const zoneStockpileLifecycleScenario = createScenario({
  id: 'zone-stockpile-lifecycle',
  title: 'Stockpile 区域生命周期',
  description: '验证 stockpile 从创建、扩展、移除部分格子到继续承接搬运的完整链路',
  report: {
    focus: '关注 zone 变化后 AI 是否仍能正确选择有效 stockpile 目标格',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 6, y: 10 }, 4),
    spawnItemFixture('wood', { x: 6, y: 12 }, 3),
    spawnItemFixture('wood', { x: 6, y: 14 }, 2),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }]),
    waitForItemAt('等待第一批木材进入 stockpile', 'wood', { x: 16, y: 10 }, 300),
    createZoneCommand('stockpile', [{ x: 18, y: 10 }, { x: 18, y: 11 }]),
    waitForItemAt('等待第二批木材进入扩展区域', 'wood', { x: 18, y: 10 }, 300),
    removeZoneCellsCommand([{ x: 16, y: 10 }]),
    waitForItemAt('等待第三批木材进入剩余有效格', 'wood', { x: 17, y: 10 }, 300),
  ],
  expect: [
    assertNoNewDeliveryAt('被移除格不应再接收新木材', 'wood', { x: 16, y: 10 }),
    assertTotalItemCountInCells('wood', [{ x: 17, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 11 }], 9),
  ],
});
```

**备注：**
`assertNoNewDeliveryAt` 不必真的追踪“第几批”，实现上可以通过在移除动作前记录快照，或更稳妥地改成“第三批完成后，剩余有效格总数满足预期且 `(16,10)` 没有新增增长”。

### 7.2 `quantity-haul-stack-chain`

**建议文件：**
[quantity-haul-stack-chain.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/quantity-haul-stack-chain.scenario.ts)

**目标：**
验证 quantity-aware hauling、stack placement 和 stockpile 持续接收多批物品时的最终结果。

**覆盖业务点：**

- `pickup.handler` 的数量感知
- `deliver.handler` / `drop.handler` 的正确落点与堆叠
- `item.placement` 的最终堆叠收敛
- 非 stockpile 地面残留清空

**建议 setup：**

- 生成 1 个 `Hauler`
- 在相邻地面放 3 堆木材
  - `wood x3` at `(4,10)`
  - `wood x5` at `(5,10)`
  - `wood x7` at `(6,10)`

**建议 script：**

1. 创建 3 格 stockpile
2. 等待第一处木材入库
3. 等待第二处木材入库
4. 等待第三处木材入库

**建议 expect：**

- stockpile 总木材数为 `15`
- 至少一个 stockpile 格上的堆叠数大于单批搬运量下限
- 原始三处地面残留为 `0`

**接近代码的草案：**

```ts
export const quantityHaulStackChainScenario = createScenario({
  id: 'quantity-haul-stack-chain',
  title: '数量搬运与堆叠链路',
  description: '验证 quantity-aware pickup、deliver、drop 与最终 stack 收敛',
  report: {
    focus: '关注多批木材持续入库后，stockpile 总量与堆叠结果是否正确',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 4, y: 10 }, 3),
    spawnItemFixture('wood', { x: 5, y: 10 }, 5),
    spawnItemFixture('wood', { x: 6, y: 10 }, 7),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }]),
    waitForItemAt('等待第一批木材入库', 'wood', { x: 16, y: 10 }, 300),
    waitForItemAt('等待第二批木材入库', 'wood', { x: 17, y: 10 }, 300),
    waitForItemAt('等待第三批木材入库', 'wood', { x: 18, y: 10 }, 300),
  ],
  expect: [
    assertTotalItemCountInCells('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 15),
    assertAnyItemStackAtLeast('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 3),
    assertNoItemAt('wood', { x: 4, y: 10 }),
    assertNoItemAt('wood', { x: 5, y: 10 }),
    assertNoItemAt('wood', { x: 6, y: 10 }),
  ],
});
```

**备注：**
这个场景不应把断言写成“必须精确落在哪一格”，否则会把合法的放置策略变化误判成回归。应更多聚焦：

- 总量守恒
- 源地清空
- zone 内存在合理堆叠

### 7.3 `interrupted-haul-reservation-recovery`

**建议文件：**
[interrupted-haul-reservation-recovery.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/interrupted-haul-reservation-recovery.scenario.ts)

**目标：**
验证搬运链在中断后，reservation 是否释放、旧 carrying 是否清理、其他 pawn 是否能接手并最终完成目标。

这是本次设计中条件最复杂、价值最高的场景。

**覆盖业务点：**

- 物品先被某个 pawn 选中并进入搬运链
- 中途通过正式命令中断旧 job
- cleanup 释放 reservation
- 原目标物品可以重新被其他 pawn 选中
- blueprint / construction 流程最终完成

**建议 setup：**

- `Hauler-A` at `(8,10)`
- `Hauler-B` at `(8,12)`
- `wood x15` at `(4,10)`
- 预建 1 片 stockpile，供中断后掉落或回流物品有合法落点

**建议 script：**

1. 创建 stockpile
2. 放置 `wall_wood` blueprint 在 `(16,10)`
3. 等待 `Hauler-A` 切到 `job_deliver_materials`
4. 等待 `Hauler-A` 身上开始 carrying `wood`
5. 对 `Hauler-A` 发 `draftPawnCommand`
6. 等待源物品 reservation 释放
7. 等待 `Hauler-B` 接手同一链路
8. 等待 blueprint 材料送达
9. 等待建筑完成

**建议 expect：**

- 建筑最终存在
- `Hauler-A` 不再 carrying
- 原目标 stack 不再处于 reserved
- 木材总量守恒

**接近代码的草案：**

```ts
export const interruptedHaulReservationRecoveryScenario = createScenario({
  id: 'interrupted-haul-reservation-recovery',
  title: '中断搬运后的预约恢复',
  description: '验证 haul/deliver 链在被中断后，reservation 能释放并由其他 pawn 接手完成',
  report: {
    focus: '关注中断后的 cleanup、reservation 释放，以及第二个 pawn 是否能顺利接力',
  },
  setup: [
    spawnPawnFixture({ x: 8, y: 10 }, 'Hauler-A'),
    spawnPawnFixture({ x: 8, y: 12 }, 'Hauler-B'),
    spawnItemFixture('wood', { x: 4, y: 10 }, 15, { alias: 'sourceWood' }),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 14, y: 9 }, { x: 14, y: 10 }, { x: 14, y: 11 }]),
    placeBlueprintCommand('wall_wood', { x: 16, y: 10 }),
    waitForPawnJobDef('等待 A 接到送材工作', 'Hauler-A', 'job_deliver_materials', 200),
    waitForPawnCarrying('等待 A 拿起木材', 'Hauler-A', 'wood', 1, 200),
    draftPawnCommand('征召 A 以中断当前搬运', 'Hauler-A'),
    waitForReservationReleased('等待源木材 reservation 释放', 'sourceWood', 120),
    waitForPawnJobDef('等待 B 接手送材工作', 'Hauler-B', 'job_deliver_materials', 200),
    waitForBlueprintDelivered('等待蓝图材料送达', 'wall_wood', 300),
    waitForBuildingCreated('等待建筑完成', 'wall_wood', { x: 16, y: 10 }, 600),
  ],
  expect: [
    assertBuildingExists('wall_wood', { x: 16, y: 10 }),
    assertPawnNotCarrying('Hauler-A'),
    assertReservationReleased('sourceWood'),
    assertWoodCountConserved('wood', 15),
  ],
});
```

**关键说明：**

- 推荐使用 `draft_pawn` 作为中断入口，而不是直接写 job 状态。
- 推荐在 fixture 层支持 `alias`，把 `sourceWood` 记录到 scenario metadata，后续 probe 再通过 alias 查询对象 id。
- 如果实现上发现 `draft_pawn` 的时机不稳定，可退一步改为 `forceGotoCommand`，但仍必须走正式命令入口。

---

## 8. 需要补充的 Helper 草案

为了支撑上述长剧本，建议补充以下 helper。

### 8.1 Fixtures

**文件：**
[world-fixtures.ts](D:/CC/Twist-v1/src/testing/scenario-fixtures/world-fixtures.ts)

**建议能力：**

- `spawnPawnFixture(cell, name)`
- `spawnItemFixture(defId, cell, count, options?)`
- `placeTreeFixture(cell, defId?)`
- `setPawnFoodFixture(name, food)`

其中 `spawnItemFixture` 建议支持：

```ts
spawnItemFixture('wood', { x: 4, y: 10 }, 15, { alias: 'sourceWood' })
```

以便复杂场景后续引用同一对象。

### 8.2 Commands

**文件：**
[zone-commands.ts](D:/CC/Twist-v1/src/testing/scenario-commands/zone-commands.ts)
[player-commands.ts](D:/CC/Twist-v1/src/testing/scenario-commands/player-commands.ts)

**建议能力：**

- `createZoneCommand(title, zoneType, cells)`
- `removeZoneCellsCommand(title, cells)`
- `deleteZoneCommand(title, zoneIdOrAlias)`
- `designateCutCommand(title, cell)`
- `placeBlueprintCommand(title, defId, cell)`
- `draftPawnCommand(title, pawnName)`
- `forceGotoCommand(title, pawnName, targetCell)`

这些 helper 内部都应做同一件事：

1. 用 query 找到需要的对象或 map id
2. `issueCommand(...)`
3. `stepTicks(1)` 让命令被正式消费

### 8.3 Probes

**文件：**
[pawn-probes.ts](D:/CC/Twist-v1/src/testing/scenario-probes/pawn-probes.ts)
[item-probes.ts](D:/CC/Twist-v1/src/testing/scenario-probes/item-probes.ts)
[reservation-probes.ts](D:/CC/Twist-v1/src/testing/scenario-probes/reservation-probes.ts)
[building-probes.ts](D:/CC/Twist-v1/src/testing/scenario-probes/building-probes.ts)

**建议能力：**

- `waitForPawnJobDef`
- `waitForPawnCarrying`
- `assertPawnNotCarrying`
- `waitForItemAt`
- `assertItemStackAt`
- `assertAnyItemStackAtLeast`
- `assertNoItemAt`
- `assertTotalItemCountInCells`
- `waitForReservationReleased`
- `assertReservationReleased`
- `waitForBlueprintDelivered`
- `waitForBuildingCreated`
- `assertBuildingExists`
- `assertWoodCountConserved`

其中：

- `assertWoodCountConserved` 不一定真的限定 `wood`，可以做成通用的 `assertItemCountConserved`
- `waitForReservationReleased` 建议支持对象 alias，而不是只支持裸 id

---

## 9. 对现有场景的重写建议

现有 4 个场景都应一起迁移到新边界，不保留新旧并存阶段。

涉及文件：

- [woodcutting.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/woodcutting.scenario.ts)
- [stockpile-haul.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/stockpile-haul.scenario.ts)
- [eating.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/eating.scenario.ts)
- [blueprint-construction.scenario.ts](D:/CC/Twist-v1/src/testing/scenarios/blueprint-construction.scenario.ts)

迁移原则：

1. `setup` 全部改用 `scenario-fixtures`
2. `script` 全部改用 `scenario-commands` + `scenario-probes`
3. `expect` 全部改用 `scenario-probes`
4. 删除旧的 `scenario-actions`

迁移后 [scenario-registry.ts](D:/CC/Twist-v1/src/testing/scenario-registry.ts) 应变成：

- 保留现有 4 个基础场景
- 追加 3 个长剧本场景

建议注册顺序：

1. `woodcutting`
2. `stockpile-haul`
3. `eating`
4. `blueprint-construction`
5. `zone-stockpile-lifecycle`
6. `quantity-haul-stack-chain`
7. `interrupted-haul-reservation-recovery`

这个顺序从最基础的正向链路逐步走到复杂中断恢复，便于回归套件从轻到重定位问题。

---

## 10. 风险与取舍

### 10.1 不把断言写得过白盒

长剧本越复杂，越容易出现“行为是正确的，但路径和预期不完全一样”的情况。

因此需要避免这些脆弱断言：

- 必须由某个固定 pawn 走完整个全过程
- 物品必须准确落在某一个格子
- 某一步必须在固定 tick 内完成

更稳妥的断言应聚焦：

- 最终业务结果
- 资源守恒
- 旧状态是否清理
- 后续链路是否恢复

### 10.2 复杂场景仍要有清晰阶段

虽然采用长剧本方案，但每个长剧本内部仍应分成明确阶段：

- 建局
- 激活业务
- 等待中间里程碑
- 触发变化或中断
- 等待恢复
- 最终断言

这样即使失败，也能从输出中较快看出卡在哪一段。

### 10.3 中断动作优先使用正式命令

复杂场景里最容易犯错的地方，是为了触发 reservation cleanup 而直接清空 job 或 reservation。

本设计明确规定：

- 优先用 `draft_pawn`
- 次选 `force_job`
- 不允许直接写 `pawn.ai.currentJob = null`
- 不允许直接调用 cleanup 函数制造假恢复

---

## 11. 实施建议

推荐实施顺序如下：

1. 改造 scenario DSL：
   - 新增 `SetupContext / CommandContext / ProbeContext`
   - 新增 `ScenarioQueryApi`
   - 调整 builder
2. 重组目录：
   - 新建 `scenario-fixtures / scenario-commands / scenario-probes`
   - 删除 `scenario-actions`
3. 迁移现有 4 个基础场景
4. 实现新增 probe 和 command helper
5. 新增长剧本：
   - `zone-stockpile-lifecycle`
   - `quantity-haul-stack-chain`
   - `interrupted-haul-reservation-recovery`
6. 更新 `scenario-registry`
7. 运行 headless regression，确认所有场景通过
8. 在 visual runner 中手动过一遍复杂场景，检查 HUD 可读性

---

## 12. 结论

这份补充设计的核心不是“再写几个 scenario”，而是先把 scenario 的边界收紧，再让长剧本真正代表正式业务链路。

最终形成的约束应当非常简单：

- `fixture` 只负责造局
- `command` 只负责发正式命令
- `probe` 只负责观察结果

在这个边界下，新增长剧本场景将重点保护三类高风险回归：

1. `zone / stockpile` 生命周期变化后，AI 是否仍能使用正确的目标格
2. `pickup / deliver / drop / stack` 是否仍然满足数量语义和最终堆叠结果
3. `reservation cleanup` 是否真的支持中断后的任务恢复与他人接力

如果这些场景稳定存在，那么 2026-04-10 这批提交引入的核心业务变化，就会获得一层远比单点单测更接近真实玩法的回归保护。
