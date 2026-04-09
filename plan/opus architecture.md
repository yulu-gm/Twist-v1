# RimWorld-like 游戏落地架构文档

## Phaser + TypeScript · Agent-First · Implementation Guide v2

------

## 一、文档定位

本文档是一份**可直接指导编码的工程架构蓝图**。它保留了 v1（GPT 方案）中正确的架构理念——Simulation/Presentation 分离、Command 入口、反对深继承——同时补全了 v1 缺失的全部工程细节：对象在内存中如何存储和查询、Tick 如何保证确定性、AI 中断后如何清理状态、存档怎么做、事件系统怎么设计。

**读者画像**：拿到这份文档的开发者（或 AI Agent），应该能在不问任何追加问题的前提下，开始编写 `core/` 层的第一行代码。

------

## 二、核心架构原则

以下 7 条原则按优先级排序。当原则之间冲突时，编号小的优先。

1. **确定性优先**
    同一份 command 序列 + 同一个随机种子 = 完全相同的世界状态。这是回放、无头测试、Agent 协作的前提条件。所有设计决策在不确定时，优先选择能保证确定性的方案。
2. **Simulation 与 Presentation 完全分离**
    Simulation 层可以在无 DOM、无 Phaser、无任何渲染环境下独立运行并产生正确结果。Phaser 是适配器，不是游戏本体。
3. **Command 是唯一的外部写入入口**
    所有来自玩家、UI、debug 工具、自动化脚本的意图，必须通过 Command 进入 World。System 内部的状态变更不走 Command。
4. **数据与逻辑分离**
    对象是纯数据（plain object / interface），没有方法。所有逻辑在 System 中。对象只回答"我是什么"，System 回答"该怎么做"。
5. **Feature-based 组织**
    代码按领域特性（pawn、building、construction）组织，而非按技术层（objects、systems、commands）组织。一个特性的全部相关代码在一个目录下。
6. **不用 ECS，不用深继承，用 Discriminated Union + Typed Pool**
    不引入 ECS 框架，也不构建继承树。用 TypeScript 的 discriminated union（`kind` 字段）做类型区分，用 flat pool + 索引做查询。
7. **渐进式构建**
    架构提供骨架，具体 feature 逐步填入。每加一个 feature 不需要改骨架代码。

------

## 三、World 数据模型

### 3.1 顶层结构

World 是整个 simulation 的根容器。它本质上是一个内存数据库。

```typescript
interface World {
  // ── 全局状态 ──
  tick: number;                    // 当前 tick 序号，单调递增
  clock: SimulationClock;          // 游戏内日历时间
  rng: SeededRandom;               // 确定性随机数生成器，状态可序列化
  speed: SimSpeed;                 // 暂停 / 1x / 2x / 3x

  // ── 静态定义 ──
  defs: DefDatabase;               // 所有 Def（建筑定义、物品定义等）

  // ── 地图 ──
  maps: Map<MapId, GameMap>;       // 当前所有地图（v1 只有一张）

  // ── 全局领域数据 ──
  factions: FactionTable;
  storyState: StoryState;          // 故事/事件/难度上下文

  // ── 运行时基础设施（不进存档）──
  commandQueue: Command[];         // 待执行命令队列
  eventBuffer: GameEvent[];        // 当前 tick 产生的事件
  commandLog: ExecutedCommand[];   // 已执行命令日志（用于回放）
}
```

### 3.2 GameMap 结构

每张地图是 World 的一个子容器，管辖该地图上的所有数据。

```typescript
interface GameMap {
  id: MapId;
  width: number;
  height: number;

  // ── 地形层 ──
  terrain: Grid<TerrainDefId>;         // 每个 cell 的地形类型

  // ── 对象池：该地图上所有 simulation 对象 ──
  objects: ObjectPool;

  // ── 空间索引 ──
  spatial: SpatialIndex;               // cell → ObjectId[] 的快速查询

  // ── Map Domain 数据 ──
  zones: ZoneManager;                  // 区域管理
  rooms: RoomGraph;                    // 房间图（按需重建，可不存档）
  reservations: ReservationTable;      // 资源/位置预订表
  pathGrid: PathGrid;                  // 寻路用的可通行性缓存

  // ── 环境场 ──
  temperature: Grid<number>;           // 温度场
  beauty: Grid<number>;                // 美观度场
  // ... 可扩展更多 field
}
```

### 3.3 ObjectPool：核心存储

ObjectPool 是每张地图上所有 simulation 对象的 flat 存储。不搞子类注册表、不搞分层容器。

```typescript
interface ObjectPool {
  // ── 主存储 ──
  byId: Map<ObjectId, MapObject>;

  // ── 索引（由 pool 自动维护，外部只读） ──
  byKind: Map<ObjectKind, Set<ObjectId>>;    // 按类型查
  byTag:  Map<Tag, Set<ObjectId>>;           // 按标签查（haulable, reservable...）

  // ── 写操作（只有 System 在 tick 内调用） ──
  add(obj: MapObject): void;
  remove(id: ObjectId): void;
  get(id: ObjectId): MapObject | undefined;

  // ── 查询操作 ──
  allOfKind(kind: ObjectKind): MapObject[];
  allWithTag(tag: Tag): MapObject[];
  allWithTags(tags: Tag[]): MapObject[];     // AND 查询
}
```

**索引维护规则**：

- `add()` 时自动将对象注册到 `byKind`、`byTag`，并通知 `SpatialIndex` 更新
- `remove()` 时自动从所有索引移除
- 对象的 `tags` 在创建时由 Def 决定，运行时通常不变。如果需要变（比如物品从"在地上"变为"被携带"），由 System 显式调用 pool 的 `updateTags()` 方法

### 3.4 SpatialIndex：空间查询

```typescript
interface SpatialIndex {
  // cell → 该 cell 上的对象 ID 集合
  getAt(cell: CellCoord): ObjectId[];

  // 范围查询
  getInRect(min: CellCoord, max: CellCoord): ObjectId[];

  // 可通行性查询（常用于寻路和放置检查）
  isPassable(cell: CellCoord): boolean;
  isOccupied(cell: CellCoord): boolean;

  // 维护（由 ObjectPool 内部调用）
  onObjectAdded(id: ObjectId, cell: CellCoord, footprint?: Footprint): void;
  onObjectRemoved(id: ObjectId, cell: CellCoord, footprint?: Footprint): void;
  onObjectMoved(id: ObjectId, from: CellCoord, to: CellCoord): void;
}
```

**实现**：底层用 `Grid<Set<ObjectId>>`，即 width × height 的二维数组，每个 cell 存一个 Set。对于 RimWorld 规模的地图（200×200 ~ 400×400），这比 quadtree 更简单且性能足够。

