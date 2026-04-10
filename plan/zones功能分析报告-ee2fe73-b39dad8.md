# Zones 功能分析报告（`ee2fe73` → `b39dad8`）

## 报告范围

本报告聚焦 `ee2fe73..b39dad8` 这一段提交里新增和增强的 `zones` 相关能力，并把它们放回 Twist-v1 现有架构里统一理解。这里的 “zones” 不只是“玩家能画一个区域”，而是一整套跨越以下层次的能力：

- `features/zone`：区域意图分析、命令处理、查询接口
- `world/zone-manager`：区域数据结构、格子索引、配置归一化
- `adapter/input`：单点/拖拽创建、擦除、预览
- `adapter/render`：正式区域渲染与交互预览
- `features/ai`：围绕 `stockpile` 的自动搬运与安全丢弃
- `features/save`：区域配置的序列化和恢复
- `ui/*`：新 Preact UI 中的区域工具入口与状态桥接

这次改动的关键结果不是“多了一个 ZoneType”，而是把区域从一个较薄的地图附属数据，提升成了贯通输入、模拟、AI、渲染、存档和 UI 的正式业务能力。

## 1. 这个功能是怎么工作的

### 1.1 功能核心：从“画格子”升级为“区域分析 + 计划 + 执行”

这次新增的核心模块是 [`src/features/zone/zone.analysis.ts`](/E:/Me/Twist-v1/src/features/zone/zone.analysis.ts)。它把以前“收到一批格子后直接塞给 zone”这种较直接的写法，升级成了三段式流程：

1. `analyzeZoneCellPlacement()`：先分析玩家这次圈到的格子分别属于哪种状态
2. `buildZoneCellPlacementPlan()`：再根据分析结果生成真正的写入计划
3. `getNextZoneId()`：按当前世界中的最大 `zone_N` 现算下一个 ID，而不是依赖模块级计数器

对应代码入口：

