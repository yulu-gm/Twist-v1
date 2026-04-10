# Visual Test 工作台设计

**日期：** 2026-04-10  
**主题：** 将 `visual-test` 入口重构为单页场景工作台，让用户可以进入场景、手动启动、调节时间、调试步骤推进，并在不刷新的情况下返回场景选择页  
**关联文档：**
- [scenario-testing.md](D:/CC/Twist-v1/docs/testing/scenario-testing.md)
- [2026-04-10-simulation-scenario-testing-design.md](D:/CC/Twist-v1/docs/superpowers/specs/2026-04-10-simulation-scenario-testing-design.md)
- [2026-04-10-scenario-boundaries-and-long-regression-design.md](D:/CC/Twist-v1/docs/superpowers/specs/2026-04-10-scenario-boundaries-and-long-regression-design.md)

---

## 1. 背景

当前的 `visual-test` 流程虽然已经会打开 `scenario-select.html`，但用户一旦选中某个场景，页面就会立刻切换到执行态，而且没有留下清晰的会话边界。

目前的痛点主要有：

1. 运行完一个场景后，没有正式支持的方式退回选择页并在同一页里改跑其他场景。
2. 时间控制虽然存在，但它只体现在主游戏场景继承来的键盘快捷键上，在 visual runner 的使用流程里几乎不可发现。
3. visual runner controller 更像一次性执行器。它只暴露了 `run()`，却不拥有完整的会话生命周期，比如 `start`、`pause`、`restart`、`exit`、`destroy`。
4. 当前选择页会直接启动 controller，而 controller 在 bootstrap Phaser 时又没有保留 teardown 句柄。这会让重复跑场景时很容易残留旧的 `Phaser.Game` 实例、场景输入监听器，或者脏的 world 状态。

这些问题会让 visual runner 作为调试界面时非常别扭，尤其是面对较长场景时，用户往往需要暂停、单步、加速，或者退出后重新选场景再试。

---

## 2. 目标

### 2.1 主要目标

1. 把 `visual-test` 做成单页工作台，同时支持场景选择和场景执行，而且不需要页面刷新。
2. 把“选中了场景”和“开始跑场景”拆开，让用户先进入 `ready` 状态，再手动决定什么时候开始执行。
3. 在工作台 UI 上增加明确、可见的时间控制，而不是继续依赖隐藏的键盘快捷键。
4. 支持调试级别的推进控制：
   - 暂停
   - 1x / 2x / 3x 速度
   - 单步 1 tick
   - 单步 10 ticks
   - 运行到下一个有意义的执行门槛
5. 增加干净的返回选择页流程，在切到其他场景之前先销毁当前 visual session。
6. 确保 restart 总是创建一个全新的场景会话，包含全新的 world 和全新的 Phaser 实例。

### 2.2 非目标

1. 这次重构不尝试替换现有的 scenario DSL 或 headless runner。
2. 这次重构不打算把每一条脚本步骤都做成完整断点调试器。
3. 这次重构不改变生产运行时里 simulation speed 的核心语义。
4. 这次重构不要求引入单独的路由库或大型 app shell 框架。

---

## 3. 产品方向

本次选择的方向是 **单页工作台**。

从行为上，这个工作台应该这样工作：

1. 打开 `visual-test`。
2. 看到场景列表。
3. 选择一个场景。
4. 进入该场景的工作台视图，并处于 `ready` 状态。
5. 手动点击 `Start` 开始执行。
6. 运行过程中，通过可见控件暂停、调速、单步或运行到下一个门槛。
7. 任意时刻都可以不刷新页面直接退回选择页。
8. 重跑同一个场景时，总是新建一套全新的 session，并回到 `ready`。

这里最关键的产品决策是：**选择不等于执行**。用户选择场景时，只是加载了一个工作台 session，并不会自动开跑。

---

## 4. 推荐架构

工作台应拆成三层：

### 4.1 页面壳层

文件：[scenario-select-main.ts](D:/CC/Twist-v1/src/testing/visual-runner/scenario-select-main.ts)