------

## 四、对象类型系统

### 4.1 Discriminated Union 方案

不用 class 继承，用 TypeScript discriminated union。所有地图对象共享一个 `MapObject` 联合类型，通过 `kind` 字段区分。

```typescript
// ── 所有地图对象的联合类型 ──
type MapObject =
  | Pawn
  | Building
  | Item
  | Plant
  | Fire
  | Corpse
  | Blueprint
  | ConstructionSite
  | Designation;

// ── 对象种类枚举 ──
enum ObjectKind {
  Pawn = "pawn",
  Building = "building",
  Item = "item",
  Plant = "plant",
  Fire = "fire",
  Corpse = "corpse",
  Blueprint = "blueprint",
  ConstructionSite = "construction_site",
  Designation = "designation",
}
```

### 4.2 公共字段

所有 MapObject 共享的字段抽取为一个 base shape（注意：这是 interface，不是 class）。

```typescript
interface MapObjectBase {
  id: ObjectId;                   // 全局唯一，格式 "obj_${autoIncrement}"
  kind: ObjectKind;               // discriminator
  defId: DefId;                   // 引用 DefDatabase 中的静态定义
  mapId: MapId;                   // 所属地图
  cell: CellCoord;                // 主格子位置
  footprint?: Footprint;          // 多格子占地（建筑用）
  tags: Set<Tag>;                 // 运行时标签，用于索引
  destroyed: boolean;             // 标记为待销毁，在 CLEANUP phase 移除
}
```

### 4.3 具体对象定义

以下给出每种对象的完整字段定义。这些不是"示例方向"，而是第一版的正式 schema。

```typescript
// ── Pawn ──
interface Pawn extends MapObjectBase {
  kind: ObjectKind.Pawn;

  // 身份
  name: string;
  factionId: FactionId;

  // 状态模块（每个模块是一个 plain object）
  movement: {
    path: CellCoord[] | null;      // 当前路径（null = 静止）
    pathIndex: number;              // 路径执行到第几步
    moveProgress: number;           // 0~1 当前格子内移动进度
    speed: number;                  // 移动速度（cells/tick）
  };

  needs: {
    food: number;                   // 0~100
    rest: number;                   // 0~100
    joy: number;                    // 0~100
    mood: number;                   // 综合心情，由 needs + thoughts 计算
  };

  health: {
    hp: number;
    maxHp: number;
    injuries: Injury[];
  };

  skills: Record<SkillId, SkillLevel>;

  inventory: {
    carrying: ObjectId | null;      // 当前手持的物品 ID
    carryCapacity: number;
  };

  ai: {
    currentJob: Job | null;
    currentToilIndex: number;
    toilState: Record<string, unknown>;  // 当前 toil 的局部状态
    idleTicks: number;                    // 空闲了多少 tick
  };

  schedule: {
    entries: ScheduleEntry[];        // 24h 时间表
  };
}

// ── Building ──
interface Building extends MapObjectBase {
  kind: ObjectKind.Building;
  rotation: Rotation;                // 0 / 90 / 180 / 270
  hpCurrent: number;
  hpMax: number;
  power?: { consumption: number; production: number; connected: boolean };
  storage?: { allowedDefIds: Set<DefId>; priority: StoragePriority };
  interaction?: { interactionCell: CellCoord };  // pawn 操作此建筑时站的位置
}

// ── Item ──
interface Item extends MapObjectBase {
  kind: ObjectKind.Item;
  stackCount: number;
  maxStack: number;
  quality?: QualityLevel;
}

// ── Plant ──
interface Plant extends MapObjectBase {
  kind: ObjectKind.Plant;
  growthProgress: number;           // 0~1
  growthStage: number;              // 对应 def 中的阶段
  sownByPlayer: boolean;
  harvestReady: boolean;
  dyingProgress: number;            // 0~1, 1=死亡
}

// ── Fire ──
interface Fire extends MapObjectBase {
  kind: ObjectKind.Fire;
  intensity: number;                // 0~1
  ticksAlive: number;
  spreadCooldown: number;           // 距下次尝试蔓延的 tick 数
}

// ── Corpse ──
interface Corpse extends MapObjectBase {
  kind: ObjectKind.Corpse;
  originalPawnId: ObjectId;
  decayProgress: number;            // 0~1
}

// ── Blueprint（计划中的建筑，尚未开工） ──
interface Blueprint extends MapObjectBase {
  kind: ObjectKind.Blueprint;
  targetDefId: DefId;               // 要建造的建筑定义
  rotation: Rotation;
  materialsRequired: MaterialReq[];
  materialsDelivered: MaterialReq[];  // 已运送到现场的材料
}

// ── ConstructionSite（正在施工中） ──
interface ConstructionSite extends MapObjectBase {
  kind: ObjectKind.ConstructionSite;
  targetDefId: DefId;
  rotation: Rotation;
  buildProgress: number;            // 0~1
  totalWorkAmount: number;          // 需要的总工作量（tick 数）
  workDone: number;                 // 已完成工作量
}

// ── Designation（玩家施加的工作指派） ──
interface Designation extends MapObjectBase {
  kind: ObjectKind.Designation;
  designationType: DesignationType;
  targetObjectId?: ObjectId;        // 附着目标（如 HarvestDesignation → 某棵 Plant）
  targetCell?: CellCoord;           // 或指向某个格子（如 MineDesignation）
  priority: WorkPriority;
}

enum DesignationType {
  Harvest = "harvest",
  Mine = "mine",
  Deconstruct = "deconstruct",
  Repair = "repair",
  Haul = "haul",
  Hunt = "hunt",
  Cut = "cut",       // 砍树
}

// ── 辅助类型 ──
interface CellCoord { x: number; y: number }
interface Footprint { width: number; height: number }  // 左上角为 cell
interface MaterialReq { defId: DefId; count: number }
type ObjectId = string;  // "obj_1", "obj_2", ...
type MapId = string;
type DefId = string;
type FactionId = string;
type SkillId = string;
type Tag = string;       // "haulable", "reservable", "selectable", ...
enum Rotation { North = 0, East = 90, South = 180, West = 270 }
```

### 4.4 为什么是 interface 而不是 class

- **可序列化**：plain object 天然 JSON.stringify，class 实例不行
- **确定性**：没有 this、没有隐式状态、没有方法副作用
- **Agent 友好**：AI Agent 修改数据时只操作字段，不需要理解方法语义
- **测试友好**：构造测试对象就是写一个 object literal

### 4.5 Map Domain 数据（不进 ObjectPool）

以下数据由 GameMap 直接持有，不放入 ObjectPool。它们描述的是地图的"空间结构"而非"世界中的物体"。