- [`analyzeZoneCellPlacement()`](/E:/Me/Twist-v1/src/features/zone/zone.analysis.ts#L79)
- [`getNextZoneId()`](/E:/Me/Twist-v1/src/features/zone/zone.analysis.ts#L156)
- [`buildZoneCellPlacementPlan()`](/E:/Me/Twist-v1/src/features/zone/zone.analysis.ts#L183)

这一步把一次区域操作拆成了明确的业务语义：

- `empty`：空地，可以新写入
- `same-type`：已经是同类型区域，可以扩展或合并
- `other-type`：已经被别的类型区域占用，这次写入应视为无效
- `out-of-bounds`：越界格子，直接无效

最后形成的规则是：

- 如果命中的都是空地，就创建新区域
- 如果命中的是同类型单个区域，就扩展该区域
- 如果命中了多个同类型区域，就以字典序最小的 `zoneId` 为锚点，把多个区域合并
- 如果命中异类型区域或越界格子，这些格子不会进入有效写入集合

这就是这次 zones 逻辑最核心的工作方式：先分析，再规划，再执行，而不是“命令到了就硬改数据”。

### 1.2 命令层：创建、按格擦除、整区删除三种入口

`features/zone` 现在在命令层有三种操作：

- `zone_set_cells`：创建、扩展、合并区域
- `zone_remove_cells`：按格擦除区域
- `zone_delete`：整区删除

对应实现：

- [`zoneSetCellsHandler`](/E:/Me/Twist-v1/src/features/zone/zone.commands.ts#L51)
- [`zoneRemoveCellsHandler`](/E:/Me/Twist-v1/src/features/zone/zone.commands.ts#L161)
- [`zoneDeleteHandler`](/E:/Me/Twist-v1/src/features/zone/zone.commands.ts#L219)
- [`zoneCommandHandlers`](/E:/Me/Twist-v1/src/features/zone/zone.commands.ts#L256)

其中最重要的是 `zone_set_cells` 已经不再依赖“传入已有 `zoneId` 就扩展，否则新建”的旧思路，而是直接复用 `zone.analysis` 的计划结果。这样输入层只需要说“我想把这些格子设成某种 zoneType”，真正如何落地由领域层决定。

`zone_remove_cells` 则补上了非常关键的一块能力：玩家现在不需要整区删掉重画，而是可以像橡皮擦一样按格消减。一个区域如果被擦到空集合，会自动删除。

### 1.3 数据层：ZoneManager 从“遍历查找”升级为“索引型管理器”

[`src/world/zone-manager.ts`](/E:/Me/Twist-v1/src/world/zone-manager.ts) 是这次 zones 真正的底座升级点。

关键变化有四个：

1. `Zone` 的 `zoneType` 从宽松字符串变成正式 `ZoneType`
2. `config` 从松散对象升级为带类型语义的 `ZoneConfig`
3. 新增 `cellIndex`，把 “格子 -> zoneId” 做成 O(1) 索引
4. 新增批量 `addCells()` / `removeCells()`，让命令层和 AI 层都能稳定复用

对应实现：

- [`createDefaultZoneConfig()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L58)
- [`normalizeZoneConfig()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L90)
- [`ZoneManager`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L107)
- [`addCells()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L136)
- [`removeCells()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L181)
- [`getZoneAt()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L239)
- [`claimCell()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L258)

这意味着区域现在已经不是“地图上挂一个 zone 列表，谁用谁遍历”，而是被做成了正式的地图级子系统。

### 1.4 配置层：`stockpile` 有了可扩展配置模型

这次不是只加了 `ZoneType.Stockpile` 的显示名字，而是补了配置模型：

- `StockpileZoneConfig`
- `allowAllHaulable`
- `allowedDefIds`

这些定义在 [`src/world/zone-manager.ts`](/E:/Me/Twist-v1/src/world/zone-manager.ts) 顶部，说明 stockpile 已经被设计成“当前先支持全部可搬运物，后续再扩展过滤规则”的结构，而不是写死在 AI 里的一堆 if。

这层设计非常重要，因为它决定了 zone 后续扩展的主方式是：

- `ZoneType` 决定区域类别
- `ZoneConfig` 决定区域规则参数
- AI / 输入 / UI / 存档按统一配置模型协同

### 1.5 输入与预览：玩家现在能创建、拖拽批量创建、擦除并看到合法性预览

[`src/adapter/input/input-handler.ts`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts) 是玩家真正接触 zones 的入口。

关键点如下：

- 单格创建：[`handleZone()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L183)
- 框选创建：[`dragZoneCreate()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L400)
- 区域擦除：[`removeCellsFromZones()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L467)
- 预览更新：[`updateZonePreview()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L489)
- 输入层复用领域分析：[`analyzeZonePlacement()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L436)

这里最值得注意的一点是：输入层没有自己写一套“哪些格子能画、哪些格子冲突”的规则，而是直接调用 `analyzeZoneCellPlacement()`。这让“预览结果”和“实际执行结果”共享同一份领域规则，避免了 UI 预览说能画、命令执行又说不行的双标问题。

### 1.6 渲染层：区域从临时预览变成正式地图元素

之前区域更像是一种工具态概念，这次被真正绘制进正式地图渲染层。

关键实现：

- 正式区域渲染器：[`ZoneRenderer`](/E:/Me/Twist-v1/src/adapter/render/zone-renderer.ts#L39)
- 接入总渲染编排：[`RenderSync`](/E:/Me/Twist-v1/src/adapter/render/render-sync.ts#L44) / [`new ZoneRenderer(...)`](/E:/Me/Twist-v1/src/adapter/render/render-sync.ts#L59)
- 每帧刷新：[`zoneRenderer.update()`](/E:/Me/Twist-v1/src/adapter/render/render-sync.ts#L92)

`ZoneRenderer` 做了两件事：

- 把 zone 的格子以半透明填充 + 描边方式画到地图上
- 用 zone 的最左上角格作为锚点显示区域标签

同时，`world-preview` 里继续负责“玩家拖拽过程中”的临时预览，因此现在的区域视觉分成两层：

- 正式层：已提交的 zone
- 预览层：正在创建/擦除的 zonePreview

### 1.7 AI 层：`stockpile` 开始真正参与游戏流程

这次最有业务价值的部分，是 zones 终于不只停留在“可视化区域”，而是进入 AI 调度。

核心逻辑在 [`src/features/ai/job-selector.ts`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts)：

- [`gatherCandidates()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L129)
- [`createStockpileHaulCandidate()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L251)
- [`isItemInCompatibleStockpile()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L287)
- [`findBestStockpileDropCell()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L299)
- [`isItemAcceptedByStockpile()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L324)

新规则是：

- Pawn 在常规候选任务之外，会额外扫描“散落但可搬运的 item”
- 如果这个 item 还不在兼容的 `stockpile` 里，就尝试为它生成“搬运到存储区”的低优先级工作
- 目标格必须同时满足：
  - 该格属于 `ZoneType.Stockpile`
  - 该格可通行
  - 该格没有阻挡对象
  - 该格已有物品与当前 `defId` 兼容
  - 该区域配置允许此物品进入

其中“物品叠放兼容性”抽成了专门查询：

- [`isCellCompatibleForItemDef()`](/E:/Me/Twist-v1/src/features/item/item.queries.ts#L60)

而且 Toil 执行和清理协议也一起接上了 stockpile 规则：

- [`executeDrop()`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/drop.handler.ts#L15)
- [`findAlternateStockpileCell()`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/drop.handler.ts#L54)
- [`cleanupProtocol()`](/E:/Me/Twist-v1/src/features/ai/cleanup.ts#L34)
- [`canDropItemAt()`](/E:/Me/Twist-v1/src/features/ai/cleanup.ts#L131)

这意味着如果 Pawn 正准备把东西丢在一个不兼容的 stockpile 格里，系统会先尝试改投到别的合法格；如果工作中断了，清理协议在把物品重新掉到地面时，也会尽量找一个合法格，而不是随便扔。

### 1.8 存档层：区域配置不是临时态，而是持久业务数据

`zones` 现在已经进入存档主链路：

- [`serializeZone()`](/E:/Me/Twist-v1/src/features/save/save.commands.ts#L83)
- [`deserializeZone()`](/E:/Me/Twist-v1/src/features/save/save.commands.ts#L98)
- [`normalizeZoneConfig()`](/E:/Me/Twist-v1/src/features/save/save.commands.ts#L104)

这意味着：

- zone 的 `cells`
- zone 的 `zoneType`
- zone 的 `config`

都会跟地图一起保存和恢复，尤其是 `allowedDefIds` 这类 `Set` 结构在读取后会被规范化回来。也就是说，这次 zones 已经是正式世界状态，不是“开局临时画画看”的功能。

## 2. 它是怎么融入到之前已有的业务框架的

### 2.1 融入方式一：继续遵守原有的 Command Bus 入口

Twist-v1 原本的核心业务框架是“输入/UI 不直接改世界，而是发命令；世界在 tick 的 `COMMAND_PROCESSING` 阶段统一处理命令”。zones 这次完全沿用了这套结构，没有另起炉灶。

接入点：

- 在 [`main.ts`](/E:/Me/Twist-v1/src/main.ts#L348) 注册 `zoneCommandHandlers`

因此 zones 和建造、designation、pawn 命令的接入方式一致：

- 输入/UI 负责表达玩家意图
- `CommandBus` 负责统一入库
- `features/zone/*.commands.ts` 负责业务校验和状态修改

这让 zones 成为了“现有 feature 框架里的一个标准 feature”。

### 2.2 融入方式二：继续遵守 Simulation / Presentation 分离

这次 zones 的交互量很大，但仍然保持了项目的原有边界：

- `PresentationState` 存放当前工具、当前区域类型、上一次区域类型、预览态
- `World/GameMap/ZoneManager` 存放真正的 simulation 数据

相关状态定义在：

- [`PresentationState.activeZoneType`](/E:/Me/Twist-v1/src/presentation/presentation-state.ts#L113)
- [`PresentationState.lastZoneType`](/E:/Me/Twist-v1/src/presentation/presentation-state.ts#L115)
- [`PresentationState.zonePreview`](/E:/Me/Twist-v1/src/presentation/presentation-state.ts#L125)
- [`switchTool()`](/E:/Me/Twist-v1/src/presentation/presentation-state.ts#L148)

也就是说：

- 你现在选中了什么区域工具，是展示态
- 地图上哪些格子已经属于 stockpile，是世界态

这和项目原本“建造预览 / designation 预览放在 presentation，蓝图 / designation 本体放在 simulation”的思路完全一致。

### 2.3 融入方式三：复用地图级基础设施，而不是 feature 自带私有索引

zones 不是独立拥有一张自己的地图，而是嵌在 `GameMap` 下面，由 `map.zones` 管理。这样它天然能和现有系统耦合：

- 输入层通过 `map.zones.getZoneAt()` 判断格子是否在区域中
- AI 通过 `map.zones.getAll()` 扫描存储区
- 渲染层通过 `map.zones.getAll()` 画正式区域
- 存档层通过 `map.zones.getAll()` 持久化

这说明 zones 并没有破坏原有“GameMap 是地图级子系统容器”的架构，而是按现有方式往地图层继续挂接了一个更成熟的子系统。

### 2.4 融入方式四：接入新 UI 架构，而不是停留在旧 DOM 工具栏

这段提交中另一个大变化是引入了新的 Preact UI 外壳，而 zones 也被完整接了进去。

关键路径：

- UI 根挂载：[`mountUiApp()`](/E:/Me/Twist-v1/src/ui/app/app-root.tsx#L46)
- UI 壳子：[`AppShell`](/E:/Me/Twist-v1/src/ui/app/app-shell.tsx#L52)
- 区域工具定义：[`toolActions`](/E:/Me/Twist-v1/src/ui/domains/build/build.schemas.ts#L32)
- 区域按钮子项：[`zone_stockpile / zone_growing / zone_animal`](/E:/Me/Twist-v1/src/ui/domains/build/build.schemas.ts#L39)
- 工具栏组件：[`ToolModeBar`](/E:/Me/Twist-v1/src/ui/domains/build/components/tool-mode-bar.tsx)
- UI 意图发出：[`activateToolAction()`](/E:/Me/Twist-v1/src/ui/domains/build/build.intents.ts#L17)
- 端口落地：[`UiPorts.setTool()`](/E:/Me/Twist-v1/src/ui/kernel/ui-ports.ts#L35)
- 快照回读高亮：[`selectActiveToolId()`](/E:/Me/Twist-v1/src/ui/domains/build/build.selectors.ts#L50)

它的模式是：

1. UI 按钮选择 zone 子类型
2. `ports.setTool(...)` 修改 `PresentationState`
3. `snapshot-reader` 读取当前状态并生成快照
4. `build.selectors` 再把当前 zoneType 反解成具体高亮按钮

因此 zones 不仅融入旧业务框架，也融入了这次新建的 UI kernel 框架。

### 2.5 融入方式五：AI 仍遵守“候选工作 -> 分数 -> 预约 -> 执行”的老模式

stockpile 搬运不是开辟一个专门系统强制小人行动，而是接进现有 `jobSelectionSystem` 的候选收集流程中。也就是说，它遵循的还是项目原有工作调度范式：

1. 候选生成
2. 效用评分
3. 资源预约
4. job 分配
5. toil 执行

这点很关键，因为它说明 zones 的新增行为没有破坏 AI 框架，而是被包装成了 AI 能理解的一类新工作来源。

## 3. 用游戏内业务场景解释这些新类的关系，以及它们是怎么工作的

下面用四个场景来解释这批新类和模块的协作关系。

### 场景一：玩家拖一片“存储区”

玩家操作链路：

1. 新 UI 的区域下拉菜单里点“存储区”
2. `ToolModeBar` 触发 [`activateToolAction()`](/E:/Me/Twist-v1/src/ui/domains/build/build.intents.ts#L17)
3. `UiPorts.setTool()` 把 `presentation.activeTool = zone`、`activeZoneType = stockpile`、`lastZoneType = stockpile`
4. 玩家在地图上拖拽，`InputHandler` 持续更新 `dragRect`
5. [`updateZonePreview()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L489) 复用 `analyzeZoneCellPlacement()` 算出哪些格子合法、哪些冲突
6. `world-preview` 把合法格和非法格画成不同预览色
7. 鼠标抬起后，[`dragZoneCreate()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L400) 发出 `zone_set_cells`
8. [`zoneSetCellsHandler`](/E:/Me/Twist-v1/src/features/zone/zone.commands.ts#L51) 调用 `buildZoneCellPlacementPlan()`
9. `ZoneManager.add()` 或 `addCells()` 真正把格子写进地图
10. `ZoneRenderer` 在正式区域层把它画出来

这里的新类关系可以概括为：

- `ToolModeBar` / `UiPorts`：决定“你想画什么”
- `InputHandler`：决定“你这次圈了哪些格子”
- `zone.analysis`：决定“这些格子里哪些真能画、应该新建还是合并”
- `zone.commands`：决定“怎么把计划写入世界”
- `ZoneManager`：维护最终区域数据和格子归属
- `ZoneRenderer`：让结果长期可见

### 场景二：玩家在已有存储区上补画一笔，连接两个同类型区域

这是这次新逻辑最典型的“领域分析”场景。

假设地图上已有两个相邻但未连接的 `stockpile` 区域，玩家拖一条线把它们连起来。

发生的事不是“创建第三个区域”，而是：

1. `InputHandler` 把拖框里的格子交给 `analyzeZoneCellPlacement()`
2. 分析发现：
   - 一部分格子是空地
   - 一部分格子已经命中同类型区域 A
   - 另一部分格子命中同类型区域 B
3. `buildZoneCellPlacementPlan()` 选出字典序最小的 zoneId 作为锚点
4. 另一个同类型区域的格子会并入锚点区域
5. `ZoneManager.addCells()` 逐格 `claimCell()`，必要时把原区域清空并删除

这就是这批新类之间最重要的协作：

- `zone.analysis` 负责业务决策
- `zone.commands` 负责调度执行
- `ZoneManager.claimCell()` 负责真正完成格子归属迁移

所以这次的 zones 功能不是简单的“画色块”，而是支持区域合并语义。

### 场景三：玩家用取消工具擦掉存储区的一部分

这对应的是按格擦除能力。

链路如下：

1. 玩家切到 `Cancel`
2. `InputHandler.handleCancel()` 或 `dragCancel()` 会先调用 [`removeCellsFromZones()`](/E:/Me/Twist-v1/src/adapter/input/input-handler.ts#L467)
3. 它把命中的区域格打包成 `zone_remove_cells`
4. [`zoneRemoveCellsHandler`](/E:/Me/Twist-v1/src/features/zone/zone.commands.ts#L161) 把这些格子交给 `ZoneManager.removeCells()`
5. `ZoneManager` 更新 `cellIndex` 和每个 zone 的 `cells`
6. 如果某个 zone 被擦空，就自动删除
7. `ZoneRenderer` 的签名变化后，下帧自动重绘

这个场景能体现出两点：

- `Cancel` 工具现在已经把 zones 纳入了统一“擦除”语义，而不是只会取消 designation/blueprint
- `ZoneManager.removeCells()` 让区域从“整块对象”变成“可局部编辑的结构”

### 场景四：地图上有散落木头，小人自动把它搬进存储区

这是 zones 第一次真正进入 simulation 业务链路。

链路如下：

1. 地图上有 `haulable` 的 item，例如 `wood`
2. AI 在 [`gatherCandidates()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L129) 末尾调用 [`createStockpileHaulCandidate()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L251)
3. 它先检查该物品是否已经在兼容存储区里
4. 如果没有，就通过 [`findBestStockpileDropCell()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L299) 找最近合法存储格
5. 找到后，生成一个普通 haul job
6. Pawn 去拿物品，再去目标格执行 `Deliver` 或 `Drop`
7. 如果目标格后来变得不兼容，`executeDrop()` 会改投其他合法 stockpile 格
8. 如果工作中断，`cleanupProtocol()` 也会尽量找合法格重放物品

这个场景能解释几组类之间的关系：

- `ZoneManager` / `Zone`：提供“哪些格是 stockpile”的世界事实
- `job-selector`：把这个事实转成工作候选
- `item.queries`：提供同类堆叠兼容性判断
- `drop.handler` / `cleanup`：保证执行阶段不破坏 stockpile 规则

也就是说，zones 在这个场景里扮演的不是“视觉高亮”，而是“小人的物流规则”。

### 场景五：保存游戏后再读档，存储区和配置依然存在

链路如下：

1. 保存时，[`serializeZone()`](/E:/Me/Twist-v1/src/features/save/save.commands.ts#L83) 把 `Zone` 变成纯 JSON
2. `cells` 被转成数组，`config` 被递归序列化
3. 读档时，[`deserializeZone()`](/E:/Me/Twist-v1/src/features/save/save.commands.ts#L98) 恢复 `Zone`
4. `normalizeZoneConfig()` 把 stockpile 配置中的 `allowedDefIds` 等结构重新规范化
5. `map.zones.add(zone)` 重新建立区域和格子索引

这个场景说明 zones 已经具备“长期经营游戏”的数据语义，而不是一局内临时工具态。

## 4. 如果后续要拓展，从哪里开始

后续扩展建议按“最稳的切入点”来分，而不是直接去改大而全的输入文件或 AI 文件。

### 4.1 如果要扩展新的区域类型，先从 `ZoneType + 默认配置 + 规则读取点` 开始

推荐入口：

- [`src/world/zone-manager.ts`](/E:/Me/Twist-v1/src/world/zone-manager.ts)
- [`src/features/zone/zone.types.ts`](/E:/Me/Twist-v1/src/features/zone/zone.types.ts)
- [`src/adapter/render/render-utils.ts`](/E:/Me/Twist-v1/src/adapter/render/render-utils.ts)

建议顺序：

1. 先定义新的 `ZoneType`
2. 在 `createDefaultZoneConfig()` / `normalizeZoneConfig()` 中补默认配置
3. 在 `render-utils` 和 UI schema 里补显示名、颜色、按钮入口
4. 再决定这个 zoneType 会被哪个业务系统读取

这样做的好处是：先把“数据模型”和“显示入口”立住，再让 AI 或其他系统消费，不容易出现半成品类型。

### 4.2 如果要扩展 stockpile 的筛选规则，先从配置模型和查询函数开始

最合适的入口是：

- [`normalizeZoneConfig()`](/E:/Me/Twist-v1/src/world/zone-manager.ts#L90)
- [`isItemAcceptedByStockpile()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L324)
- [`canDropItemAt()`](/E:/Me/Twist-v1/src/features/ai/cleanup.ts#L131)
- [`findAlternateStockpileCell()`](/E:/Me/Twist-v1/src/features/ai/toil-handlers/drop.handler.ts#L54)

原因是 stockpile 规则现在分散在三个消费点：

- 选工时判断能不能搬进去
- Drop 时判断能不能放进去
- Cleanup 中断时判断能不能安全掉落

如果未来加“只收食物”“只收建材”“优先级格”“禁止腐烂物”等规则，最好先抽一个共享判断模块，再让这三个消费点统一复用，否则很容易再次出现规则漂移。

### 4.3 如果要扩展输入体验，优先从 `zone.analysis` 入手，而不是直接改预览代码

推荐入口：

- [`analyzeZoneCellPlacement()`](/E:/Me/Twist-v1/src/features/zone/zone.analysis.ts#L79)
- [`buildZoneCellPlacementPlan()`](/E:/Me/Twist-v1/src/features/zone/zone.analysis.ts#L183)

因为目前输入预览和命令执行已经共享这套分析逻辑。后续如果想支持：

- 按住修饰键“强制覆盖”
- 对异类型区域弹出冲突说明
- 预览显示“将合并几个区域”

最稳妥的方法就是优先增强分析结果结构，再让 `InputHandler` 和 UI 消费这些结果。这样能保持“预览即执行语义”。

### 4.4 如果要扩展 UI 侧区域编辑，先从 Preact build domain 开始

推荐入口：

- [`src/ui/domains/build/build.schemas.ts`](/E:/Me/Twist-v1/src/ui/domains/build/build.schemas.ts#L32)
- [`src/ui/domains/build/components/tool-mode-bar.tsx`](/E:/Me/Twist-v1/src/ui/domains/build/components/tool-mode-bar.tsx)
- [`src/ui/kernel/ui-ports.ts`](/E:/Me/Twist-v1/src/ui/kernel/ui-ports.ts#L35)
- [`src/ui/kernel/snapshot-reader.ts`](/E:/Me/Twist-v1/src/ui/kernel/snapshot-reader.ts)

因为新的 UI 架构已经把区域工具接进来了。后续如果要做：

- 存储区过滤面板
- 区域详情面板
- 选中区域后显示统计信息
- 多种 zoneType 的二级菜单

都应该优先走 `snapshot -> selector -> component -> ports` 这条新链路，而不是回到已删除的旧 DOM 工具栏思路。

### 4.5 如果要继续让 zones 影响 AI，入口在 `job-selector`

推荐入口：

- [`gatherCandidates()`](/E:/Me/Twist-v1/src/features/ai/job-selector.ts#L129)

因为目前 zones 真正影响 AI 的点只进入了“存储区物流”。未来如果要继续扩展：

- growing zone 触发播种/收获类工作
- animal zone 影响驯养/放牧/牵引
- stockpile zone 产生整理、压缩、转运优先级

最自然的方式仍然是把它们做成候选工作来源，接进已有 job selection 框架。

## 总结

这次 `ee2fe73..b39dad8` 的 zones 改动，实质上完成了四件事：

1. 把区域写入逻辑从“直接改格子集合”升级成了“分析 -> 计划 -> 执行”的领域模型
2. 把区域管理从“普通集合遍历”升级成了带索引、带配置、可按格编辑的地图级子系统
3. 把 `stockpile` 从纯视觉区域升级成了会影响 AI 搬运、Drop 和清理行为的真实业务规则
4. 把 zones 同时接进了命令总线、输入预览、正式渲染、存档系统和新的 Preact UI 架构

如果用一句话概括这次功能的本质，可以说：

“zones 已经从一个地图附属标记，成长成了世界规则的一部分，而 `stockpile` 是它第一次真正落地到游戏业务中的证明。”
