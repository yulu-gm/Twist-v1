# Simulation 场景测试体系设计

**日期：** 2026-04-10
**主题：** 为 `Twist-v1` 设计一套以业务场景为中心、支持无头回归与可视化人工验收的 simulation 测试体系

---

## 1. 背景与问题

当前项目的测试能力主要集中在 `src/ui/**`：

- 已有 `Vitest + jsdom` 基础设施。
- 已有 selector、reducer、组件层测试。
- simulation 主链路基本缺少成体系的保护网。

与此相对，项目当前最容易回归、也最值得验证的逻辑集中在：

- `features/ai`
- `features/item`
- `features/construction`
- `features/designation`
- `world` / `core` 的 tick 与 command 执行链路

这些模块恰好覆盖“玩家意图进入 world、AI 选择工作、toil 推进、物品/建造状态变化”的关键流程，也是后续高频改动区。如果没有统一的测试架构，团队会长期面临以下问题：

1. 修 bug 时只能靠手动点游戏验证。
2. 自动化测试即使补上，也容易停留在零散单测，无法覆盖真实业务流程。
3. 即使逻辑测试通过，也难以及时发现“真实游戏画面已与 simulation 脱节”的问题。
4. 人工验收与自动化回归走的是两条链路，结果不一致时很难定位分歧点。

因此，本次设计的目标不是单纯“多写一些测试”，而是建立一套**同源场景测试系统**：同一份业务级场景脚本，同时服务于无头自动化回归和可视化人工验收。

---

## 2. 设计目标

### 2.1 主要目标

1. 建立一套以**业务场景**为核心的 simulation 测试体系，而不是以零散纯函数单测为主。
2. 让同一份测试场景可以同时在以下两种模式运行：
   - 无头模式：快速、稳定、适合本地与 CI 回归。
   - 可视模式：自动执行同一脚本，同时展示真实游戏画面供人工验收。
3. 保证无头模式与可视模式使用**同一种场景 setup 方式**和**同一种模拟操作序列**，确保逻辑一致、结果可复现。
4. 在可视模式中提供**测试信息 UI**，用业务级原语实时展示：
   - 初始化了什么
   - 正在模拟什么操作
   - 当前等待什么结果
   - 哪一步开始出现异常
5. 在可视模式中同步运行一个 `shadow headless runner`，让测试者可以对照可视环境与无头环境的执行进度与状态分歧。
6. 第一阶段优先覆盖以下核心流程：
   - 砍树
   - 搬运进 stockpile
   - 建造蓝图
   - 进食

### 2.2 非目标

- 第一阶段不处理存档相关场景。
- 第一阶段不把像素级输入回放作为主测试路径。
- 第一阶段不做 render snapshot 对比。
- 第一阶段不把覆盖率门禁作为主要目标。
- 第一阶段不追求“一切都能 DSL 化”，而是优先支持高价值业务原语。

---

## 3. 设计原则

### 3.1 场景优先，而不是函数优先

主力回归测试应表达“玩家做了什么，世界发生了什么”，而不是只验证局部实现细节。  
单测仍然有价值，但在这套体系里属于补充层，而不是主轴。

### 3.2 同源脚本

无头与可视两种运行模式必须复用：

- 同一份场景定义
- 同一套场景搭建逻辑
- 同一套业务动作驱动逻辑
- 同一套等待与断言语义

不能接受“自动化走一条捷径、人工验收走另一条路径”的分叉架构。

### 3.3 业务级原语可读

场景脚本的步骤必须用业务语言表达，而不是实现细节：

- 好例子：`下达砍树指令`
- 坏例子：`dispatch designate_cut payload`

这样测试结果才适合在测试 UI 中直接展示，也便于后续维护与排障。

### 3.4 可观察性内建

测试系统不能只在失败时输出一条断言错误。  
它必须在运行过程中持续暴露：

- 当前步骤
- 当前等待条件
- 最近事件
- 当前 tick
- 双 runner 的进度差异

### 3.5 先比较 simulation，再观察 render

