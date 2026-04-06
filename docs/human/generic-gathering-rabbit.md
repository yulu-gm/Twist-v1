# Headless Game Simulation — 实施计划

## Context

项目是一个 Phaser + TypeScript 的殖民地模拟游戏。现有单测只覆盖纯函数/数据层，无法验证"启动游戏 → 小人自主行动 → 观察结果"的端到端行为。

**目标：** 构建一个无浏览器的 Headless Sim，让 agent 实现功能后可以编写场景测试（放小人、摆建筑、推进时间、观察行为 log），用 `vitest run` 验证功能正确性。

**关键发现：** `GameOrchestrator.tick()` 已完全与 Phaser 解耦。它的 Phaser 依赖仅通过两个接口注入：
- `GameOrchestratorHooks`（8 个渲染回调）→ 全部替换为空函数
- `GameOrchestratorSimAccess`（状态读写）→ 用内存对象替代

因此 HeadlessSim 的核心就是：**用内存状态 + 空回调包装现有的 GameOrchestrator**，零重复逻辑。

---

## 文件结构总览

```
src/headless/
  headless-sim.ts           # Task 2 — 主入口
  headless-sim-access.ts    # Task 2 — 内存 SimAccess
  sim-event-log.ts          # Task 3 — 结构化事件收集
  sim-reporter.ts           # Task 4 — JSON 报告
  scenario-helpers.ts       # Task 5 — 谓词与断言工具
  index.ts                  # barrel export

tests/headless/
  pawn-eats-when-hungry.test.ts    # Task 6
  pawn-sleeps-when-tired.test.ts   # Task 6
  build-bed-flow.test.ts           # Task 6
  multi-pawn-colony.test.ts        # Task 6
```

---

## 任务依赖图

```
Task 1 (seeded RNG)
  └─► Task 2 (HeadlessSim 核心)
        ├─► Task 3 (事件收集器)
        │     └─► Task 4 (JSON 报告器)
        ├─► Task 5 (场景辅助工具) ← 依赖 Task 3, 4
        └─► Task 6 (示例场景测试) ← 依赖 Task 2-5
              └─► Task 7 (npm scripts + 文档)
```

---

## Task 1：确定性随机数生成器

### 目标
提供可种子化的 RNG，替代 `Math.random`，确保测试可复现。

### 要创建的文件
- `src/game/util/seeded-rng.ts`
- `tests/domain/seeded-rng.test.ts`

### 实现

```typescript
// src/game/util/seeded-rng.ts
export function createSeededRng(seed: number): () => number
```

使用 mulberry32 算法，返回 `() => number`（输出范围 `[0, 1)`）。

### 测试验收标准
- 相同 seed 调用 100 次，两次生成的序列完全相同
- 不同 seed 生成不同序列
- 输出范围在 `[0, 1)` 内

### 依赖
无

---

## Task 2：HeadlessSim 核心

### 目标
用内存状态 + 空回调包装 `GameOrchestrator`，提供无浏览器的游戏循环。

### 要创建的文件
- `src/headless/headless-sim-access.ts`
- `src/headless/headless-sim.ts`
- `src/headless/index.ts`
- `tests/headless/headless-sim-basic.test.ts`

### 关键复用（不要重写）

| 需要的功能 | 来源文件 | 函数/类 |
|---|---|---|
| 游戏主循环 | `src/game/game-orchestrator.ts` | `createGameOrchestrator`, `GameOrchestrator` |
| SimAccess 接口 | `src/game/game-orchestrator.ts` | `GameOrchestratorSimAccess`, `GameOrchestratorHooks` |
| 世界状态管理 | `src/game/world-core.ts` | `createWorldCore`, `spawnWorldEntity`, `getWorldSnapshot`, `placeBlueprint`, `placeTaskMarker` |
| 世界桥接 | `src/player/world-core-world-port.ts` | `WorldCoreWorldPort`（实现 `OrchestratorWorldBridge`） |
| 网格同步 | `src/game/world-sim-bridge.ts` | `syncWorldGridForSimulation` |
| 小人状态 | `src/game/pawn-state.ts` | `PawnState`, `createDefaultPawnStates` |
| 预订管理 | `src/game/map/world-grid.ts` | `createReservationSnapshot`, `ReservationSnapshot`, `DEFAULT_WORLD_GRID` |
| 时间系统 | `src/game/time/time-of-day.ts` | `DEFAULT_TIME_CONTROL_STATE`, `sampleTimeOfDayPalette` |
| 模拟配置 | `src/game/behavior/` | `DEFAULT_SIM_CONFIG` |
| 确定性 RNG | Task 1 | `createSeededRng` |

