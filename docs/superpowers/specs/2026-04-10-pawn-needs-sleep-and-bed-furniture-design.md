# 小人数值、睡眠与床铺家具设计

**日期：** 2026-04-10  
**主题：** 在不改变现有时间尺度和架构分层的前提下，为 `Twist-v1` 设计一套更合理的小人需求机制，覆盖饱食度、疲倦、睡眠、地铺、床位归属、饥饿扣血、木床建造与个体特质。

---

## 1. 背景与问题

当前项目已经具备了小人生存模拟的基础骨架：

- [`src/features/pawn/pawn.types.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/pawn/pawn.types.ts) 中已有 `food/rest/joy/mood` 四项基础需求。
- [`src/features/pawn/pawn.systems.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/pawn/pawn.systems.ts) 中已有基础的需求衰减系统。
- [`src/features/ai/job-selector.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/ai/job-selector.ts) 中已经实现了“饿了会找食物”的候选工作生成逻辑。
- [`src/features/ai/toil-executor.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/ai/toil-executor.ts) 中已经实现了严重饥饿时打断当前工作的清理流程。
- [`src/defs/jobs.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/defs/jobs.ts) 中已经预留了 `job_sleep`。
- [`src/defs/buildings.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/defs/buildings.ts) 中已经定义了 `bed_wood`。
- 建造流程已经通过 [`src/features/construction/construction.commands.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/construction/construction.commands.ts) 和 [`src/features/construction/construction.system.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/construction/construction.system.ts) 打通了“蓝图 -> 运料 -> 施工 -> 成品建筑”的主链。

但这些能力目前还没有组成一个完整、可信的生存闭环：

- `food/rest` 还是按固定常量线性下降，没有和一天节奏、睡眠质量、个体差异挂钩。
- `rest` 只有衰减，没有真正的“睡觉行为”和“恢复机制”。
- 床虽然已经存在于静态定义里，但运行时建筑对象还没有床位归属、当前占用、床用途等数据。
- `food = 0` 还不会持续扣血，也缺少明确的饥饿负面情绪。
- `mood` 仍是简单的需求平均值，不适合表达“睡在地上”“长期饥饿”“拥有自己的床”等状态。
- 家具还没有正式接入玩家可用的建造流程，导致床的玩法价值无法被真正体验。

用户目标不是单纯把几个常量调大调小，而是让小人在当前项目架构下表现出更合理的生活节奏：

- 一天大约两餐
- 到夜里该睡觉时已经明显疲倦
- 没有床时可以地铺，但效果差、心情差
- 有床之后会优先认领并长期使用自己的床
- 饱食度见底会掉血并影响心情
- 后续可以很自然地接入小人的随机属性和特质系统

因此，本次设计的重点是：**在复用现有 feature 架构和建造主链的前提下，把现有零散能力连接成完整机制，而不是重起一套新系统。**

---

## 2. 设计目标

### 2.1 主要目标

1. 保持当前时间尺度不变：
   - `100 tick = 1 小时`
   - `2400 tick = 1 天`
2. 让 `food/rest` 的变化更符合一天生活节奏，而不是纯线性消耗常量。
3. 让“进食”和“睡觉”都继续走现有 `job-selector + toil` 路线，不发明第二套行为系统。
4. 让床铺作为家具复用现有 `building + construction` 体系落地，而不是增加新的对象种类。
5. 让关键阈值都支持 Pawn 个体差异，为后续特质系统预留正式扩展位。
6. 先把 `木床` 作为第一件家具正式接入游戏流程。
7. 后续玩家可以通过“选中床后的信息面板”修改床位归属和用途。
8. 先预制 3 个简单特质，并分配给项目里现有的 3 个起始 Pawn。

### 2.2 非目标

- 本阶段不做完整房间舒适度系统。
- 本阶段不做桌椅进食加成。
- 本阶段不做完整的病床、囚犯床玩法，只需要在数据和命令层预留用途字段。
- 本阶段不引入新的 `ObjectKind.Furniture`。
- 本阶段不重做整个 schedule 系统，只在现有 schedule 之上做评分修正。

---

## 3. 需要遵守的现有架构约束

这份设计必须符合当前项目已有的设计范式，避免重复造轮子。

