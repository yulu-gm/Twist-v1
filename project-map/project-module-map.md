# Project Module Map

## 项目总体架构

- 项目：`opus-world`
- 技术栈：Vite + Phaser
- 主入口：`src/main.ts`
- 目标：为 agent 提供高密度模块导航，先读 map 再做局部搜索。
- 推荐阅读顺序：先看 `plan/opus architecture.md` 理解边界，再看本文件缩小模块范围，最后进入具体代码文件。

## 分层与依赖方向

- `main` → `src/main.ts`：启动入口与装配层。
- `core` → `src/core`：全局基础设施与通用运行时组件。
- `world` → `src/world`：世界根数据、地图容器和 map 级子系统。
- `defs` → `src/defs`：静态定义和注册入口。
- `features` → `src/features`：业务特性目录，负责 simulation 规则和 command/system 实现。
- `adapter` → `src/adapter`：Phaser、输入、渲染、UI 和调试适配层。
- `presentation` → `src/presentation`：非 simulation 的展示态桥梁。
- `plan` → `plan`：项目内架构蓝图、流程解释和演化审计文档。

依赖主方向：`main` 装配 `core/world/defs/features`，`adapter` 读取 simulation 状态并驱动输入/渲染，`presentation` 作为展示态桥梁。

## 核心模块导航

### main

- 职责：应用启动与装配入口，负责构建 defs、world、初始内容、系统注册和 Phaser 启动。
- 代表文件：`src/main.ts`
- 先搜这些词：`启动流程`，`buildSystems`，`registerCommands`，`初始地图生成`，`boot`
- 相关文档：`plan/opus architecture.md`，`plan/业务场景解释.md`

### core

- 职责：核心引擎基础设施，提供时钟、命令总线、事件总线、对象池、网格与 tick 调度。
- 代表文件：`src/core/tick-runner.ts`，`src/core/command-bus.ts`，`src/core/types.ts`，`src/core/object-pool.ts`
- 先搜这些词：`tick 顺序`，`command bus`，`event bus`，`基础类型`，`对象池`
- 相关文档：`plan/opus architecture.md`，`plan/基建检查报告.md`

### world

- 职责：世界根数据与地图级容器，管理 GameMap、DefDatabase 桥接以及区域/房间/预约等子系统。
- 代表文件：`src/world/world.ts`，`src/world/game-map.ts`，`src/world/def-database.ts`
- 先搜这些词：`World 结构`，`GameMap`，`pathGrid`，`rooms`，`reservations`
- 相关文档：`plan/opus architecture.md`，`plan/业务场景解释.md`

### defs

- 职责：静态定义数据层，集中注册 terrain/building/item/plant/job 等 Def。
- 代表文件：`src/defs/index.ts`，`src/defs/terrains.ts`，`src/defs/buildings.ts`，`src/defs/items.ts`
- 先搜这些词：`DefDatabase`，`terrain defs`，`building defs`，`item defs`，`job defs`
- 相关文档：`plan/opus architecture.md`

### adapter

- 职责：适配器层，连接 Phaser、输入、渲染、DOM UI 与调试工具，不承载 simulation 规则。
- 代表文件：`src/adapter/main-scene.ts`，`src/adapter/render/render-sync.ts`，`src/adapter/input/input-handler.ts`
- 先搜这些词：`MainScene`，`Phaser`，`渲染同步`，`DOM UI`，`输入拖拽`
- 相关文档：`plan/V1友好交互-落地计划.md`，`plan/业务场景解释.md`

### presentation

- 职责：展示态桥梁，存放选中、悬停、工具模式、预览等不属于 simulation 的瞬态状态。
- 代表文件：`src/presentation/presentation-state.ts`
- 先搜这些词：`PresentationState`，`ToolType`，`选中态`，`预览态`
- 相关文档：`plan/V1友好交互-落地计划.md`，`plan/代码坏味道审计报告.md`

## Feature 模块导航表