### headless-sim-access.ts 实现

`GameOrchestratorSimAccess` 的内存实现——用闭包持有 mutable 变量，提供 getter/setter：

```typescript
export function createHeadlessSimAccess(options: {
  initialPawns: PawnState[];
  initialTimeControl: TimeControlState;
}): GameOrchestratorSimAccess & {
  // 额外暴露给 HeadlessSim 的直接访问器
  getPawnsRef(): PawnState[];
  getReservationsRef(): ReservationSnapshot;
}
```

内部持有：`pawns: PawnState[]`, `reservations: ReservationSnapshot`, `timeOfDayState`, `timeOfDayPalette`, `timeControlState`, `simGridSyncState`。

### headless-sim.ts 实现

```typescript
export type HeadlessSimOptions = {
  seed?: number;                    // 默认 42
  gridConfig?: WorldGridConfig;     // 默认 DEFAULT_WORLD_GRID
  simConfig?: SimConfig;            // 默认 DEFAULT_SIM_CONFIG
  timeConfig?: { realSecondsPerDay?: number; startMinuteOfDay?: number };
  timeControl?: TimeControlState;   // 默认 { paused: false, speed: 1 }
  collector?: SimEventCollector;    // Task 3，可选
};

export interface HeadlessSim {
  // --- 核心循环 ---
  tick(deltaMs: number): void;
  tickSeconds(dt: number): void;
  runTicks(count: number, deltaMs?: number): void;     // deltaMs 默认 16.67
  runUntil(
    predicate: (sim: HeadlessSim) => boolean,
    options?: { maxTicks?: number; deltaMs?: number }
  ): { reachedPredicate: boolean; ticksRun: number };

  // --- 状态查看 ---
  getSnapshot(): HeadlessSnapshot;
  getPawns(): readonly PawnState[];
  getWorldSnapshot(): WorldSnapshot;
  getTickCount(): number;

  // --- 世界操作 ---
  spawnPawn(name: string, cell: GridCoord, overrides?: Partial<PawnState>): PawnState;
  spawnObstacle(cell: GridCoord, label?: string): string;
  placeBlueprint(kind: BuildingKind, cell: GridCoord): { blueprintEntityId: string; workItemId: string };

  // --- 小人状态操作 ---
  mutatePawn(pawnId: string, fn: (p: PawnState) => PawnState): void;

  // --- 时间控制 ---
  setSpeed(speed: 1 | 2 | 3): void;
  pause(): void;
  unpause(): void;

  // --- 事件（需 collector） ---
  getEvents(): readonly SimEvent[];
}

export function createHeadlessSim(options?: HeadlessSimOptions): HeadlessSim;
```

### 关键实现细节

**no-op hooks：**
```typescript
const NOOP_HOOKS: GameOrchestratorHooks = {
  onPaletteChanged: () => {},
  syncTimeHud: () => {},
  redrawStoneCells: () => {},
  redrawInteractionPoints: () => {},
  syncPawnViews: () => {},
  syncMarkerOverlay: () => {},
  syncHoverFromPointer: () => {},
  syncPawnDetailPanel: () => {},
};
```

**createHeadlessSim 初始化流程：**
1. `createSeededRng(seed)` 生成 rng
2. `createWorldCore({ grid, timeState, timeConfig })` 创建世界
3. `new WorldCoreWorldPort(world)` 创建 bridge
4. `createHeadlessSimAccess(...)` 创建内存状态持有器
5. `createGameOrchestrator({ worldPort, worldGrid, interactionTemplate, sim: simAccess, simConfig, rng, hooks: NOOP_HOOKS })` 创建编排器
6. `orchestrator.bootstrapSimulationGrid()` 初始化网格同步

**spawnPawn 实现：**
用 `createDefaultPawnStates` 的模式手动构造单个 `PawnState`，自增 pawnId（`pawn-0`, `pawn-1`, ...），追加到 simAccess 的 pawns 数组。支持 `overrides` 以便设定初始 satiety/energy。

**tick 实现（含事件收集）：**
```typescript
tick(deltaMs) {
  const before = collector ? captureState() : null;
  orchestrator.tick(deltaMs);
  tickCount++;
  if (collector && before) {
    const after = captureState();
    collector.recordPawnDiff(tickCount, before.pawns, after.pawns);
    collector.recordWorldDiff(tickCount, before.world, after.world);
  }
}
```