可视模式下的 shadow headless runner 只比较 simulation snapshot，不比较 render 细节。  
这样能避免将“渲染延迟一帧”“插值不同步”这类噪音误判为核心业务失败。

### 3.6 渐进落地

先用最小闭环打通 4 条核心业务场景，再逐步扩大原语集合与场景覆盖范围。  
避免一开始把测试框架本身做成另一个大型子系统。

---

## 4. 总体方案

推荐方案是：**场景 DSL 优先 + 双 runner 运行模型 + 可视 HUD + 影子无头比对**。

### 4.1 为什么不以真实输入回放为主

直接以 `MainScene + InputHandler + pointer/keyboard` 作为所有测试的主驱动路径，虽然最贴近真实输入，但会引入以下问题：

- 依赖像素坐标、相机、帧时序，脚本脆弱。
- 场景搭建成本高，执行速度慢。
- 排障时容易被输入细节噪音掩盖真正的业务问题。

因此，真实输入回放只适合作为少量输入/渲染冒烟测试，而不适合作为 simulation 主回归集的核心。

### 4.2 推荐方案的核心思想

把每个测试场景定义成一份业务脚本：

`初始化场景 -> 模拟操作 -> 等待条件 -> 中间检查/最终断言`

同一份脚本接到两种运行器：

1. `HeadlessScenarioRunner`
   - 不启动 Phaser 渲染。
   - 直接驱动 `World / commandQueue / tickRunner`。
   - 适合本地快速回归和 CI。

2. `VisualScenarioRunner`
   - 启动真实 `MainScene` 与渲染链路。
   - 执行同一份场景脚本。
   - 显示真实游戏画面与测试 HUD。
   - 同时挂一个 `shadow headless runner` 做对照。

这种设计兼顾了：

- 自动化稳定性
- 人工验收可见性
- 脚本一致性
- 问题定位效率

---

## 5. 架构分层

建议将测试系统拆成以下五层。

### 5.1 Scenario Spec

职责：描述单个业务测试场景。  
内容包括：

- 场景名称
- 场景说明
- 业务关注点
- `setup`
- `script`
- `expect`
- 给测试 HUD 展示的可读文案

约束：

- 只表达“要发生什么”，不直接持有世界对象。
- 不能把实现逻辑散落进每个场景文件。

### 5.2 Scenario DSL

职责：为场景提供统一的业务级步骤模型。  
第一阶段建议支持三类步骤：

- `Action`
- `WaitFor`
- `Assert`

这些步骤必须同时满足：

- 机器可执行
- 人类可读
- 可被 HUD 展示

### 5.3 Scenario Harness

职责：统一搭建测试世界和推进 simulation。  
它是无头与可视模式“同源”的核心。

能力包括：

- 创建 `World`
- 创建测试地图
- 注册 defs / commands / systems
- 推进 tick
- 读取事件缓冲与快照
- 提供对象查询与状态摘要
- 生成 checkpoint snapshot 供 diff 使用

约束：

- Harness 只负责测试运行时能力，不负责定义业务场景。

### 5.4 Scenario Driver

职责：执行 DSL 中的业务动作。  
例如：

- `spawnPawn`
- `placeTree`
- `placeFood`
- `createStockpile`
- `placeBlueprint`
- `designateCut`
- `advanceTicksUntil`

约束：

- 驱动逻辑优先复用现有 command / world / system API。
- 不发明第二套 simulation 规则。
- 不在 headless 和 visual 模式分别维护两套动作实现。

### 5.5 Scenario Reporter UI

职责：只在可视模式存在，实时展示场景执行状态。  
内容包括：

- 当前测试名
- 当前步骤
- 当前等待条件
- 最近事件
- 双 runner 队列状态
- 分歧摘要

约束：

- Reporter 负责“展示”，不参与测试业务判断。

---

## 6. 场景 DSL 设计

### 6.1 基本模型

每个场景由四个部分组成：

1. `setup`
   - 搭建初始世界状态。
2. `script`
   - 模拟玩家操作与系统推进。