职责：

1. 维护页面顶层模式：
   - selector 模式
   - workbench 模式
2. 读取和写入 `scenario` URL 参数。
3. 创建和释放当前 controller session。
4. 把 controller state 接到 HUD 视图。
5. 响应 HUD 发出的用户动作：
   - start
   - pause
   - resume
   - 调速
   - step ticks
   - run to next gate
   - restart
   - exit to selector

页面壳层不应该直接操作 world。

### 4.2 会话控制层

文件：[visual-scenario-controller.ts](D:/CC/Twist-v1/src/testing/visual-runner/visual-scenario-controller.ts)

职责：

1. 持有一整个 visual runner session，从创建到销毁。
2. 创建和销毁：
   - `visualHarness`
   - `shadowHarness`
   - `Phaser.Game`
3. 跟踪 session state，并以统一的只读快照形式暴露给 HUD。
4. 提供显式的 session 命令：
   - `start`
   - `pause`
   - `resume`
   - `setSpeed`
   - `stepTicks`
   - `runUntilNextGate`
   - `restart`
   - `destroy`

这是这次重构的中心。当前 controller 只是个 runner；新的 controller 必须成为生命周期拥有者。

### 4.3 工作台 HUD

文件：[scenario-hud.tsx](D:/CC/Twist-v1/src/testing/visual-runner/scenario-hud.tsx)

职责：

1. 展示当前场景元信息和 session 状态。
2. 渲染可见的操作按钮和时间控制。
3. 展示当前 tick、当前速度和当前步骤。
4. 继续展示 visual 与 shadow 的步骤进度和 divergence 数据。
5. 通过回调抛出用户意图，而不是直接修改运行时状态。

HUD 仍应保持为视图层，不应持有超出渲染需求之外的业务状态。

---

## 5. 会话状态模型

工作台应该把 session 状态正式化，而不是继续从零散字段里推断。

推荐状态：

1. `idle`
   未选择任何场景。
2. `ready`
   已选择场景并创建 session，但尚未开始执行。
3. `running`
   场景正在主动推进。
4. `paused`
   场景已经开始，但自动推进已停止。
5. `completed`
   场景成功完成。
6. `failed`
   场景某一步失败或出现运行时错误，但当前画面仍然保留，便于检查。

状态规则：

1. 选择场景时，状态从 `idle -> ready`。
2. 点击 `Start` 时，状态从 `ready -> running`。
3. 点击 `Pause` 时，状态从 `running -> paused`。
4. 点击 `Resume` 时，状态从 `paused -> running`。
5. 成功完成时，状态从 `running -> completed`。
6. 执行失败时，状态从 `running -> failed`。
7. `Restart` 总是销毁旧 session，然后回到 `ready`。
8. `Exit to Selector` 总是销毁旧 session，然后回到 `idle`。

这个状态模型可以消除“当前到底能不能点、点了会发生什么”的歧义。

---

## 6. Controller 接口设计

controller 应从一次性的 `run()` API 演进为显式的 session API。

推荐形状如下：

```ts
type VisualScenarioController = {
  getState(): ControllerState;
  subscribe(listener: (state: ControllerState) => void): () => void;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  setSpeed(speed: SimSpeed): void;
  stepTicks(count: number): Promise<void>;
  runUntilNextGate(): Promise<void>;
  restart(): Promise<void>;
  destroy(): Promise<void>;
};
```

### 6.1 `start()`

职责：

1. 如果当前是本 session 的第一次运行，就先 bootstrap Phaser。
2. 如果 setup 还没执行完，就先完成 setup。
3. 开始自动推进 visual scenario script。
4. 在整个过程中持续发出状态更新。

### 6.2 `pause()` 和 `resume()`

这两个方法应该成为暂停和继续的唯一正式入口。无论是 HUD 按钮还是键盘快捷键，都应流向这里。

内部仍然可以映射到 `world.speed`，但工作台不应该继续依赖“只能靠记住快捷键”的使用方式。