### 测试验收标准
- `createHeadlessSim()` 不抛异常
- `sim.tick(16)` 推进时间，`sim.getSnapshot().world.time.minuteOfDay` 有变化
- `sim.spawnPawn("Alex", {col:5,row:5})` 后 `sim.getPawns().length === 1`
- `sim.runUntil(() => sim.getTickCount() >= 100)` 返回 `{ reachedPredicate: true, ticksRun: 100 }`
- 两个相同 seed 的 sim 跑 200 tick 后 pawn 位置完全一致（确定性验证）
- 整个测试文件 import 链不包含任何 `phaser` 模块

### 依赖
Task 1

---

## Task 3：结构化事件收集器

### 目标
对比每个 tick 前后的状态 diff，生成结构化事件流，供测试断言和 agent 阅读。

### 要创建的文件
- `src/headless/sim-event-log.ts`
- `tests/headless/sim-event-log.test.ts`

### 实现

```typescript
export type SimEventKind =
  | "pawn-spawned"
  | "pawn-goal-changed"
  | "pawn-action-changed"
  | "pawn-moved"
  | "pawn-need-change"
  | "work-created"
  | "work-claimed"
  | "work-completed"
  | "work-failed"
  | "entity-spawned"
  | "entity-removed";

export type SimEvent = Readonly<{
  tick: number;
  kind: SimEventKind;
  pawnId?: string;
  detail: Record<string, unknown>;
}>;

export interface SimEventCollector {
  recordPawnSpawn(tick: number, pawn: PawnState): void;
  recordPawnDiff(tick: number, before: readonly PawnState[], after: readonly PawnState[]): void;
  recordWorldDiff(tick: number, before: WorldSnapshot, after: WorldSnapshot): void;

  getEvents(): readonly SimEvent[];
  getEventsByKind(kind: SimEventKind): readonly SimEvent[];
  getEventsByPawn(pawnId: string): readonly SimEvent[];
  summary(): string;   // 人类可读的单行摘要
  clear(): void;
}

export function createSimEventCollector(): SimEventCollector;
```

### Diff 检测逻辑

**Pawn diff（逐 pawn 对比 before/after）：**
- `logicalCell` 变化 → `pawn-moved` + `{ from, to }`
- `currentGoal?.kind` 变化 → `pawn-goal-changed` + `{ prevGoal, nextGoal }`
- `currentAction?.kind` 变化 → `pawn-action-changed` + `{ prevAction, nextAction }`
- `satiety` 或 `energy` 越过阈值（20, 50, 80）→ `pawn-need-change`

**World diff（对比 before/after WorldSnapshot）：**
- workItems 新增 → `work-created`
- workItem status 从 `open` 变为 `claimed` → `work-claimed`
- workItem status 变为 `completed` → `work-completed`
- entities 新增 → `entity-spawned`
- entities 消失 → `entity-removed`

### 测试验收标准
- 创建 sim + collector，spawn pawn，跑 200 tick
- `getEventsByKind("pawn-moved")` 返回非空（pawn 一定会动）
- `getEventsByKind("pawn-goal-changed")` 有记录
- `getEventsByPawn("pawn-0")` 只包含该 pawn 的事件
- `summary()` 返回类似 `"200 ticks, 45 events (12 moved, 8 goal-changed, ...)"` 的字符串

### 依赖
Task 2

---

## Task 4：JSON 报告器

### 目标
将模拟结果输出为结构化 JSON，供 agent 程序化解析。

### 要创建的文件
- `src/headless/sim-reporter.ts`

### 实现

```typescript
export type SimReport = {
  seed: number;
  totalTicks: number;
  finalDay: number;
  finalMinuteOfDay: number;
  pawnSummaries: PawnSummary[];
  eventCounts: Record<SimEventKind, number>;
  events: readonly SimEvent[];       // 完整事件流
  assertions: AssertionResult[];
};

export type PawnSummary = {
  id: string;
  name: string;
  finalCell: GridCoord;
  satiety: number;
  energy: number;
  goalSequence: string[];   // 按时间顺序去重的 goal kind 列表
};

export type AssertionResult = {
  label: string;
  passed: boolean;
  detail?: string;
};

export function generateReport(
  sim: HeadlessSim,
  assertions?: AssertionResult[]
): SimReport;
```

### 测试验收标准
- `JSON.parse(JSON.stringify(generateReport(sim)))` 无异常
- `report.pawnSummaries.length` 等于 spawn 的 pawn 数
- 不依赖测试框架本身（纯函数）

### 依赖
Task 2, 3

---

## Task 5：场景辅助工具

### 目标
提供常用的 predicate 和 assertion builder，让场景测试代码简洁可读。

### 要创建的文件
- `src/headless/scenario-helpers.ts`

### 实现