### 3.1 继续复用当前启动与注册方式

[`src/main.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/main.ts) 已经把默认 command 和 system 注册统一委托给 `bootstrap/default-registrations.ts`。因此新增需求相关 system、睡眠 job、床位命令时，应该继续沿用同一注册入口，而不是额外增加平行的启动链路。

### 3.2 继续复用当前建造主链

床和家具必须继续走：

- `place_blueprint`
- 运料
- 施工
- 生成最终 `Building`

也就是说，`木床` 不是“特殊家具系统”的入口，而是“现有建造体系中的第一件正式家具”。

### 3.3 继续复用当前 AI 候选评分范式

当前 AI 的主流程是：

- 收集候选工作
- 为候选工作打分
- 如果有目标则先预约
- 分配 Job
- 由 Toil 执行

因此：

- “找吃的”继续是一个候选工作
- “找地方睡觉”也必须变成一个候选工作
- 不能把睡眠写成 `needDecaySystem()` 里的隐式状态修改

### 3.4 继续复用当前 Building 可选组件范式

[`src/features/building/building.types.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/building/building.types.ts) 已经采用“基础 Building + 可选子组件”的模式，例如：

- `power`
- `storage`
- `interaction`

家具和床也应沿用同样模式：

- `Building` 仍是最终对象
- 家具能力作为可选组件附着在 `Building` 上
- 床位数据作为 bed 子组件存在

而不是另外发明一套 `Furniture` 对象层。

---

## 4. 推荐总体方案

推荐采用“**轻量家具扩展 + 需求驱动 AI**”的组合方案：

- `Building` 仍然是所有建成结构和家具的统一运行时对象。
- `Pawn` 扩展个体化需求参数、thought 列表和 traits。
- 饥饿和睡眠都继续走 Job 候选路线。
- 床位数据作为 `Building` 的可选 `bed` 组件。
- `木床` 作为第一件家具，通过现有建造链正式接入游戏。

该方案的优点是：

- 最大限度复用现有代码结构
- 不打破 `feature-based` 分层
- 不额外引入平行系统
- 后续扩展桌子、椅子、病床、囚犯床和特质都比较顺

---

## 5. 时间模型与目标生活节奏

[`src/core/clock.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/core/clock.ts) 当前定义：

- `TICKS_PER_HOUR = 100`
- `TICKS_PER_DAY = 2400`

本设计保持该时间尺度不变，并围绕它重做日常需求变化。

### 5.1 饥饿节奏目标

目标体验：

- 在正常活动下，小人每天大约会产生 2 次稳定进食需求。
- 小人不会刚吃完一会儿就再去找吃的。
- 进入严重饥饿区后，进食优先级要明显压过普通劳动。

换算为设计意图：

- 从满饱食到主动觅食区，大约应落在 10 到 12 小时左右。
- 饱食度见底是危险状态，不应成为日常节奏的一部分。

### 5.2 疲倦节奏目标

目标体验：

- 在白天长时间活动后，小人应在夜间睡眠时段开始前或开始时已经明显疲倦。
- 正常在床上睡一晚，能恢复到足够第二天继续工作。
- 地铺也能恢复，但明显比床差。

### 5.3 与日程 schedule 的关系

[`src/features/pawn/pawn.factory.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/pawn/pawn.factory.ts) 当前默认 schedule 为：

- `0-5` 睡觉
- `6-21` 自由活动
- `22-23` 娱乐

本设计不推翻这套安排，而是把 schedule 作为“睡眠评分修正项”：

- 当前时段属于 `Sleep` 时，睡眠候选额外加分
- 当前时段属于 `Joy` 时，若不严重困倦则不强行睡觉
- 真正极端缺觉时，需求仍可压过 schedule

这样可以保留现有架构中“schedule 只是引导，而不是绝对脚本”的设计风格。

---

## 6. Pawn 数据结构设计

### 6.1 needsProfile：小人的个体化需求参数

建议在 `Pawn` 上新增 `needsProfile`，用于承载所有与个体差异相关的关键数值。

建议结构：

