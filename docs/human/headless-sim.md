# Headless 模拟与场景（无 Phaser）

面向在 CI / Vitest 中运行「与游戏主循环同源逻辑」的自动化校验，以及通过同一套 `ScenarioDefinition` 在浏览器里做**人工验收**。

> **路径说明**：按仓库 `.agent/doc-rules.md`，面向人的上手说明放在 `docs/human/`。若你仍在用旧路径 `docs/headless-sim.md`，请以本文为准。

---

## 快速开始

**方式 A：`createHeadlessSim` + `tick`**

```ts
import { createHeadlessSim } from "../src/headless";
const sim = createHeadlessSim({ seed: 0xdeadbeef });
sim.spawnPawn("Alice", { col: 0, row: 0 });
sim.tick(16);
```

**方式 B：一次性跑场景断言（`runScenarioHeadless`）**

```ts
import { runScenarioHeadless } from "../src/headless";
import { PAWN_EATS_WHEN_HUNGRY_SCENARIO } from "../scenarios/pawn-eats-when-hungry.scenario";
const { results } = runScenarioHeadless(PAWN_EATS_WHEN_HUNGRY_SCENARIO);
```

本地只跑 headless 套件：`npm run test:headless`（对应 `vitest run tests/headless/`）。

---

## API 参考

以下以 `src/headless/headless-sim.ts` 中 **`HeadlessSim` 类型**为准（均为对外公开能力）。

| 成员 | 说明 |
| --- | --- |
| `tick(deltaMs: number)` | 推进一帧模拟；内部在 tick 前后对 pawns / 世界快照做差分并写入事件收集器。 |
| `getTickCount()` | 已执行的 tick 次数。 |
| `getWorldTime()` | 当前领域世界时间快照（随 `tick` 推进）。 |
| `getPawns()` | 当前小人状态数组的副本。 |
| `spawnPawn(name, cell, overrides?)` | 在网格内生成小人并加入模拟。 |
| `runUntil(predicate, options?)` | 循环 `tick` 直至谓词为真或达到 `maxTicks`；返回是否达成与所用 tick 数。 |
| `getSimAccess()` | 调试或高级用法：与编排器共享的 `HeadlessGameOrchestratorSimAccess`。 |
| `getSimEventCollector()` | **自上次 `clear()` 以来**各 tick 产生的结构化事件；实现见 `src/headless/sim-event-log.ts`。 |
| `getWorldPort()` | 可变世界端口（放置蓝图、障碍等 headless 场景写入），类型为 `WorldCoreWorldPort`。 |

工厂与选项：`createHeadlessSim(options?: HeadlessSimOptions)`，可选 `seed`、`worldGrid`、`interactionTemplate`、`simConfig`。

---

## 事件收集

### `SimEventKind`

事件种类（与 `src/headless/sim-event-log.ts` 一致）：

- 小人：`pawn-moved`、`pawn-motion-changed`、`pawn-goal-changed`、`pawn-action-changed`、`pawn-need-changed`
- 工单：`work-created`、`work-claimed`、`work-completed`
- 实体：`entity-spawned`、`entity-removed`

### 差分如何产生

每次调用 `HeadlessSim.tick` 时，实现会：

1. 在 `orchestrator.tick` **之前**拷贝 `simAccess` 中的 pawns 与 `getWorldSnapshot(world)`；
2. 执行 `orchestrator.tick`；
3. 在 **之后**再次取样；
4. 调用 `SimEventCollector.recordPawnDiff(before, after, tickCount)` 与 `recordWorldDiff(before, after, tickCount)`。

因此事件流描述的是「这一帧相对上一帧快照」的领域可见变化，而非 Phaser 层绘制。

### `SimEventCollector` 查询

接口方法：

- `getEvents()`：全部事件（只读数组视图语义以实现为准）。
- `getEventsByKind(kind)`：按事件类型过滤。
- `getEventsByPawn(pawnId)`：与某小人相关的事件（含 `work-claimed` 中 `claimedBy` 匹配等规则）。
- `summary()`：总数与各 `kind` 计数。
- `clear()`：清空已收集事件（之后从新 tick 重新累积）。

新建收集器：`createSimEventCollector()`（headless 模块亦导出）。

---

## 场景定义格式

类型定义见 `src/headless/scenario-types.ts`。

### `ScenarioDefinition`