### 6.3 `setSpeed(speed)`

支持的值：

1. `Paused`
2. `Normal`
3. `Fast`
4. `UltraFast`

controller state 应同时暴露原始枚举值和面向用户的 label，以便 HUD 直接展示当前速度。

### 6.4 `stepTicks(count)`

目的：

在暂停状态下手动推进 world。

约束：

1. 只在 `paused` 状态有效。
2. 在 `ready`、`running`、`completed` 或 `failed` 状态下应拒绝执行或 no-op。
3. 每次推进后都必须更新 HUD。
4. 必须保留 divergence 跟踪和当前步骤跟踪。

本次工作台控制至少需要：

1. `stepTicks(1)`
2. `stepTicks(10)`

### 6.5 `runUntilNextGate()`

这是在基础单步之上最有价值的调试控制。

这里的 gate 建议定义为以下之一：

1. 某个 `waitFor` 条件第一次满足
2. 下一条脚本步骤边界完成
3. 场景完成
4. 场景失败

这样用户在面对长场景时，就不必一直手点 `+1 tick`，也不至于用全速运行一下子错过关键观察点。

### 6.6 `restart()`

职责：

1. 完整销毁当前 session。
2. 用同一场景和确定性 seed 重新创建 harness 和全新的 controller state。
3. 把新 session 置回 `ready`。
4. 清空 tick 计数、步骤摘要、divergence 状态和结果状态。

`restart()` 绝不能复用脏的 world 或残留的 `Phaser.Game`。

### 6.7 `destroy()`

这是这次重构的必需接口。

职责：

1. 如果存在活动中的 `Phaser.Game`，调用 `game.destroy(true)`。
2. 如果 Phaser 在 `scenario-game-container` 里留下残留 DOM，也要清掉。
3. 释放 controller 的订阅、轮询或其他异步资源。
4. 标记 session 为 inactive，避免晚到的异步任务再去更新已经销毁的状态。

如果没有正式的 destroy 路径，退出和重跑行为就仍然会很脆弱。

---

## 7. 工作台 UI 布局

当前 HUD 应从右侧只读面板升级为右侧工作台面板。

推荐从上到下分成几个区块：

### 7.1 会话头部

展示：

1. 场景标题
2. 场景 id
3. session state
4. 当前 tick
5. 当前速度
6. 当前步骤标题

这样用户一眼就能知道自己现在在哪个场景、处于什么状态。

### 7.2 主操作区

主要按钮：

1. `Start`
2. `Pause`
3. `Resume`
4. `Restart`
5. `Back to Scenarios`

显示规则：

1. `ready`：显示 `Start`
2. `running`：显示 `Pause`
3. `paused`：显示 `Resume`
4. `completed` 和 `failed`：显示 `Restart` 与 `Back to Scenarios`

如果布局仍然清晰，`Restart` 和 `Back to Scenarios` 也可以在 `paused` 或 `ready` 下持续可见。

### 7.3 时间控制区

必须有可见控件：

1. `Pause`
2. `1x`
3. `2x`
4. `3x`
5. `+1 tick`
6. `+10 ticks`
7. `Run to Next Gate`

行为要求：

1. 只要 session 已经开始，速度按钮就应该可用。
2. `+1 tick`、`+10 ticks`、`Run to Next Gate` 只应在 `paused` 下可用。
3. 当前速度要有明显的高亮或选中态。

### 7.4 结果摘要区

展示：

1. pass / fail / completed 摘要
2. 是否存在 divergence
3. 最后一个完成的步骤
4. 第一条失败的步骤，如果有的话

这样用户在看完整步骤列表前，先能快速获得一次整体判断。

### 7.5 步骤面板

保留现在的双列概念：

1. `Visual Runner`
2. `Shadow Headless Runner`

继续显示每步状态和 divergence 信息，因为这仍然是 visual runner 的核心调试价值。

---

## 8. URL 行为

工作台应该保留 URL 的可用性，但不能让 URL 负责运行时状态。

### 8.1 URL 规则