```ts
needsProfile: {
  foodDecayPerTick: number;
  restDecayPerTick: number;
  joyDecayPerTick: number;

  hungerSeekThreshold: number;
  hungerCriticalThreshold: number;
  starvationDamageInterval: number;
  starvationDamageAmount: number;

  sleepSeekThreshold: number;
  sleepCriticalThreshold: number;
  wakeTargetRest: number;

  bedRestGainPerTick: number;
  floorRestGainPerTick: number;

  floorSleepMoodPenalty: number;
  mealTargetFood: number;
}
```

设计目的：

- 所有关键阈值都从 Pawn 自身读取，而不是写死在 system 常量里。
- 后续特质、随机属性、伤病、药物都可以通过修改 `needsProfile` 影响行为。
- AI 和需求系统不直接依赖 trait 细节，只依赖最终 profile 结果。

### 6.2 traits：小人的特质列表

建议在 `Pawn` 上新增 `traits`：

```ts
traits: Array<{
  traitId: string;
  label: string;
  description: string;
}>;
```

本阶段 traits 的职责不要过重。推荐做法是：

- 在 Pawn 创建时应用 trait 修正
- trait 主要影响 `needsProfile`
- 避免在 AI 中散落大量 `if (pawn has trait X)` 分支

这样可以保持系统规则集中，避免未来 trait 爆炸后难以维护。

### 6.3 thoughts：短中期情绪修正层

建议在 `Pawn` 上新增 `thoughts`：

```ts
thoughts: Array<{
  type: string;
  moodOffset: number;
  remainingTicks: number;
  sourceId?: string;
}>;
```

这是为了解决当前 `mood` 过于扁平的问题。很多体验不是永久人格，也不是原始 needs，而是有持续时间的短期状态，例如：

- 睡在地上
- 正在挨饿
- 严重缺觉
- 睡在自己的床上

这些都适合放到 `thoughts`，而不是继续硬塞进 `food/rest/joy` 权重中。

### 6.4 不新增长期 Sleep 组件

本设计不推荐给 Pawn 再增加一整套长期 `sleep` 组件。原因是：

- 当前系统已经有 `ai.currentJob`
- 当前系统已经有 `toil` 执行链
- 睡觉本身就应该是一个 Job

如果后续 UI 或渲染确实需要轻量状态，可以增加派生字段，比如：

```ts
status?: {
  sleepingSurface?: 'bed' | 'floor';
}
```

但核心行为仍应由 Job 和 Toil 驱动。

---

## 7. 新的数值变化机制

### 7.1 food：饱食度

`food` 继续保留 `0-100` 标尺，但语义改为下面这几个区间：

- `food >= 65`：正常
- `35 <= food < 65`：有点饿
- `15 <= food < 35`：主动觅食
- `0 < food < 15`：紧急饥饿
- `food = 0`：饥饿伤害

行为含义：

- `food < hungerSeekThreshold` 时会生成进食候选
- `food < hungerCriticalThreshold` 时可打断大多数普通工作
- `food = 0` 时开始持续扣血

### 7.2 rest：疲倦度

`rest` 继续保留 `0-100` 标尺，建议语义区间为：

- `rest >= 70`：精神正常
- `40 <= rest < 70`：开始疲倦
- `20 <= rest < 40`：主动找地方睡觉
- `rest < 20`：重度疲倦

行为含义：

- `rest < sleepSeekThreshold` 时生成睡眠候选
- `rest < sleepCriticalThreshold` 时可打断大多数普通工作
- 夜里 schedule 为 `Sleep` 时额外提高睡眠候选分数

### 7.3 joy：娱乐值

`joy` 本阶段不是核心目标，建议继续保留现有慢速衰减，但仍参与基础心情计算。暂时不新增独立娱乐行为链。

### 7.4 mood：心情

建议把当前的 `mood` 计算方式升级为“两层模型”：

1. `needsMoodBase`
2. `thoughtMoodDelta`

最终：

```ts
mood = clamp100(needsMoodBase + activeThoughtSum)
```

本阶段至少支持这些 thought：

- `Hungry`
- `Starving`
- `Tired`
- `Exhausted`
- `SleptOnGround`
- `SleptInBed`
- `SleptInOwnBed`

这样以后加“吃了好饭”“睡在病床”“有漂亮房间”时，扩展路径会更自然。

---

## 8. 饥饿与进食机制