| Feature | 职责 | 代表文件 | 先看什么问题 |
| --- | --- | --- | --- |
| `features.ai` | AI 调度与 toil 执行层，负责候选工作生成、任务生命周期和具体 toil handler。 | `src/features/ai/job-selector.ts`<br>`src/features/ai/toil-executor.ts`<br>`src/features/ai/job-lifecycle.ts` | `工作选择` / `wander` / `toil handler` |
| `features.building` | 建筑对象 schema、工厂和查询，以及建筑 tick 行为。 | `src/features/building/building.types.ts`<br>`src/features/building/building.factory.ts`<br>`src/features/building/building.systems.ts` | `building factory` / `building tick` / `building queries` |
| `features.construction` | 蓝图、工地、建造命令与施工进度处理，是从蓝图到建筑的主链路。 | `src/features/construction/construction.commands.ts`<br>`src/features/construction/construction.system.ts`<br>`src/features/construction/construction.queries.ts` | `place blueprint` / `construction progress` / `cancel construction` |
| `features.corpse` | 尸体对象创建与腐烂系统。 | `src/features/corpse/corpse.factory.ts`<br>`src/features/corpse/corpse.system.ts`<br>`src/features/corpse/corpse.types.ts` | `corpse decay` / `corpse factory` |
| `features.designation` | 指派对象、指派命令和 work 生成入口，连接玩家意图与可执行工作。 | `src/features/designation/designation.commands.ts`<br>`src/features/designation/designation.system.ts`<br>`src/features/designation/designation.queries.ts` | `designate mine` / `designate cut` / `cancel designation` |
| `features.fire` | 火焰对象行为与扩散/熄灭更新。 | `src/features/fire/fire.system.ts`<br>`src/features/fire/fire.types.ts` | `fire system` / `fire types` |
| `features.item` | 物品对象 schema、工厂和查询，供掉落、搬运、消耗等系统复用。 | `src/features/item/item.factory.ts`<br>`src/features/item/item.types.ts`<br>`src/features/item/item.queries.ts` | `item factory` / `createItemRaw` / `stackCount` |
| `features.movement` | Pawn 移动状态与逐 tick 移动推进逻辑。 | `src/features/movement/movement.system.ts`<br>`src/features/movement/movement.types.ts` | `movement system` / `moveProgress` / `pathIndex` |
| `features.pathfinding` | 寻路服务与路径结果类型，支撑 GoTo 等行动。 | `src/features/pathfinding/path.service.ts`<br>`src/features/pathfinding/path.types.ts`<br>`src/features/pathfinding/path.grid.ts` | `findPath` / `isReachable` / `MinHeap` |
| `features.pawn` | Pawn schema、工厂、命令和需求衰减系统。 | `src/features/pawn/pawn.factory.ts`<br>`src/features/pawn/pawn.commands.ts`<br>`src/features/pawn/pawn.systems.ts` | `createPawn` / `needs decay` / `draft pawn` |
| `features.plant` | 植物对象创建与生长逻辑。 | `src/features/plant/plant.factory.ts`<br>`src/features/plant/plant.system.ts`<br>`src/features/plant/plant.types.ts` | `grow plants` / `tree` / `berry bush` |
| `features.reservation` | 地图预约表的 feature 侧桥接与清理逻辑。 | `src/features/reservation/reservation.table.ts`<br>`src/features/reservation/reservation.types.ts` | `reservation cleanup` / `Reservation type` |
| `features.room` | 房间重建系统与房间类型桥接。 | `src/features/room/room.system.ts`<br>`src/features/room/room.types.ts` | `room rebuild` / `markDirty` / `room graph` |
| `features.save` | 存档命令、存储读取和存档数据结构。 | `src/features/save/save.commands.ts`<br>`src/features/save/save.types.ts` | `save game` / `load game` / `localStorage` |
| `features.zone` | 区域命令、查询与 zone 类型桥接。 | `src/features/zone/zone.commands.ts`<br>`src/features/zone/zone.queries.ts`<br>`src/features/zone/zone.types.ts` | `zone set cells` / `zone delete` / `storage zone` |