| 字段 | 说明 |
| --- | --- |
| `name` | 场景短名（调试、列表展示）。 |
| `description` | 人类可读说明。 |
| `seed` | 32 位种子，驱动 headless 层 `createSeededRng`；浏览器载入场景时 loader **不消费**该字段。 |
| `gridConfig?` | 可选 `WorldGridConfig`；与 `createHeadlessSim` / `WorldCore` 网格一致时才可用。浏览器侧若与当前 `world.grid` 不一致会抛错（见 `scenario-loader`）。 |
| `pawns` | `{ name, cell, overrides? }[]`；`overrides` 可为 `satiety` / `energy` / `needs` 的子集，与规划器选目标一致。 |
| `blueprints?` | `{ kind: BuildingKind, cell }[]`。 |
| `obstacles?` | `{ cell, label? }[]`。 |
| `timeConfig?` | 例如 `{ startMinuteOfDay?: number }`，用于对齐时段行为。 |
| `expectations?` | 若干 `ScenarioExpectation`；仅 headless runner 使用，**载入游戏时可忽略**。 |

### `ScenarioExpectation`

| 字段 | 说明 |
| --- | --- |
| `label` | 断言描述（报告与失败信息）。 |
| `type` | `pawn-reaches-goal` \| `event-occurred` \| `no-pawn-starved` \| `work-item-exists` \| `custom`。 |
| `params` | 各 `type` 对应的参数（如 `goalKind`、`pawnId` / `pawnName`、`eventKind`、`minSatiety`、`workKind`、`status`、`immediatePass` 等）；详见 `src/headless/scenario-runner.ts` 中 `expectationSatisfied`。 |
| `maxTicks?` | 单条期望的 tick 预算；省略时 runner 默认 `500`。 |

`params` 里若涉及小人目标种类，应与规划里 `GoalKind`（`eat` / `sleep` / `recreate` / `wander` 等）一致（见 `scenario-types.ts` 注释）。

---

## 自动测试模板

推荐分工：

1. **`scenarios/<name>.scenario.ts`**：导出 `ScenarioDefinition` 常量（数据与期望集中一处）。
2. **`tests/headless/<name>.test.ts`**：薄测试文件，仅 `import` 场景并调用 `runScenarioHeadless`，断言 `results.every(r => r.passed)` 或检查 `report`。

仓库内可参考：

- `scenarios/pawn-eats-when-hungry.scenario.ts`
- `tests/headless/pawn-eats-when-hungry.test.ts`

---

## 人工验收

在带 Phaser 的播放器中，可将同一份 `ScenarioDefinition` 载入**真实** `WorldCore`，用于**人工验收**行为与布局是否直观正确。

- `listAvailableScenarios()`：`src/player/scenario-loader.ts`，返回 `ScenarioDefinition[]`（自 `scenarios/index` 静态汇总）。
- `loadScenarioIntoGame(world, def)`：将障碍、蓝图、小人实体与时间配置写入世界；**忽略** `expectations`。
- 游戏内右下角选择场景后，HUD 会显示 `def.description` 以及可选字段 **`manualAcceptance`**（`steps` / `outcomes`）：用于人工对照的操作流程与期望现象，与 Vitest 中 `expectations` 语义对齐但不自动判定。

返回类型 `ScenarioLoadResult`：

- `world`：更新后的 `WorldCore`；调用方必须用该引用**替换**手头持有的 world（与域命令应用后的惯例相同）。
- `pawnStates`：与 `def.pawns` **顺序一致**的 `PawnState[]`（含 `overrides` 后的饱食度等），供 `GameOrchestrator` / UI 同步。

**务必同步**：拿到 `ScenarioLoadResult` 后，既要更新领域 `world`，也要用 `pawnStates` 重置或对齐运行时小人状态数组；只改其一会出现「世界里有实体但操控状态仍是旧小人」等不一致。

---

## Agent 工作流标准步骤

建议在自动化修改领域逻辑或场景数据时，按顺序做一次闭环：

1. **读类型与 runner**：`src/headless/scenario-types.ts`、`scenario-runner.ts`、`sim-event-log.ts`，确认期望 `type` / `params` 仍合法。
2. **新增或调整 `.scenario.ts`**，必要时扩展 `scenarios/index.ts` 导出。
3. **补 `.test.ts`**：调用 `runScenarioHeadless`，断言全部期望通过。
4. **执行 `npm run test:headless`**，必要时全量 `npm test`。
5. **人工验收**：对玩家可见变化，用 `loadScenarioIntoGame` + `listAvailableScenarios` 在浏览器侧核对；检查 `ScenarioLoadResult` 的 `world` 与 `pawnStates` 是否都被接入。

---

## 已知假设与限制

- Headless 路径不挂载 Phaser；`GameOrchestratorHooks` 在 headless 中为 no-op，仅领域与编排逻辑运行。
- `ScenarioDefinition.expectations` 只对 `runScenarioHeadless` 有意义；浏览器载入须另行驱动 `tick` 或手工观察。
- `def.seed` 不影响 `loadScenarioIntoGame` 内的 `WorldCore`（loader 明确不处理 RNG 种子）。