### 8.1 继续复用现有 eat-job

项目中已有：

- [`src/features/ai/jobs/eat-job.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/ai/jobs/eat-job.ts)
- [`src/features/ai/toil-handlers/wait.handler.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/ai/toil-handlers/wait.handler.ts)

因此本设计不重写进食链，而是继续沿用：

- `GoTo`
- `PickUp`
- `Wait`

这条已有主链只需要升级候选评分与阈值来源。

### 8.2 进食候选评分规则

`findFoodJob()` 建议扩展为综合以下因素打分：

- 饥饿紧急程度
- 食物距离
- 食物营养值与当前缺口的匹配度
- 当前时间是否接近日常用餐节点

这样可以让“日常两餐”和“紧急找吃的”共用一套规则，而不是一套固定阈值加一套脚本时间表。

### 8.3 严重饥饿打断规则

[`src/features/ai/toil-executor.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/ai/toil-executor.ts) 当前已经有严重饥饿打断当前工作的逻辑。

本次改造应做的不是另起机制，而是把硬编码阈值替换成 Pawn 个体参数：

- 把当前固定的 `food < 10` 改为 `food < pawn.needsProfile.hungerCriticalThreshold`

这样可以直接复用现有 `cleanupProtocol()` 与 Job 中断逻辑。

### 8.4 food = 0 的饥饿伤害

饥饿见底后的扣血属于“生理后果”，不属于 AI 本身，因此建议放在 `features/pawn` 层处理，而不是塞进 AI job 或 toil handler。

推荐规则：

- 当 `food` 归零时，开始累计饥饿伤害计时
- 每经过 `starvationDamageInterval` tick 扣一次 `starvationDamageAmount`
- 同时添加或刷新 `Starving` thought
- 只要 `food > 0`，立即停止饥饿伤害

这样可以保持职责清晰：

- AI 负责“找吃的”
- Pawn 系统负责“没吃到会怎样”

---

## 9. 睡眠机制

### 9.1 睡眠必须是一个真实 Job

`job_sleep` 已经在 [`src/defs/jobs.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/defs/jobs.ts) 中预留，因此建议新增：

- `createSleepJob()`
- 睡眠候选生成逻辑
- 睡眠执行 Toil

原因：

- 能与当前 `job-selector` 完全兼容
- 能复用 reservation
- 能复用 cleanup 和中断流程
- 能统一处理“床铺睡眠”和“地铺睡眠”

### 9.2 睡眠候选评分

睡眠候选应综合以下因素：

- 当前 `rest` 距离 `sleepSeekThreshold` 有多远
- 当前 schedule 是否处于 `Sleep` 时段
- 当前是否低于 `sleepCriticalThreshold`
- 睡眠目标是“自己的床 / 空床 / 地铺”哪一种

推荐目标优先级固定为：

1. 自己的床
2. 可认领的空床
3. 地铺

这条优先级既体现在目标选择里，也体现在评分 bonus 里。

### 9.3 醒来规则

本设计不要求小人睡到某个死板整点，而是推荐按恢复目标自然醒：

- `rest >= wakeTargetRest`
- 或被中断
- 或目标失效

这样更符合当前项目偏模拟而非脚本的行为风格。

### 9.4 地铺睡眠

地铺不需要创建新的地图对象。

推荐方式：

- 睡眠 Job 直接选择一个地面格子作为目标
- 执行睡眠时标记本次睡眠表面为 `floor`
- 恢复速度使用 `floorRestGainPerTick`
- 睡醒后添加 `SleptOnGround` thought

这样可以用最低成本实现“没床也能睡”，而不需要额外的床垫或地铺对象系统。

---

## 10. 床位归属与占用规则

### 10.1 已确认的用户规则

用户已经明确确认：

1. 小人需要睡觉时优先去自己的床
2. 如果没有自己的床，就优先找空床并占据为自己的床
3. 如果没有空床，就随便找个地方睡觉

因此本设计必须直接落实这一顺序，而不是做成可选模式。

### 10.2 床的运行时状态

建议给 `Building` 增加可选 `bed` 组件：