3. `expect`
   - 最终验收结果。
4. `report`
   - 给人工测试者看的观察说明。

### 6.2 Step 类型

#### Action

表示“主动做一件事”。

示例：

- `生成 1 个 pawn`
- `在 (10, 8) 放置树`
- `创建 stockpile 区域`
- `下达砍树指令`

每个 `Action` 需要同时包含：

- 步骤标题
- 业务说明
- 实际执行函数
- 可选的预期可见反馈描述

#### WaitFor

表示“等待世界进入某种状态”。  
这是场景测试的关键，因为多数 simulation 场景都依赖 tick 推进和异步完成。

示例：

- `等待 pawn 接到砍树工作`
- `等待 pawn 开始移动`
- `等待木材进入 stockpile`
- `等待 pawn 完成进食`

每个 `WaitFor` 需要包含：

- 步骤标题
- 业务说明
- 条件函数
- 最大等待 tick
- 超时时的失败说明

#### Assert

表示中间或最终断言。

示例：

- `树已被移除`
- `蓝图已转为建筑`
- `pawn.food >= 60`
- `木材堆位于 stockpile 内`

每个 `Assert` 需要包含：

- 步骤标题
- 断言说明
- 断言函数
- 失败时的上下文描述

### 6.3 业务原语要求

场景步骤文案必须用业务语言表达，适合直接展示在 HUD 中。  
例如：

- `初始化场景：放置树`
- `模拟操作：下达砍树指令`
- `等待结果：小人前往树旁`
- `期待结果：树被砍倒并生成木材`

不应退化为内部实现术语，如 `enqueueCommand`、`executeTick`、`readObjectPool`。

---

## 7. 统一运行模型

### 7.1 HeadlessScenarioRunner

职责：

- 加载场景
- 执行 setup
- 执行脚本步骤
- 在 `WaitFor` 中推进 tick
- 运行断言
- 输出日志、失败原因与快照摘要

使用场景：

- 本地开发回归
- CI
- bug 修复验证

优点：

- 快
- 稳
- 易并行

### 7.2 VisualScenarioRunner

职责：

- 启动真实 `MainScene`
- 执行同一份场景脚本
- 渲染世界变化
- 挂载 `Scenario HUD`
- 与 shadow headless runner 协同输出对比信息

使用场景：

- 人工验收
- 逻辑/画面一致性检查
- 复杂问题复盘

### 7.3 Focused Debug 模式

除了批量回归与可视验收，还建议支持“聚焦调试”模式：

- 只运行单个 scenario
- 可调慢执行速度
- 可从指定步骤开始
- 可在出现分歧时继续观察后续步骤

这类模式主要服务于开发者排障，而不是 CI。

---

## 8. Shadow Headless Runner 与分歧检测

### 8.1 目标

在可视模式运行真实场景的同时，后台同步运行一个无头镜像。  
这不是为了替代业务断言，而是为了更快发现“真实运行环境与无头回归结果不一致”的问题。

### 8.2 为什么不做逐帧硬锁步

可视模式包含 Phaser 帧循环、渲染插值、UI 更新；无头模式没有这些因素。  
如果按每帧或每个渲染周期强制对齐，会产生大量噪音。

因此推荐采用：

- **同脚本、双引擎**
- **按 checkpoint 对比**

### 8.3 Checkpoint 策略

推荐在以下时机做 checkpoint diff：

1. 每个步骤完成后
2. `WaitFor` 期间每隔固定 tick 数
3. 发生超时或失败时

第一阶段建议使用可配置的 tick 间隔，如每 `5` 或 `10` tick。

### 8.4 对比内容

只比较 simulation snapshot，不比较 render snapshot。  
建议比较：

- `world.tick`
- 关键对象列表与位置
- designation 状态
- pawn 的 job / toil / needs / inventory
- blueprint 与 materialsDelivered
- 物品堆状态
- 最近事件摘要

### 8.5 分歧呈现方式

可视 HUD 应并排显示两个 runner 的步骤队列：