1. 没有选中场景的选择页：
   - `scenario-select.html`
2. 已选中场景并进入工作台：
   - `scenario-select.html?scenario=<id>`

### 8.2 刷新行为

如果页面带着有效的 `scenario=<id>` 参数加载：

1. 应该把该场景加载到 `ready`
2. 不应该自动开始执行

这样既保留了可分享的直达链接，又符合“手动开始”的产品决策。

### 8.3 退出行为

当用户点击 `Back to Scenarios` 时：

1. 销毁当前活动 session
2. 从 URL 中移除 `scenario` 参数
3. 返回 selector 模式

---

## 9. 执行流程

### 9.1 进入场景

1. 用户点击某个场景卡片。
2. 页面壳层把 URL 更新为 `?scenario=<id>`。
3. 页面壳层为该场景创建 controller。
4. controller 构建一套全新的 session，并发出 `ready`。
5. 工作台视图出现，但场景步骤尚未开始执行。

### 9.2 开始运行

1. 用户点击 `Start`。
2. controller 在必要时 bootstrap Phaser。
3. controller 开始执行场景。
4. session 状态切到 `running`。

### 9.3 暂停与调试

1. 用户点击 `Pause`。
2. controller 切到 `paused`。
3. 此时用户可以：
   - 把速度重新切到 1x / 2x / 3x，然后再恢复运行
   - 单步 1 tick
   - 单步 10 ticks
   - 运行到下一个 gate

### 9.4 重跑

1. 用户点击 `Restart`。
2. controller 销毁当前 session。
3. controller 重新创建一套新的确定性 session。
4. 工作台回到 `ready`。

### 9.5 退出到选择页

1. 用户点击 `Back to Scenarios`。
2. controller 销毁当前 session。
3. 页面壳层移除 URL 里的 `scenario` 参数。
4. selector 视图重新变为激活状态。

---

## 10. Phaser 生命周期要求

当前实现虽然会 bootstrap Phaser，但并没有围绕它建立完整的生命周期约束。

重构后，`Phaser.Game` 实例应成为 controller session 的显式字段。

必须满足的规则：

1. 同一个工作台页面上，任意时刻最多只能有一个活着的 `Phaser.Game` 实例。
2. 开始新场景前，如果已有旧 game，必须先销毁旧 game。
3. 重跑同一场景时，必须销毁并重建 game。
4. 退出回选择页时，必须销毁 game 并清空 runner 容器。

这样可以避免叠加 scene、重复键盘监听，以及脏的渲染状态。

---

## 11. 数据流

推荐采用单向数据流：

1. 页面壳层持有当前 active controller 引用。
2. controller 发出不可变的状态快照。
3. HUD 渲染这些快照，并暴露回调。
4. 回调再流回页面壳层。
5. 页面壳层去调用 controller 方法。

HUD 不应该直接访问 `world`、`harness` 或 `Phaser.Game`。

这样可以保持视图层可测试，也能避免不小心产生运行时耦合。

---

## 12. 错误处理

这里应区分两种错误范围。

### 12.1 会话级失败

示例：

1. 某个 scenario step 失败
2. 某个 `waitFor` 超时
3. 检测到 divergence

处理方式：

1. 状态转成 `failed`
2. 保留当前 scene 和 HUD 状态
3. 允许用户继续检查、单步、重跑或返回选择页

工作台不应该一出错就直接把用户踢回选择页。

### 12.2 页面级失败

示例：

1. URL 里的 scenario id 不存在
2. controller 无法初始化
3. Phaser 在可用 session 建立前就 bootstrap 失败

处理方式：

1. 显示明确的错误提示条
2. 在可能的情况下回落到选择页

---

## 13. 测试策略

这次重构既需要 UI 行为测试，也需要 session 边界测试。

### 13.1 HUD 组件测试

文件：[scenario-hud.test.tsx](D:/CC/Twist-v1/src/testing/visual-runner/scenario-hud.test.tsx)

增加以下覆盖：