```typescript
// ── Zone ──
interface Zone {
  id: ZoneId;
  zoneType: ZoneType;              // stockpile / growing / animal / ...
  cells: Set<CellCoordKey>;        // "x,y" 格式的 cell 集合
  config: ZoneConfig;              // 存储优先级、允许物品、种植类型等
}

// ── Room ──
interface Room {
  id: RoomId;
  cells: Set<CellCoordKey>;
  isOutdoor: boolean;
  temperature: number;
  impressiveness: number;
  // Room 在墙壁/门变化后由 RoomGraph 自动重建
  // 不需要手动维护
}

// ── Reservation ──
interface Reservation {
  id: ReservationId;
  claimantId: ObjectId;            // 哪个 pawn 预订的
  targetId: ObjectId;              // 预订的对象
  jobId: JobId;                    // 关联的 job
  targetCell?: CellCoord;          // 或预订的位置
  expiresAtTick: number;           // 超时自动释放（防止 pawn 死亡后残留）
}
```

------

## 五、Def 系统（静态数据定义）

### 5.1 设计理念

Def 是游戏中所有"种类"的静态定义。运行时对象通过 `defId` 引用 Def，获取该种类的基础属性。

**Def 是只读的，永远不会在运行时被修改。**

### 5.2 DefDatabase

```typescript
interface DefDatabase {
  buildings: Map<DefId, BuildingDef>;
  items: Map<DefId, ItemDef>;
  plants: Map<DefId, PlantDef>;
  terrains: Map<DefId, TerrainDef>;
  jobs: Map<DefId, JobDef>;
  recipes: Map<DefId, RecipeDef>;
  // ...

  // 统一查询接口
  get<T extends AnyDef>(category: DefCategory, id: DefId): T | undefined;
}
```

### 5.3 Def 示例

```typescript
interface BuildingDef {
  defId: DefId;                    // "wall_wood", "door_steel", ...
  label: string;                   // "木墙"
  description: string;
  size: Footprint;
  maxHp: number;
  workToBuild: number;             // 建造需要的工作 tick 数
  costList: MaterialReq[];
  tags: Tag[];                     // "structure", "wall", "passable", ...
  blocksMovement: boolean;
  blocksLight: boolean;
  passable: boolean;
  interactionCellOffset?: CellCoord;
  powerConsumption?: number;
  storageCapacity?: StorageConfig;
}
```

### 5.4 加载方式

第一版：Def 以 TypeScript 常量的形式写在 `src/defs/data/` 目录下，启动时注册到 DefDatabase。

后续：可以迁移到 JSON/YAML 文件，由加载器解析。但数据结构不变。

------

## 六、Tick 与时间系统

### 6.1 双时钟模型

```
┌─────────────────────────────────────────────┐
│                 Browser Frame               │
│  requestAnimationFrame / Phaser update      │
│  dt = 真实毫秒间隔（16ms @60fps）           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │       Simulation Tick Loop          │    │
│  │  while (accum >= TICK_INTERVAL) {   │    │
│  │    world.tick++;                    │    │
│  │    runAllPhases(world);             │    │
│  │    accum -= TICK_INTERVAL;          │    │
│  │  }                                  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  renderSync(world, interpolation);          │
│  uiUpdate(world);                           │
└─────────────────────────────────────────────┘
```

- **Render Time**：浏览器帧级，可变 dt，仅用于动画插值和 UI
- **Simulation Time**：固定间隔 tick，与帧率解耦

```typescript
const BASE_TICK_MS = 100;  // 1 tick = 100ms 游戏时间（1x 速度下）

// 速度倍率对应每帧跑几个 tick
// 1x = 每真实秒 ~10 tick
// 2x = 每真实秒 ~20 tick
// 3x = 每真实秒 ~30 tick
// 暂停 = 0 tick
```

### 6.2 Tick Phase 定义

每个 tick 严格按以下 phase 顺序执行。同一 phase 内的 system 按注册顺序执行。

```typescript
enum TickPhase {
  // Phase 1: 处理外部输入
  COMMAND_PROCESSING,

  // Phase 2: 将 designation 转化为可分配的 work item
  WORK_GENERATION,

  // Phase 3: AI 决策——为空闲 pawn 选择 job
  AI_DECISION,

  // Phase 4: 分配和管理 reservation
  RESERVATION,

  // Phase 5: 执行 movement、action、construction 等
  EXECUTION,

  // Phase 6: 被动世界更新——need 衰减、plant 生长、fire 扩散、环境场
  WORLD_UPDATE,

  // Phase 7: 清理——移除 destroyed 对象、释放过期 reservation
  CLEANUP,

  // Phase 8: 事件分发——通知 UI、日志、debug
  EVENT_DISPATCH,
}
```

### 6.3 System 注册

```typescript
interface SystemRegistration {
  id: string;                      // "movement", "fire_spread", ...
  phase: TickPhase;
  frequency: number;               // 每 N tick 执行一次，1 = 每 tick
  execute: (world: World, map: GameMap) => void;
}

// 注册示例
const systems: SystemRegistration[] = [
  { id: "command_processor",  phase: TickPhase.COMMAND_PROCESSING, frequency: 1,  execute: processCommands },
  { id: "work_scanner",       phase: TickPhase.WORK_GENERATION,    frequency: 5,  execute: scanDesignationsForWork },
  { id: "ai_job_selector",    phase: TickPhase.AI_DECISION,        frequency: 1,  execute: selectJobsForIdlePawns },
  { id: "reservation_mgr",    phase: TickPhase.RESERVATION,        frequency: 1,  execute: processReservations },
  { id: "movement",           phase: TickPhase.EXECUTION,          frequency: 1,  execute: executeMovement },
  { id: "toil_executor",      phase: TickPhase.EXECUTION,          frequency: 1,  execute: executeToils },
  { id: "construction",       phase: TickPhase.EXECUTION,          frequency: 1,  execute: progressConstruction },
  { id: "need_decay",         phase: TickPhase.WORLD_UPDATE,       frequency: 10, execute: decayNeeds },
  { id: "plant_growth",       phase: TickPhase.WORLD_UPDATE,       frequency: 50, execute: growPlants },
  { id: "fire_spread",        phase: TickPhase.WORLD_UPDATE,       frequency: 5,  execute: spreadFire },
  { id: "room_rebuild",       phase: TickPhase.WORLD_UPDATE,       frequency: 1,  execute: rebuildDirtyRooms },
  { id: "cleanup",            phase: TickPhase.CLEANUP,            frequency: 1,  execute: removeDestroyedObjects },
  { id: "event_dispatch",     phase: TickPhase.EVENT_DISPATCH,     frequency: 1,  execute: dispatchEvents },
];
```