```ts
bed?: {
  ownerPawnId?: ObjectId;
  occupantPawnId?: ObjectId;
  role: 'public' | 'owned' | 'medical' | 'prisoner';
  autoAssignable: boolean;
  restRateMultiplier: number;
  moodBonus: number;
}
```

字段含义：

- `ownerPawnId`：长期归属人
- `occupantPawnId`：当前睡在这张床上的小人
- `role`：玩家设置的床用途
- `autoAssignable`：这张床是否允许被小人自动认领
- `restRateMultiplier`：这张床的恢复效率倍率
- `moodBonus`：睡醒时的正向情绪加成

### 10.3 归属与占用必须分开

床位系统里最容易出问题的点，就是把“归属”和“占用”混在一起。因此必须明确区分：

- `ownerPawnId` 是长期关系
- `occupantPawnId` 是当前状态

这样才能避免未来出现这些问题：

- 有人临时在公共床上睡一觉，就永久抢走所有权
- 医疗床因为被人占用而误变成私人床
- UI 无法区分“这是谁的床”和“现在谁正在睡这里”

### 10.4 自动认领规则

推荐规则：

- 当 Pawn 因为睡眠需求而选择一张“未归属且允许自动认领”的空床时，在该次选择确定后立即把 `ownerPawnId` 写成该 Pawn。
- 若该床角色是 `public` 且仍允许自动认领，则在首次认领后切换为 `owned`。
- 玩家后续的手动设置优先级高于自动认领。

这正好匹配用户补充的行为期望：没有自己床时，小人会优先找空床，并把它变成自己的永久床铺。

### 10.5 预约与占用流程

床铺应继续复用现有 reservation 体系：

- 决定去某张床睡时，先预约该床对象
- 开始进入睡眠状态时，写入 `occupantPawnId`
- 睡醒、中断、强制清理时，清掉 `occupantPawnId` 并释放 reservation

这可以避免重新发明一套“多人抢床冲突系统”。

---

## 11. 家具设计

### 11.1 轻量家具层

家具不新增 `ObjectKind`，而是作为 `Building` 的一个可选能力层。

建议给 `Building` 增加：

```ts
category?: 'structure' | 'furniture';
furniture?: {
  usageType: 'bed' | 'table' | 'chair' | 'storage';
}
```

设计意图：

- 继续复用现有 `Building` 生命周期
- 用轻量标签表达“这是一件家具”
- 为后续桌子、椅子、柜子保留统一扩展口

### 11.2 BuildingDef 的静态扩展

建议给 `BuildingDef` 增加可选静态配置：

```ts
category?: 'structure' | 'furniture';
furnitureType?: 'bed' | 'table' | 'chair' | 'storage';
bedConfig?: {
  autoAssignable: boolean;
  restRateMultiplier: number;
  moodBonus: number;
}
```

这样和当前已有的这些字段风格一致：

- `interactionCellOffset`
- `powerConsumption`
- `storageConfig`

也就是说：**家具不是一个新的大系统，只是 `BuildingDef` 上新增几类可选配置。**

### 11.3 building.factory 的复用方式

[`src/features/building/building.factory.ts`](/C:/Users/yulu/Documents/V1/Twist-v1/src/features/building/building.factory.ts) 当前已经采用“读 Def -> 创建基础对象 -> 挂可选组件”的模式。

本次只需要继续沿用这一模式：

- 如果 Def 标记为家具，则挂 `category/furniture`
- 如果 Def 带 `bedConfig`，则再挂 `bed`

不需要额外增加“家具初始化系统”。

---

## 12. 木床作为第一件家具接入游戏流程

### 12.1 为什么先做木床

`bed_wood` 既已经存在于 Def 中，又直接承接用户最核心的睡眠玩法，因此非常适合作为第一件家具：

- 能验证家具扩展设计是否成立
- 能把“疲倦 -> 睡觉 -> 恢复 -> 心情”链路真正闭合
- 玩家价值明确

### 12.2 接入方式

`木床` 必须走现有建造主链，而不是独立生成：

1. 玩家在建造菜单选择 `bed_wood`
2. 下达 `place_blueprint`
3. 小人运送木材
4. 小人施工
5. 施工完成后由 `createBuilding()` 生成床对象
6. 床对象自动附带 `furniture` 和 `bed` 组件

这能最大限度复用当前 `construction` feature，而不是重复劳动。