```typescript
// ---- runUntil 谓词 ----
export function pawnReachesCell(pawnId: string, cell: GridCoord): (sim: HeadlessSim) => boolean;
export function pawnStartsGoal(pawnId: string, goalKind: GoalKind): (sim: HeadlessSim) => boolean;
export function anyPawnStartsGoal(goalKind: GoalKind): (sim: HeadlessSim) => boolean;
export function allWorkCompleted(): (sim: HeadlessSim) => boolean;
export function gameTimeReaches(minuteOfDay: number): (sim: HeadlessSim) => boolean;
export function dayReaches(dayNumber: number): (sim: HeadlessSim) => boolean;

// ---- 断言 ----
export function assertPawnAtCell(sim: HeadlessSim, pawnId: string, cell: GridCoord): AssertionResult;
export function assertEventOccurred(sim: HeadlessSim, kind: SimEventKind): AssertionResult;
export function assertWorkItemCompleted(sim: HeadlessSim, workItemId: string): AssertionResult;
export function assertNoPawnStarved(sim: HeadlessSim): AssertionResult;

// ---- 快捷设置 ----
export function spawnDefaultColony(sim: HeadlessSim, count?: number): PawnState[];
```

### 测试验收标准
- `pawnReachesCell("pawn-0", {col:5,row:7})` 返回一个函数
- 与 `sim.runUntil(...)` 组合使用时正确终止

### 依赖
Task 2, 3, 4

---

## Task 6：示例场景测试

### 目标
用 4 个场景测试验证整个 headless sim 体系可用，并作为后续测试的模板。

### 要创建的文件

**`tests/headless/pawn-eats-when-hungry.test.ts`**
```
场景：spawn 1 pawn，手动设 satiety=5。
期望：pawn 在 500 tick 内产生 goal=eat 的事件。
```

**`tests/headless/pawn-sleeps-when-tired.test.ts`**
```
场景：spawn 1 pawn，手动设 energy=5。
期望：pawn 在 500 tick 内产生 goal=sleep 的事件。
```

**`tests/headless/build-bed-flow.test.ts`**
```
场景：通过 sim.placeBlueprint("bed", cell) 放蓝图，创建 work item。
期望：workItem 存在于 worldSnapshot，status=open。
      （注意：当前 sim-loop 的 tickSimulation 不会自动 claim world-core 的 workItem，
       这是已知的领域分离——work-registry 和 world-core workItems 是两套系统。
       此测试验证蓝图放置 + workItem 创建链路即可。）
```

**`tests/headless/multi-pawn-colony.test.ts`**
```
场景：spawnDefaultColony(sim, 3)，跑 2000 tick。
期望：
  - 所有 pawn satiety > 0（没饿死）
  - 事件流中至少有一次 pawn-goal-changed
  - JSON report 可成功生成并解析
```

### 测试验收标准
- `vitest run tests/headless/` 全部通过
- 所有测试在 3 秒内完成
- 每个测试文件头部注释说明场景目的（供其他 agent 参考模板）

### 依赖
Task 1-5

---

## Task 7：npm scripts + agent 工作流接入

### 要修改的文件
- `package.json` — 加 `"test:headless": "vitest run tests/headless/"`

### 要创建的文件
- `docs/headless-sim.md` — 使用文档（API 速查 + 场景测试编写模板）

### docs/headless-sim.md 内容大纲

1. **快速开始** — 3 行代码跑起一个 headless sim
2. **API 参考** — `HeadlessSim` 接口全部方法，每个一句话说明
3. **事件收集** — 支持的事件类型、查询方法
4. **场景测试模板** — 可直接复制的完整测试文件骨架
5. **Agent 工作流** — agent 在实现功能后如何编写+运行场景测试的标准步骤

### Agent 工作流标准步骤（写入文档）

```
1. 实现功能代码
2. 在 tests/headless/ 下新建 xxx-scenario.test.ts
3. import { createHeadlessSim } from "../../src/headless"
4. 构造场景（spawn pawn/entity、设定初始状态）
5. sim.runUntil(谓词) 或 sim.runTicks(N)
6. 用 expect 断言最终状态或 collector 事件
7. 运行 npx vitest run tests/headless/xxx-scenario.test.ts
8. 若失败，根据事件流定位问题并修复
```

### 验收标准
- `npm run test:headless` 能正常运行
- 文档内容完整可操作

### 依赖
Task 6

---

## 验证方式

全部完成后的端到端验证：

```bash
# 1. 全量测试通过（包括原有 246 个 + 新增 headless 测试）
npm test

# 2. headless 测试单独通过
npm run test:headless

# 3. 确定性验证：跑两次结果一致
npx vitest run tests/headless/multi-pawn-colony.test.ts
npx vitest run tests/headless/multi-pawn-colony.test.ts
```