### 6.4 确定性保证

- 同一 phase 内 system 的执行顺序由 `systems` 数组顺序决定，不可变
- 同一 system 内遍历对象时，按 `ObjectId` 的字符串升序排序迭代（`Array.from(pool.allOfKind(...)).sort(byId)`）
- 所有随机操作使用 `world.rng`（Mulberry32 或类似算法），rng 状态随 tick 推进
- **禁止**在 simulation 层使用 `Math.random()`、`Date.now()`、`setTimeout` 或任何不确定来源

### 6.5 频率控制实现

```typescript
function shouldRunThisTick(system: SystemRegistration, tick: number): boolean {
  return tick % system.frequency === 0;
}
```

简单取模。`frequency: 10` 意味着 tick 0, 10, 20, ... 执行。

------

## 七、Command 系统

### 7.1 Command 接口

```typescript
interface Command {
  type: string;                    // "place_blueprint", "designate_mine", ...
  payload: Record<string, unknown>;
}

interface CommandHandler {
  type: string;                    // 匹配的 command type
  validate(world: World, cmd: Command): ValidationResult;
  execute(world: World, cmd: Command): ExecutionResult;
}

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

type ExecutionResult = {
  events: GameEvent[];             // 执行产生的事件
};
```

### 7.2 执行流程

```
外部调用 world.commandQueue.push(cmd)
          │
          ▼
[COMMAND_PROCESSING phase]
  for (cmd of commandQueue) {
    1. handler = findHandler(cmd.type)
    2. result = handler.validate(world, cmd)
    3. if (!result.valid) → 发出 CommandRejected 事件，跳过
    4. execResult = handler.execute(world, cmd)
    5. 将 cmd 记入 commandLog（用于回放）
    6. 将 execResult.events 加入 eventBuffer
  }
  清空 commandQueue
```

### 7.3 具体 Command 定义

#### 建造相关

```typescript
// 放置蓝图
{ type: "place_blueprint", payload: { defId: "wall_wood", cell: {x:5, y:3}, rotation: 0 } }

// 取消蓝图/工地
{ type: "cancel_construction", payload: { objectId: "obj_42" } }
```

#### 指派相关

```typescript
// 指派采集
{ type: "designate_harvest", payload: { targetId: "obj_15" } }

// 指派采矿
{ type: "designate_mine", payload: { cell: {x:10, y:7} } }

// 取消指派
{ type: "cancel_designation", payload: { designationId: "obj_30" } }
```

#### 区域相关

```typescript
// 创建/扩展区域
{ type: "zone_set_cells", payload: { zoneId: "zone_1", cells: [{x:0,y:0},{x:1,y:0}], zoneType: "stockpile" } }

// 删除区域
{ type: "zone_delete", payload: { zoneId: "zone_1" } }
```

#### 控制相关

```typescript
// 改变游戏速度
{ type: "set_speed", payload: { speed: 2 } }

// 强制 pawn 执行指定任务
{ type: "draft_pawn", payload: { pawnId: "obj_1" } }
{ type: "force_job", payload: { pawnId: "obj_1", jobDefId: "goto", targetCell: {x:5,y:5} } }
```

#### Debug

```typescript
// 生成对象
{ type: "debug_spawn", payload: { defId: "steel", cell: {x:3,y:3}, count: 50 } }

// 销毁对象
{ type: "debug_destroy", payload: { objectId: "obj_99" } }

// 推进时间
{ type: "debug_advance_ticks", payload: { count: 100 } }
```

### 7.4 不命令化的内容

以下操作是 system 内部行为，不走 Command：

- Pawn 的每一步移动
- Need 的每 tick 衰减
- Plant 的生长推进
- Fire 的蔓延
- Pathfinding 内部计算
- Reservation 的自动过期清理
- Room 的自动重建

判断标准：**"这个操作是否可以由玩家/外部触发？"** 如果是 → Command。如果是 simulation 自身的自然推进 → System 内部逻辑。

------

## 八、AI 与 Job 系统

### 8.1 总体架构

```
┌────────────────────────────────────────────────┐
│                 Pawn AI Pipeline                │
│                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Context  │───▶│   Job    │───▶│  Toil    │  │
│  │ Gather   │    │ Selector │    │ Executor │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│       │                │               │        │
│       │           ┌────┴────┐     ┌────┴────┐  │
│       │           │ Reserve │     │ Cleanup  │  │
│       │           │ Attempt │     │ Protocol │  │
│       │           └─────────┘     └─────────┘  │
└────────────────────────────────────────────────┘
```

### 8.2 Job 定义

```typescript
interface Job {
  id: JobId;
  defId: DefId;                    // 引用 JobDef
  pawnId: ObjectId;                // 执行者
  targetId?: ObjectId;             // 目标对象
  targetCell?: CellCoord;          // 目标位置
  toils: Toil[];                   // 步骤序列
  currentToilIndex: number;        // 当前执行到第几步
  reservations: ReservationId[];   // 该 job 持有的所有 reservation
  state: JobState;
}

enum JobState {
  Starting = "starting",
  Active = "active",
  Completing = "completing",
  Interrupted = "interrupted",
  Failed = "failed",
  Done = "done",
}
```

### 8.3 Toil 定义

Toil 是 Job 的原子步骤，每个 Toil 是一个小型状态机。

```typescript
interface Toil {
  type: ToilType;
  targetId?: ObjectId;
  targetCell?: CellCoord;
  state: ToilState;
  localData: Record<string, unknown>;  // toil 级别局部状态
}

enum ToilType {
  GoTo = "goto",              // 寻路并移动到目标
  PickUp = "pickup",          // 捡起物品
  Drop = "drop",              // 放下物品
  Work = "work",              // 在目标处工作（进度推进）
  Wait = "wait",              // 等待若干 tick
  Deliver = "deliver",        // 搬运物品到目标位置
  Interact = "interact",      // 与建筑交互（如使用工作台）
}

enum ToilState {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
}
```

### 8.4 Job Selection（AI_DECISION phase）

每个空闲 pawn（`ai.currentJob === null`）执行以下流程：