### 12.3 UI 接入范围

本阶段只要求让建造菜单中能放置 `Wood Bed`。

不要求一次性重构整个建造 UI 分类体系，除非当前 UI 结构中成本非常低。优先级是先让木床能进入可玩闭环。

---

## 13. 玩家覆写床位归属与用途

用户已确认后续交互方式为：

- 选中床后，在右侧或对象信息面板中设置床位归属和用途

因此本设计应提前准备 command 层接口，而不是把 UI 直接写入世界对象。

建议预留命令：

- `assign_bed_owner`
- `clear_bed_owner`
- `set_bed_role`

这样后续 UI 只负责发命令，不负责直接改 `world`，与当前命令总线设计一致。

第一期 UI 不一定需要完整做完所有控件，但数据结构和命令入口应先设计正确。

---

## 14. 三个预制特质方案

用户要求先提供 3 个简单特质，并分配给当前项目里的 3 个起始 Pawn。这里建议不直接做随机 trait 生成，而是先做固定种子方案，用来验证个体化需求系统是否工作正常。

推荐特质如下：

### 14.1 贪吃（Glutton）

效果：

- `foodDecayPerTick` 略高
- `hungerSeekThreshold` 更高

表现：

- 更容易饿
- 更早去找食物

### 14.2 浅眠（Light Sleeper）

效果：

- `restDecayPerTick` 略高
- `sleepSeekThreshold` 更高
- `floorSleepMoodPenalty` 更重

表现：

- 更容易疲倦
- 更依赖床铺
- 睡地上的心情损失更明显

### 14.3 耐受（Hardy）

效果：

- `hungerCriticalThreshold` 更低
- `starvationDamageInterval` 更长或 `starvationDamageAmount` 更低
- `floorSleepMoodPenalty` 更轻

表现：

- 更能抗饿
- 更能忍受差的睡眠环境

这三个 trait 都尽量只通过 `needsProfile` 修正生效，不把逻辑散落到 AI 各处。

---

## 15. 各 feature 的职责归属

### 15.1 `features/pawn`

负责：

- `needsProfile`
- trait 修正应用
- need 衰减
- 饥饿伤害
- thought 更新
- mood 重算

理由：

- 这些都属于“小人自身状态随时间变化”的范畴

### 15.2 `features/ai`

负责：

- 睡眠候选生成
- 睡眠目标选择
- 新增 `sleep-job`
- 睡眠中断与回退

理由：

- 这些都属于“小人下一步该做什么”的范畴

### 15.3 `features/building`

负责：

- 家具运行时组件
- 床运行时组件
- 床相关查询辅助函数

理由：

- 床是家具的一种，而家具本质上仍是建成后的 `Building`

### 15.4 `features/construction`

负责：

- 继续使用现有建造主链
- 不额外创建床专用建造系统

理由：

- 木床只是第一件家具，不应该成为独立流程入口

### 15.5 `defs`

负责：

- 床的静态配置
- 家具类型标记
- 未来若需要正式 Def 化 trait，也可在此扩展

---

## 16. 推荐新增的查询与辅助函数

为了避免把查床、查归属、查空床等逻辑直接堆到 `job-selector.ts` 里，建议增加几个聚焦辅助函数。

### 16.1 `features/building/building.queries.ts`

建议新增：

- `getAllBeds(map)`
- `getBedByOwner(map, pawnId)`
- `findAvailableAutoAssignableBed(map)`
- `isBedAvailable(bed)`
- `isBedOwnedBy(bed, pawnId)`

### 16.2 `features/pawn`

建议新增：

- `applyTraitModifiers(pawn)`
- `recomputeMood(pawn)`
- `addOrRefreshThought(pawn, type, ...)`

### 16.3 `features/ai`

建议新增：

- `createSleepJob(...)`
- `findSleepTarget(pawn, map)`

这样可以在遵守现有模块边界的同时，避免把热点文件继续做大。

---

## 17. 分阶段落地顺序

为了降低风险，建议按下面顺序实现：

### 阶段 1：个体参数与心情基础层

- 增加 `needsProfile`
- 增加 `traits`
- 增加 `thoughts`
- 把现有需求衰减常量改为从 profile 读取
- 升级 `mood` 计算