1. `ready`、`running`、`paused`、`completed`、`failed` 下按钮是否正确显示
2. 当前速度 label 是否正确渲染
3. tick 展示是否正确渲染
4. 以下控件的启用与禁用：
   - `+1 tick`
   - `+10 ticks`
   - `Run to Next Gate`

### 13.2 页面壳层测试

页面入口应抽出可测试的逻辑或 helper，这样不用真正启动 Phaser 也能测试。

增加以下覆盖：

1. 选择场景后进入 `ready`，而不是自动开跑
2. 退出回选择页时会清理 URL
3. 带 `?scenario=<id>` 刷新时会落到 `ready`
4. restart 会替换旧 controller session，而不是复用它

### 13.3 Controller 测试

增加围绕 session 生命周期的聚焦测试：

1. `destroy()` 会销毁活动中的 `Phaser.Game`
2. `restart()` 会重置 ticks、steps、divergence 和 result 状态
3. `setSpeed()` 会正确更新 session state
4. `stepTicks()` 只在 paused 下有效
5. `runUntilNextGate()` 会停在有效 gate 上，而不是一路跑到底

这些测试很关键，因为这次重构最难出问题的地方其实是 session 边界，而不是渲染本身。

---

## 14. 实施说明

本次实现最可能涉及这些改动：

1. [scenario-select-main.ts](D:/CC/Twist-v1/src/testing/visual-runner/scenario-select-main.ts)
   - 拆开 selector 模式和 workbench 模式
   - 取消选中场景后的自动开跑
   - 协调 URL、controller 创建和退出流程
2. [visual-scenario-controller.ts](D:/CC/Twist-v1/src/testing/visual-runner/visual-scenario-controller.ts)
   - 增加 session states
   - 持有 `Phaser.Game`
   - 增加明确的生命周期与调试控制方法
3. [scenario-hud.tsx](D:/CC/Twist-v1/src/testing/visual-runner/scenario-hud.tsx)
   - 渲染操作按钮
   - 渲染调速和步进控件
   - 渲染更丰富的 session 状态
4. [bootstrap.ts](D:/CC/Twist-v1/src/adapter/bootstrap.ts)
   - 大概率不需要改行为
   - 但它返回的 `Phaser.Game` 必须由 controller 保存并负责销毁
5. [scenario-select.html](D:/CC/Twist-v1/scenario-select.html)
   - 如果控制面板变大，可能需要调整布局

---

## 15. 风险与取舍

### 15.1 风险：HUD 过载

如果按钮太多，右侧面板容易显得拥挤。

缓解方式：

1. 保持单列结构
2. 用区块分组控件
3. 高级调试控件只在 `paused` 下启用

### 15.2 风险：异步会话竞争

如果 `destroy()` 发生时，仍有异步 run 过程在飞，那么晚到的 Promise 结果可能会更新已经失效的状态。

缓解方式：

1. 增加 session token 或 `isDisposed` 守卫
2. teardown 之后忽略所有晚到的异步完成事件

### 15.3 风险：步进语义与运行时漂移

如果手动步进没有走和正常 visual execution 一样的推进路径，用户就可能看到不一致行为。

缓解方式：

1. 让 stepping 复用同一套 harness 与 world 推进逻辑
2. 在 controller 内只保留一条 canonical advancement path

---

## 16. 结论

正确的重构方向不是在现有选择页上简单补几个按钮，而是把它真正做成带有显式 session ownership 的 visual-test 工作台。

这次设计的核心决策是：

1. 用单页工作台，而不是页面跳转式流程
2. 选择场景时只加载 `ready` session，不自动开跑
3. 用可见的时间控制替代纯隐藏式快捷键发现方式
4. 让 controller 成为生命周期拥有者，正式提供 `start`、`pause`、`resume`、`setSpeed`、`stepTicks`、`runUntilNextGate`、`restart`、`destroy`
5. 每一次退出和重跑都必须先销毁旧的 Phaser session

如果这些边界落得足够干净，visual runner 就会从一次性演示入口，变成真正可用的调试工作台。