```
1. 收集 candidate jobs
   ├── 扫描所有 Designation（harvest, mine, haul, ...）
   ├── 扫描所有 Blueprint（需要搬运材料或施工）
   ├── 检查自身 needs（hungry → find food job, tired → find bed job）
   └── 检查 schedule（当前时段应该做什么）

2. 对每个 candidate 计算 utility score
   score = Σ (weight_i × factor_i)

   factors:
   ├── priority:     designation 的优先级或 need 的紧急度
   ├── distance:     到目标的寻路距离（用 A* 或预计算 flow field）
   ├── skill_match:  pawn 的相关技能等级
   ├── need_urgency: 如果是 need-driven job，需求的紧急度
   └── danger:       路径上的威胁（火、敌人等）

3. 按 score 降序排列

4. 从最高 score 开始尝试：
   a. 尝试 reserve 所需资源/目标
   b. reserve 成功 → 选定该 job，展开为 toil 序列
   c. reserve 失败 → 尝试下一个 candidate
   d. 全部失败 → pawn 进入 idle（wander 或 wait）
```

### 8.5 Toil Execution（EXECUTION phase）

```
每 tick，对每个有 active job 的 pawn：

1. 取当前 toil = job.toils[job.currentToilIndex]

2. switch (toil.type):
   ├── GoTo:
   │   ├── 如果没有路径 → 请求寻路，存入 pawn.movement.path
   │   ├── 如果有路径 → 推进 pawn.movement（每 tick 走 speed 个格子）
   │   ├── 到达目标 → toil.state = Completed
   │   └── 路径被阻断 → 重新寻路，超过重试次数 → toil.state = Failed
   │
   ├── PickUp:
   │   ├── 检查目标物品是否还在且可拿
   │   ├── 将 item 从 ObjectPool 移除（或减少 stackCount）
   │   ├── 设置 pawn.inventory.carrying = targetId
   │   └── toil.state = Completed
   │
   ├── Work:
   │   ├── 每 tick 增加 workDone（受 skill 影响）
   │   ├── workDone >= totalWork → toil.state = Completed
   │   └── 否则继续
   │
   └── ... 其他 toil 类似

3. 如果当前 toil completed → currentToilIndex++
   如果所有 toil completed → job.state = Done → 释放 reservations → 清空 ai.currentJob

4. 如果当前 toil failed → 触发 Cleanup Protocol
```

### 8.6 Cleanup Protocol（关键）

当 Job 被中断或失败时，必须执行以下清理步骤：

```
Cleanup Protocol
─────────────────
1. 释放所有 reservations
   for (resId of job.reservations) {
     reservationTable.release(resId);
   }

2. 处理手持物品
   if (pawn.inventory.carrying !== null) {
     // 在 pawn 当前位置创建一个 Item 放回地面
     pool.add(createDroppedItem(pawn.inventory.carrying, pawn.cell));
     pawn.inventory.carrying = null;
   }

3. 重置 pawn AI 状态
   pawn.ai.currentJob = null;
   pawn.ai.currentToilIndex = 0;
   pawn.ai.toilState = {};

4. 清除移动状态
   pawn.movement.path = null;
   pawn.movement.pathIndex = 0;

5. 触发 JobInterrupted 事件（用于 UI 提示和日志）

6. pawn 在下一个 AI_DECISION phase 重新选择 job
```

**任何 Job 实现都不需要自己写 cleanup**——这个协议由 job executor system 统一执行。这确保了不会遗漏 reservation 或遗留物品。

### 8.7 中断触发条件

以下情况会中断当前 Job：

- 目标对象被销毁（建筑被拆、物品被别人拿走）
- Reservation 被更高优先级抢占
- Pawn 受到攻击（自动中断当前工作进入逃跑/反击）
- Need 达到紧急阈值（如 food < 10 → 强制中断去吃东西）
- 玩家手动征召（draft）pawn
- 路径完全不可达（目标被封死）

------

## 九、建造流程（完整协议）

这是一个贯穿多个系统的完整工作流，专门写出来作为"feature 如何横切多个 system"的范例。

### 9.1 生命周期

```
玩家操作              Simulation                      结果
──────────          ──────────                     ──────
点击放置墙壁   ──→  PlaceBlueprintCmd
                    │
                    ▼
              [COMMAND_PROCESSING]
              validate: 位置可放？资源够？
              execute: 创建 Blueprint 对象
                    │
                    ▼
              [WORK_GENERATION]
              扫描到新 Blueprint
              生成两类 work item:
              ├── HaulMaterialWork（搬运材料到工地）
              └── ConstructWork（施工）
                    │
                    ▼
              [AI_DECISION]
              某 pawn 选到 HaulMaterialJob
                    │
                    ▼
              [EXECUTION - 多个 tick]
              Toil: GoTo(material) → PickUp → GoTo(blueprint) → Deliver
              更新 blueprint.materialsDelivered
                    │
              材料全部到齐？
              ├── 否 → 继续等待更多 pawn 搬运
              └── 是 ▼
                    │
              [EXECUTION]
              Blueprint 转换为 ConstructionSite
              ① 销毁 Blueprint 对象
              ② 创建 ConstructionSite 对象（同位置、同 defId）
              ③ 触发 ConstructionStarted 事件
                    │
                    ▼
              [AI_DECISION]
              某 pawn 选到 ConstructJob
                    │
                    ▼
              [EXECUTION - 多个 tick]
              Toil: GoTo(site) → Work（每 tick 增加 buildProgress）
                    │
              buildProgress >= 1.0？
              ├── 否 → 继续
              └── 是 ▼
                    │
              ConstructionSite 转换为 Building
              ① 销毁 ConstructionSite 对象
              ② 创建 Building 对象（hp = maxHp, 完整功能）
              ③ 标记 RoomGraph dirty（可能形成新房间）
              ④ 触发 BuildingCompleted 事件
```

### 9.2 取消建造

```
玩家点击取消   ──→  CancelConstructionCmd
                    │
                    ▼
              [COMMAND_PROCESSING]
              目标是 Blueprint？
              ├── 是 → 直接销毁 Blueprint
              │       已运到现场的材料变为地面 Item
              └── 否 → 目标是 ConstructionSite？
                  ├── 是 → 销毁 ConstructionSite
                  │       材料按比例退回（进度 50% → 退回 50%）
                  │       生成地面 Item
                  └── 否 → 目标是 Building？（拆除，另一个流程）

              所有引用该目标的 Job/Reservation 被中断
              相关 pawn 触发 Cleanup Protocol
```

------

## 十、Reservation 系统

### 10.1 为什么需要 Reservation

防止多个 pawn 同时去搬同一堆材料、或同时去操作同一个工作台。

### 10.2 接口

```typescript
interface ReservationTable {
  // 尝试预订。成功返回 ReservationId，失败返回 null
  tryReserve(req: ReserveRequest): ReservationId | null;

  // 释放
  release(id: ReservationId): void;

  // 查询
  isReserved(targetId: ObjectId): boolean;
  getReservation(targetId: ObjectId): Reservation | null;
  getAllByPawn(pawnId: ObjectId): Reservation[];

  // 清理过期
  cleanupExpired(currentTick: number): void;
}

interface ReserveRequest {
  claimantId: ObjectId;    // pawn
  targetId: ObjectId;      // 要预订的对象
  jobId: JobId;
  maxTick?: number;        // 预订持续的最大 tick 数（默认 5000）
}
```