## 高频任务推荐入口

- 启动/注册/主循环在哪里？
  先看：`src/main.ts`，`src/adapter/main-scene.ts`，`src/core/tick-runner.ts`。原因：主装配在 main，tick 推进在 MainScene，系统执行顺序在 TickRunner。
- Pawn 的工作选择逻辑在哪里？
  先看：`src/features/ai/job-selector.ts`，`src/features/ai/job-lifecycle.ts`，`src/features/pawn/pawn.types.ts`。原因：选工、分配和 job 生命周期都集中在 AI feature，Pawn schema 决定了 ai/needs 字段形状。
- 采矿从拖框到执行的链路在哪？
  先看：`src/adapter/input/input-handler.ts`，`src/features/designation/designation.commands.ts`，`src/features/ai/jobs/mine-job.ts`，`src/features/ai/toil-handlers/work.handler.ts`。原因：输入层下发指派命令，designation 落地为对象，AI 再把指派转成可执行 job 和 toil。
- 房间重建和 pathGrid 更新在哪处理？
  先看：`src/world/game-map.ts`，`src/world/path-grid.ts`，`src/features/room/room.system.ts`，`src/features/construction/construction.system.ts`。原因：pathGrid 是地图级基础设施，房间重建是 feature，建造完成后会触发路径和房间相关更新。
- 存档读取从哪里开始？
  先看：`src/features/save/save.commands.ts`，`src/features/save/save.types.ts`，`src/world/world.ts`。原因：save.commands 同时承载保存和加载入口，并在加载时重建世界与地图容器。
- 渲染同步和对象 renderer 在哪一层？
  先看：`src/adapter/render/render-sync.ts`，`src/adapter/render/object-renderers/pawn-renderer.ts`，`src/presentation/presentation-state.ts`。原因：渲染与 renderer 都在 adapter 层，presentation-state 负责非 simulation 的 UI 桥接状态。
- Defs 和静态数据去哪看？
  先看：`src/defs/index.ts`，`src/defs/terrains.ts`，`src/defs/buildings.ts`，`src/world/def-database.ts`。原因：defs 负责定义内容，DefDatabase 负责统一注册与访问。
- 区域、指派、建造这些玩家意图在哪里入库？
  先看：`src/features/zone/zone.commands.ts`，`src/features/designation/designation.commands.ts`，`src/features/construction/construction.commands.ts`。原因：用户输入最终都会经由 command handler 落地为 simulation 对象或状态变更。

## 关键文档入口

- `plan/opus architecture.md`：最完整的架构蓝图，适合先理解分层、World/GameMap 和对象模型。
- `plan/业务场景解释.md`：按实际业务链路解释输入、指派、AI 选工、toil 执行之间的跳转关系。
- `plan/基建检查报告.md`：指出大文件、结构热点与未来扩展瓶颈，适合快速锁定高风险区域。
- `plan/代码坏味道审计报告.md`：补充职责混乱、重复规则与缺少测试保护网等问题观察。

## 检索注意事项

- 先读 `project-map/project-module-map.json` 再搜代码；它是给 agent 用的主索引。
- 问“链路在哪”时，优先看 `plan/业务场景解释.md`，再跳到相应 feature 文件。
- 问“架构边界/这一层该放什么”时，优先看 `plan/opus architecture.md`。
- 问“为什么这个文件是热点/为什么改这里风险高”时，优先看 `plan/基建检查报告.md` 和 `plan/代码坏味道审计报告.md`。
- 对 feature 目录，通常按 `commands -> system -> queries/factory -> types` 的顺序收缩搜索范围最省 token。
- `adapter` 负责表现与输入，不要在这里寻找 simulation 规则本体；真正规则多半在 `features/*` 或 `world/*`。