- 左列：`Visual Runner`
- 右列：`Shadow Headless Runner`

一旦分歧出现，立即在 HUD 中提示，但默认不强制中断执行。  
这样测试者可以第一时间发现问题，同时继续观察后续结果。

建议分为两类级别：

- `warning`
  - 非关键差异
  - 允许继续执行
- `error`
  - 核心 simulation 差异
  - 标记步骤失败，但允许脚本继续跑完，以便看到完整轨迹

### 8.6 分歧报告应包含的信息

- 首次分歧步骤
- 首次分歧 tick
- 分歧字段
- visual 值
- headless 值
- 最近事件差异摘要

---

## 9. 测试信息 HUD 设计

建议将可视模式中的测试 HUD 分为四个区域。

### 9.1 左列：Visual Runner 队列

显示当前可视环境的步骤执行队列：

- `pending`
- `running`
- `passed`
- `failed`

### 9.2 右列：Shadow Headless Runner 队列

显示同一场景在无头镜像中的步骤队列状态。  
测试者可以直接观察两边是否在相同步骤推进。

### 9.3 中央状态条

显示当前重点观察信息：

- 场景名
- 当前步骤
- 当前等待条件
- 当前 tick
- 最近事件摘要
- 建议关注对象

例如：

- `当前步骤：等待 pawn 接到砍树工作`
- `请关注：树上的 designation 与 pawn 是否开始移动`

### 9.4 分歧面板

当出现 checkpoint 差异时，高亮显示：

- 首次分歧步骤
- 首次分歧 tick
- 分歧字段
- 两边当前值
- 最近事件差异

这块面板应作为长期常驻区域，而不是失败后弹一次临时 toast。

---

## 10. 第一批场景范围

第一阶段建议以 4 条高价值业务场景作为主干。

### 10.1 砍树

验证链路：

- 下达砍树指令
- designation 成功生成
- pawn 接到工作
- pawn 移动到目标
- work 完成
- 树被移除
- 生成木材

价值：

- 覆盖 command -> designation -> AI -> work -> 掉落物

### 10.2 搬运进 Stockpile

验证链路：

- 创建 stockpile
- 生成地面物品
- pawn 接到搬运工作
- 拾取物品
- 前往 stockpile
- 放置并堆叠

价值：

- 覆盖 item placement、AI 搬运、stockpile 容量与堆叠逻辑

### 10.3 建造蓝图

验证链路：

- 放置蓝图
- 材料存在
- pawn 搬运材料
- deliver 到蓝图
- 开始施工
- 工地完成并转为建筑

价值：

- 覆盖 construction、deliver、work、建筑落地

### 10.4 进食

验证链路：

- 设置 pawn 饥饿
- 地图上有可食物品
- pawn 选择进食工作
- 拾取食物
- 等待进食
- 饱食度恢复

价值：

- 覆盖 needs、job selection、pickup、wait、consume

---

## 11. 目录与代码组织建议

建议新增如下结构：

```text
src/testing/
  scenario-harness/
  scenario-dsl/
  scenario-actions/
  scenarios/
  visual-runner/
```

### 11.1 `src/testing/scenario-harness/`

职责：

- 世界搭建
- defs / commands / systems 注册
- tick 推进
- 快照生成
- checkpoint diff
- 事件收集

### 11.2 `src/testing/scenario-dsl/`

职责：

- Step 类型定义
- 场景定义接口
- `Action / WaitFor / Assert` 的构造器

### 11.3 `src/testing/scenario-actions/`

职责：

- 封装复用型业务动作
- 保持场景文件简洁

### 11.4 `src/testing/scenarios/`

职责：

- 存放真正的业务场景文件
- 每个文件表达一个清晰业务案例

示例：

- `woodcutting.scenario.ts`
- `stockpile-haul.scenario.ts`
- `blueprint-construction.scenario.ts`
- `eating.scenario.ts`

### 11.5 `src/testing/visual-runner/`

职责：

- 可视运行壳
- HUD
- shadow runner 对照展示

---

## 12. 运行流程设计