### 10.3 规则

- 一个对象同一时间只能被一个 pawn 预订（一对一）
- 预订有过期时间，防止 pawn 死亡或卡住后永久占用
- Job cleanup 时必须释放所有 reservation（见 8.6）
- 高优先级 Job 可以"抢占"低优先级 reservation（被抢占的 pawn 触发 Job 中断）

------

## 十一、Event 系统

### 11.1 设计理念

Event 是**单向通知**，不是逻辑驱动器。Event 的消费者只有 Presentation 层、日志系统和 debug 工具。**Simulation 逻辑不监听 Event 做决策。**

为什么？因为如果 System A 发出事件 E，System B 监听 E 来修改状态，那么 A 和 B 之间就有了隐式耦合和不可见的执行顺序依赖，确定性和可理解性都会下降。

### 11.2 接口

```typescript
interface GameEvent {
  type: string;
  tick: number;          // 发生在哪个 tick
  data: Record<string, unknown>;
}

// 具体事件类型
interface BuildingCompletedEvent extends GameEvent {
  type: "building_completed";
  data: { buildingId: ObjectId; defId: DefId; cell: CellCoord };
}

interface PawnJobStartedEvent extends GameEvent {
  type: "pawn_job_started";
  data: { pawnId: ObjectId; jobDefId: DefId };
}

interface CommandRejectedEvent extends GameEvent {
  type: "command_rejected";
  data: { commandType: string; reason: string };
}

// ... 更多事件按需定义
```

### 11.3 事件流

```
[Phase 1~7]
  各 system 执行时将 event push 到 world.eventBuffer

[Phase 8: EVENT_DISPATCH]
  eventDispatcher.dispatch(world.eventBuffer);
  // → 通知所有注册的 listener（UI、logger、debug）
  world.eventBuffer = [];  // 清空
```

### 11.4 EventBus

```typescript
interface EventBus {
  on(type: string, handler: (event: GameEvent) => void): void;
  off(type: string, handler: (event: GameEvent) => void): void;
  dispatch(events: GameEvent[]): void;
}
```

listener 注册在 Presentation 层或 debug 层，不在 Simulation 层。

------

## 十二、序列化与存档

### 12.1 存档结构

```typescript
interface SaveData {
  version: number;               // 存档格式版本，用于向前兼容迁移

  // World 状态
  tick: number;
  clockState: ClockState;        // 游戏内日历
  rngState: number[];            // SeededRandom 的内部状态
  speed: SimSpeed;

  // 地图
  maps: MapSaveData[];

  // 全局
  factions: FactionData[];
  storyState: StoryState;
}

interface MapSaveData {
  id: MapId;
  width: number;
  height: number;
  terrain: TerrainDefId[];       // flat array, row-major
  objects: MapObject[];          // 所有对象的完整数据
  zones: Zone[];
  reservations: Reservation[];   // 可选，也可以加载时清空
}
```

### 12.2 序列化规则

- 所有 MapObject 都是 plain object + interface，天然 JSON.stringify 兼容
- **Set 和 Map 需要转换**：`Set<string>` → `string[]`，`Map<K,V>` → `[K,V][]`
- 对象间引用一律用 ObjectId（字符串），不用直接引用。反序列化后通过 pool 查找
- Def 不进存档，只存 defId。加载时通过 DefDatabase 重新关联
- **以下不存档**（加载时重建或清空）：
  - `pathGrid`（加载后重建）
  - `rooms`（加载后重新检测）
  - `commandQueue`（清空）
  - `eventBuffer`（清空）
  - `commandLog`（可选存档用于回放，默认不存）
  - 所有 Presentation 状态

### 12.3 版本迁移

```typescript
interface SaveMigration {
  fromVersion: number;
  toVersion: number;
  migrate(data: any): any;       // 就地修改 save data
}

// 加载时
function loadSave(raw: string): World {
  let data = JSON.parse(raw);
  while (data.version < CURRENT_SAVE_VERSION) {
    const migration = findMigration(data.version);
    data = migration.migrate(data);
  }
  return deserializeWorld(data);
}
```

------

## 十三、Presentation 层（Phaser 适配器）

### 13.1 职责边界

Phaser 适配层只做三件事：

1. **Input → Command**：将鼠标/键盘输入转化为 Command 推入 world.commandQueue
2. **World → Sprite**：每帧读取 world 状态，同步 sprite 的位置/纹理/可见性
3. **Event → UI**：监听 EventBus，更新 UI 面板、弹出提示、播放音效

### 13.2 RenderSync 机制

```typescript
// 每帧调用
function renderSync(world: World, map: GameMap, scene: Phaser.Scene): void {
  // 1. 同步已有对象
  for (const obj of map.objects.allOfKind(ObjectKind.Pawn)) {
    const sprite = spriteRegistry.get(obj.id);
    if (!sprite) {
      // 新对象 → 创建 sprite
      spriteRegistry.set(obj.id, createSprite(scene, obj));
    } else {
      // 已有 → 更新位置和状态
      updateSprite(sprite, obj);
    }
  }
  // ... 对每种 ObjectKind 重复

  // 2. 清理已销毁对象的 sprite
  for (const [id, sprite] of spriteRegistry) {
    if (!map.objects.get(id)) {
      sprite.destroy();
      spriteRegistry.delete(id);
    }
  }
}
```

### 13.3 Presentation State（纯 UI 状态）

```typescript
interface PresentationState {
  selectedObjectIds: Set<ObjectId>;    // 当前选中的对象
  hoveredCell: CellCoord | null;       // 鼠标悬停的格子
  placementPreview: {                  // 正在放置的蓝图预览
    defId: DefId;
    cell: CellCoord;
    rotation: Rotation;
    valid: boolean;                    // 当前位置是否合法
  } | null;
  activeOverlay: OverlayType | null;   // 当前显示的 overlay（温度、美观度等）
  cameraPosition: { x: number; y: number };
  cameraZoom: number;
}
```

这些状态完全不进入 World，不影响 Simulation，不存档。

------

## 十四、Debug 系统

### 14.1 结构化日志

```typescript
interface LogEntry {
  tick: number;
  channel: LogChannel;             // "ai" | "job" | "command" | "construction" | "path" | ...
  level: "debug" | "info" | "warn" | "error";
  objectId?: ObjectId;             // 关联对象
  systemId?: string;               // 来源 system
  message: string;
  data?: Record<string, unknown>;  // 附加数据
}

// 使用
log.info("ai", `Pawn ${pawn.id} selected job ${job.defId}`, { pawnId: pawn.id, jobId: job.id });
log.warn("construction", `Blueprint ${bp.id} cancelled, refunding materials`, { materials: bp.materialsDelivered });
```