### 阶段 2：饥饿后果

- 把进食阈值改为读取 profile
- 增加 `food = 0` 的饥饿伤害
- 增加饥饿相关 thought

### 阶段 3：睡眠行为

- 新增 `sleep-job`
- 新增睡眠候选评分
- 新增地铺睡眠
- 新增通过睡眠恢复 `rest`

### 阶段 4：床运行时支持

- 扩展 `BuildingDef`
- 扩展 `Building`
- 在 `building.factory` 中挂 bed 组件
- 增加床查询
- 完成床位归属和占用逻辑

### 阶段 5：木床建造接入

- 在建造菜单暴露 `bed_wood`
- 打通蓝图到成品床对象链路

### 阶段 6：玩家覆写床位

- 增加 `assign_bed_owner / clear_bed_owner / set_bed_role`
- 在对象信息面板上接入设置入口

### 阶段 7：特质验证

- 给 `Alice / Bob / Charlie` 分配 3 个预制 trait
- 验证相同环境下会表现出不同的吃饭和睡觉节奏

这个顺序的好处是：

- 每一步都能复用前一步成果
- 中途停止也能得到部分可玩的功能
- 风险最大的 UI 覆写放在后面，不阻塞核心生存机制

---

## 18. 风险与规避方案

### 18.1 风险：床逻辑分散在多个层里

如果床位归属、床位占用、玩家设置入口分别在 AI、UI、building 层随意写逻辑，会导致行为很快失控。

规避方式：

- 床状态只存于 `Building.bed`
- 床选择逻辑只在 AI
- 玩家修改只通过 command

### 18.2 风险：traits 变成到处散落的条件分支

如果 trait 直接渗透到 selector、handler、system 各处，会让扩展非常痛苦。

规避方式：

- trait 主要影响 `needsProfile`
- 系统逻辑统一读取 Pawn profile

### 18.3 风险：家具被做成第二套对象体系

如果为了床新建 `Furniture` 对象，会重复建设：

- construction
- query
- reservation
- save/load
- render

规避方式：

- 家具继续作为 `Building` 的可选扩展层

### 18.4 风险：mood 后续越来越难扩展

如果依然只保留简单平均值，未来每一种情绪状态都只能继续硬编码在 needs 权重里。

规避方式：

- 现在就引入轻量 thought 层

---

## 19. 成功标准

当该设计最终落地后，应能稳定满足以下结果：

1. 起始小人在正常游玩下，大致一天会主动进食两次。
2. 小人在当前 24 小时时间模型下，会在夜间睡眠时段前后自然变得疲倦。
3. 没有床的小人会：
   - 优先找空床
   - 找到后占据为自己的床
   - 实在没有床时地铺睡觉
4. `food = 0` 时会持续掉血，并显著降低心情。
5. `bed_wood` 能通过现有蓝图与施工主链建造出来。
6. 床铺能正确区分“归属人”和“当前占用者”。
7. 三个预制 trait 会让三个起始 Pawn 表现出可观测的生活节奏差异，而无需为每个 Pawn 特判单独 AI。

---

## 20. 最终建议

本轮推荐采用如下最终落地方向：

- 保持当前 `100 tick = 1 小时`、`2400 tick = 1 天` 不变
- 把需求阈值和变化率下沉到 Pawn 个体 `needsProfile`
- 继续复用现有 `eat-job` 和中断清理机制
- 将睡眠实现为新的标准 AI Job
- 将床位数据设计为 `Building` 的可选 `bed` 组件
- 将 `bed_wood` 作为第一件家具，通过现有 construction 主链接入游戏
- 为后续“选中床 -> 信息面板修改归属/用途”预留命令接口
- 给 3 个初始 Pawn 预制 3 个简单 traits，用于验证个体化数值机制

这套方案最符合 `Twist-v1` 目前的代码结构，因为它：

- 不重做时间系统
- 不重做建筑系统
- 不重做 AI 系统
- 不发明新的家具对象体系
- 尽可能复用已有 query、reservation、cleanup、construction 范式

也正因为如此，它既能解决当前“饱食度和疲倦明显不符合实际”的问题，又不会为后续功能扩展埋下新的结构负担。