建议固定为三种运行入口：

### 12.1 Headless Regression

用途：

- 本地快速回归
- CI

特点：

- 跑全部或指定 scenario
- 不启动渲染
- 输出步骤日志与失败摘要

### 12.2 Visual Acceptance

用途：

- 人工验收
- 真实画面检查

特点：

- 启动真实游戏画面
- 自动执行脚本
- 同步显示双 runner 队列和分歧信息

### 12.3 Focused Debug

用途：

- 单场景排障
- 慢速回放
- 观察分歧点

特点：

- 允许只跑一个 scenario
- 允许控制速度或从特定步骤开始

---

## 13. 失败模型

建议将测试失败分成三类。

### 13.1 Scenario Failure

业务断言不成立。  
例如：

- 树未消失
- 木材未进入 stockpile
- 蓝图未转建筑
- 饱食度未恢复

### 13.2 Timeout Failure

`WaitFor` 在规定 tick 内未达成。  
这类失败通常意味着流程卡死，应明确显示：

- 卡在哪个步骤
- 等待什么条件
- 最近发生了哪些事件

### 13.3 Divergence Warning / Error

可视 runner 与 shadow headless runner 在 checkpoint 上不一致。  
这类失败不是最终业务断言的替代，而是额外的健康信号。

---

## 14. 第一阶段实施顺序

建议按以下顺序落地。

### 14.1 先建立 ScenarioHarness

先解决“怎么统一搭世界、跑 tick、读状态”的基础问题。

### 14.2 再建立最小 DSL

只支持第一批场景需要的关键原语，不追求完备。

### 14.3 先完成 HeadlessRunner

优先让场景测试先能跑起来、先能稳定回归。

### 14.4 用“砍树”打通第一条端到端链路

这是最适合验证体系设计是否合理的第一条场景。

### 14.5 再补“搬运进 stockpile”与“进食”

这两条补上后，能显著覆盖 item/AI/needs。

### 14.6 再补“建造蓝图”

这是第一阶段最复杂的业务链路，应在前几条稳定后再接入。

### 14.7 最后接入 VisualRunner、HUD 与 Shadow Runner

原因：

- 可视化层对核心场景能力是增强，不是前置条件。
- 若先做 HUD，容易把大量时间花在展示层，而不是测试主模型。

---

## 15. 与现有测试体系的关系

当前 `vitest.config.ts` 以 `jsdom` 为主，更偏 UI 测试。  
本次设计不推翻现有 UI 测试基础设施，而是在其旁边增加 simulation 场景测试能力。

建议长期形成三层测试结构：

1. `UI 层测试`
   - selector / reducer / 组件
2. `Simulation 场景测试`
   - 本设计的主角
3. `少量输入/渲染冒烟测试`
   - 保护真实 `MainScene / InputHandler / RenderSync` 主链路

这三层各自解决不同风险，不应互相替代。

---

## 16. 团队约束建议

为了让这套体系长期有效，建议形成以下约束：

1. 新增或修改 simulation 规则时，优先补 scenario，而不是只补局部单测。
2. 每个高风险 bug 修复，至少附带一个可复现该问题的 scenario 或子步骤。
3. 所有 scenario 的步骤文案必须业务可读，可直接显示给测试者。
4. 可视模式中的 HUD 与 headless 日志应长期保持相同语义，避免两套描述体系。

---

## 17. 成功标准

第一阶段完成后，应能达到以下结果：

1. 4 条核心场景在无头模式下可稳定回归。
2. 同一批场景可在可视模式下自动运行，无需人工输入。
3. 可视模式中测试者能实时看到：
   - 当前步骤
   - 当前等待条件
   - 双 runner 队列状态
   - 分歧提示
4. 当真实环境与无头环境分叉时，能明确定位：
   - 哪一步开始分歧
   - 哪个 tick 首次分歧
   - 哪个核心字段发生差异

如果这些条件达成，这套体系就不仅是“自动化测试工具”，而是项目 simulation 行为的统一验收与诊断基础设施。