### 14.2 Inspector

提供 query 接口，供 UI 或控制台检查任意对象的当前状态：

```typescript
interface Inspector {
  // 查看对象详情
  inspectObject(id: ObjectId): MapObject | undefined;

  // 查看 pawn 的当前 job
  inspectPawnJob(pawnId: ObjectId): Job | null;

  // 查看某个 cell 上的所有对象
  inspectCell(cell: CellCoord): MapObject[];

  // 查看所有活跃 reservation
  inspectReservations(): Reservation[];

  // 查看某个 pawn 的 AI 决策日志（最近 N 条）
  inspectAILog(pawnId: ObjectId, count: number): LogEntry[];
}
```

### 14.3 Debug Command

所有 debug 操作通过 Command 系统执行（type 以 `debug_` 前缀），这样 debug 操作也会出现在 commandLog 中，方便追踪问题。

------

## 十五、Pathfinding 架构

### 15.1 位置

Pathfinding 是一个 core service，不属于任何 feature，因为多个 feature 都需要寻路。

### 15.2 接口

```typescript
interface PathService {
  // 同步寻路（适合短距离、立即需要结果的场景）
  findPath(map: GameMap, from: CellCoord, to: CellCoord, options?: PathOptions): PathResult;

  // 距离估算（不做完整寻路，用于 job scoring）
  estimateDistance(map: GameMap, from: CellCoord, to: CellCoord): number;

  // 可达性查询
  isReachable(map: GameMap, from: CellCoord, to: CellCoord): boolean;
}

interface PathOptions {
  maxSearchNodes?: number;         // 搜索上限，防止性能爆炸
  avoidDanger?: boolean;           // 是否避开危险区域
  canOpenDoors?: boolean;          // 是否能开门
}

interface PathResult {
  found: boolean;
  path: CellCoord[];               // from → to 的完整路径
  cost: number;                    // 总路径代价
}
```

### 15.3 实现策略

- 算法：A*（格子地图上性能足够）
- 可通行性数据来源：`SpatialIndex.isPassable(cell)` + terrain walkability
- 缓存：不做路径缓存（路径因对象移动频繁失效）。但 `isReachable` 可以用 flood-fill 预计算 region 来加速
- `estimateDistance`：曼哈顿距离或 Chebyshev 距离，不做真实寻路，仅用于 AI scoring 的粗排

------

## 十六、目录结构

```
src/
├── core/                        // 零游戏逻辑的基础设施
│   ├── types.ts                 // ObjectId, CellCoord, DefId 等基础类型
│   ├── object-pool.ts           // ObjectPool 实现
│   ├── spatial-index.ts         // SpatialIndex 实现
│   ├── grid.ts                  // Grid<T> 通用二维数组
│   ├── clock.ts                 // SimulationClock
│   ├── seeded-random.ts         // SeededRandom (Mulberry32)
│   ├── command-bus.ts           // Command 队列 + handler 注册 + 执行
│   ├── event-bus.ts             // EventBus
│   ├── tick-runner.ts           // Tick phase 调度器
│   ├── serialization.ts         // save / load 工具函数
│   ├── logger.ts                // 结构化日志
│   └── inspector.ts             // Debug inspector
│
├── world/                       // World 和 Map 容器
│   ├── world.ts                 // World 接口 + 创建函数
│   ├── game-map.ts              // GameMap 接口 + 创建函数
│   └── def-database.ts          // DefDatabase
│
├── defs/                        // 静态数据定义
│   ├── buildings.ts             // BuildingDef 数据
│   ├── items.ts                 // ItemDef 数据
│   ├── plants.ts                // PlantDef 数据
│   ├── terrains.ts              // TerrainDef 数据
│   ├── jobs.ts                  // JobDef 数据
│   └── index.ts                 // 汇总注册到 DefDatabase
│
├── features/                    // 按领域组织的 feature 模块
│   ├── pawn/
│   │   ├── pawn.types.ts        // Pawn interface, NeedState, SkillLevel 等
│   │   ├── pawn.factory.ts      // createPawn() 工厂函数
│   │   ├── pawn.systems.ts      // need 衰减、mood 计算、schedule 检查
│   │   ├── pawn.commands.ts     // draft, undraft, force_job 等
│   │   └── pawn.queries.ts      // 查询 pawn 状态的只读接口
│   │
│   ├── ai/
│   │   ├── ai.types.ts          // Job, Toil, JobState 等
│   │   ├── job-selector.ts      // utility scoring + job selection
│   │   ├── toil-executor.ts     // toil 状态机推进
│   │   ├── cleanup.ts           // Cleanup Protocol 实现
│   │   └── jobs/                // 具体 Job 定义
│   │       ├── haul-job.ts      // 搬运 job 的 toil 序列生成
│   │       ├── construct-job.ts // 建造 job 的 toil 序列生成
│   │       ├── harvest-job.ts
│   │       ├── mine-job.ts
│   │       └── eat-job.ts
│   │
│   ├── building/
│   │   ├── building.types.ts
│   │   ├── building.factory.ts
│   │   ├── building.systems.ts  // power, storage 等 tick 逻辑
│   │   └── building.queries.ts
│   │
│   ├── construction/
│   │   ├── blueprint.types.ts
│   │   ├── construction-site.types.ts
│   │   ├── construction.system.ts    // Blueprint→Site→Building 转换逻辑
│   │   ├── construction.commands.ts  // place_blueprint, cancel_construction
│   │   └── construction.queries.ts
│   │
│   ├── designation/
│   │   ├── designation.types.ts
│   │   ├── designation.commands.ts   // designate_harvest, designate_mine, ...
│   │   ├── designation.system.ts     // work generation: designation → job candidates
│   │   └── designation.queries.ts
│   │
│   ├── item/
│   │   ├── item.types.ts
│   │   ├── item.factory.ts
│   │   └── item.queries.ts
│   │
│   ├── zone/
│   │   ├── zone.types.ts
│   │   ├── zone.manager.ts     // ZoneManager 实现
│   │   ├── zone.commands.ts
│   │   └── zone.queries.ts
│   │
│   ├── room/
│   │   ├── room.types.ts
│   │   └── room.system.ts      // flood-fill 房间检测 + 重建
│   │
│   ├── plant/
│   │   ├── plant.types.ts
│   │   ├── plant.factory.ts
│   │   └── plant.system.ts     // 生长、枯萎
│   │
│   ├── fire/
│   │   ├── fire.types.ts
│   │   └── fire.system.ts      // 蔓延、烧毁、熄灭
│   │
│   ├── reservation/
│   │   ├── reservation.types.ts
│   │   └── reservation.table.ts // ReservationTable 实现
│   │
│   ├── pathfinding/
│   │   ├── path.types.ts
│   │   ├── path.service.ts     // A* 实现
│   │   └── path.grid.ts        // 可通行性缓存
│   │
│   └── movement/
│       ├── movement.types.ts
│       └── movement.system.ts  // 每 tick 推进 pawn 沿路径移动
│
├── adapter/                     // Phaser 适配层
│   ├── bootstrap.ts             // Phaser.Game 初始化
│   ├── main-scene.ts            // 主 Phaser Scene
│   ├── input/
│   │   ├── input-handler.ts     // 鼠标/键盘 → Command
│   │   └── placement-tool.ts    // 建造放置工具
│   │
│   ├── render/
│   │   ├── render-sync.ts       // World → Sprite 同步
│   │   ├── sprite-registry.ts   // ObjectId → Phaser.Sprite 映射
│   │   └── camera-controller.ts
│   │
│   ├── ui/
│   │   ├── selection-panel.ts   // 选中对象信息面板
│   │   ├── toolbar.ts           // 底部工具栏
│   │   └── speed-controls.ts    // 暂停/加速控制
│   │
│   └── debug/
│       ├── debug-overlay.ts     // 可视化 overlay（zone、room、path 等）
│       └── console.ts           // 开发者控制台
│
├── presentation/                // 纯 UI 状态（不进 simulation）
│   └── presentation-state.ts    // PresentationState 定义与管理
│
└── main.ts                      // 入口：初始化 World + Phaser + 注册 Systems
```

------

## 十七、依赖规则

```
允许的引用方向（→ 表示"可以 import"）：

main.ts → 一切
adapter/ → core/, world/, features/**/queries, features/**/commands, presentation/
presentation/ → core/types 仅限
features/** → core/, world/
core/ → 无外部依赖（纯工具）
world/ → core/
defs/ → core/types 仅限
```

**硬性禁止**：

- `features/**` 不得 import `adapter/` 或 `presentation/`
- `core/` 不得 import 任何其他模块
- `adapter/` 不得直接修改 `MapObject` 的字段（只能通过 Command）
- `features/` 之间可以互相引用 types，但不应形成循环。如果两个 feature 需要双向通信，抽取到 `core/` 或引入新的 shared feature

------

## 十八、启动顺序

```typescript
// main.ts

async function boot() {
  // 1. 加载 Defs
  const defs = buildDefDatabase();

  // 2. 创建 World
  const world = createWorld({ defs, seed: 12345 });

  // 3. 创建初始地图
  const map = createGameMap({ id: "main", width: 100, height: 100 });
  world.maps.set(map.id, map);

  // 4. 地图初始化（生成地形、植被、初始 pawn）
  generateTerrain(map, world.rng);
  spawnInitialPawns(map, world);

  // 5. 注册所有 Systems
  const systems = registerAllSystems();

  // 6. 创建 Tick Runner
  const tickRunner = createTickRunner(world, systems);

  // 7. 创建 EventBus，注册 Presentation listener
  const eventBus = createEventBus();

  // 8. 初始化 Phaser
  const game = new Phaser.Game({
    // ... Phaser config
    scene: createMainScene(world, tickRunner, eventBus),
  });
}
```

------

## 十九、第一版实现路线图

按以下顺序实现。每个阶段完成后应有可运行的验证。

### Phase 0：Core 骨架（~2天）

实现：

- `Grid<T>`
- `SeededRandom`
- `ObjectPool` + `SpatialIndex`
- `CommandBus`
- `EventBus`
- `TickRunner`（phase 调度）
- `Logger`

验证测试：

```
创建 World → 推入 10 个 Command → 跑 100 tick → 断言最终状态
用两个不同种子跑相同 Command → 断言状态不同
用相同种子跑两次 → 断言状态完全相同（确定性测试）
```

### Phase 1：地图 + 地形 + 渲染（~3天）

实现：

- `GameMap` + `terrain` 层
- 简单地形生成（草地 + 岩石 + 土壤）
- Phaser 适配：渲染 tilemap
- Camera 控制（拖拽、缩放）

验证：打开浏览器，看到一张有地形的地图，可以拖拽和缩放。

### Phase 2：Pawn + Movement + 寻路（~3天）

实现：

- `Pawn` 数据类型 + factory
- `PathService`（A*）
- `MovementSystem`
- `RenderSync`（pawn sprite 同步）

验证：生成 3 个 pawn，给每个 pawn 一个随机目标，看到它们寻路移动。

### Phase 3：Command + Designation + 简单 AI（~3天）

实现：

- 完整 `CommandBus` 流程
- `Designation` 系统（先只做 mine）
- `ReservationTable`
- `JobSelector`（简化版，只考虑距离和类型）
- `ToilExecutor` + `CleanupProtocol`

验证：玩家点击岩石 → 产生 MineDesignation → pawn 走过去 → 挖掘 → 岩石消失。

### Phase 4：建造流程（~3天）

实现：

- `Blueprint` + `ConstructionSite` + `Building`
- 完整建造转换协议
- `HaulJob`（搬运材料）
- `ConstructJob`
- 取消建造

验证：玩家放置木墙蓝图 → pawn 搬运木头到蓝图 → 材料齐全后开始施工 → 建造完成出现墙壁 → 房间检测更新。

### Phase 5：存档/读档（~2天）

实现：

- `serialize(world) → SaveData → JSON`
- `deserialize(json) → World`
- 版本迁移框架

验证：存档 → 读档 → 跑 100 tick → 与不存档直接跑到同一 tick 的结果对比 → 状态完全一致。

------

## 二十、禁止事项

1. 在 simulation 层使用 `Math.random()` 或 `Date.now()`
2. MapObject 上定义方法（方法放 System 里）
3. System 之间通过 Event 驱动逻辑（Event 只用于通知 Presentation）
4. 在 `adapter/` 中直接修改 MapObject 字段
5. 跨 feature 的循环 import
6. 在 ObjectPool 之外额外维护对象集合（用 pool 的 index 查询）
7. 用 class 继承来表达对象层级（用 discriminated union）
8. 在 Toil/Job 实现中手写 cleanup 逻辑（统一走 Cleanup Protocol）
9. 不用 string literal 而用 magic number 做类型区分
10. 存档中存储对象直接引用（只能存 ObjectId） <br>

------

*文档版本：v2.0 · 基于 GPT v1 方案修订 · 侧重工程落地*