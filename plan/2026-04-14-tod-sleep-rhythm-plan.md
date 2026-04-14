# TOD 睡眠节律实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为项目补齐可复用的 TOD 派生能力、昼夜视觉过渡，以及“夜间偏向睡眠但允许个体晚睡”的小人行为节律。

**Architecture:** 继续以 `src/core/clock.ts` 作为唯一时间源，在其上增加纯函数 TOD 派生；以 `PawnChronotype` 承载个体作息差异，并由睡眠评估器消费 `clock + chronotype + needs` 联合算分；昼夜过渡仅落在 `adapter/render` 表现层，不反向写入 simulation。

**Tech Stack:** TypeScript、Vitest、Vitest Scenario Harness、Phaser、现有 `features/pawn` / `features/ai` / `adapter/render` 架构。

---

**执行要求：**

- 全程遵循 `@test-driven-development`
- 完成前执行 `@verification-before-completion`
- 如果测试失败且原因不明，先用 `@systematic-debugging`
- 不新增第二套时间状态，不把表现层逻辑写回 simulation

### Task 1: TOD 派生模型

**Files:**
- Modify: `src/core/clock.ts`
- Create: `src/core/clock.tod.test.ts`

**Step 1: 先写失败测试**

```ts
import { createClock, getTimeOfDayState } from './clock';

describe('getTimeOfDayState', () => {
  it('在白天返回 day 和较高 daylightLevel', () => {
    const clock = createClock();
    clock.hour = 12;
    expect(getTimeOfDayState(clock).timeSegment).toBe('day');
  });

  it('在夜晚返回 night 和较低 daylightLevel', () => {
    const clock = createClock();
    clock.hour = 1;
    expect(getTimeOfDayState(clock).timeSegment).toBe('night');
  });
});
```

**Step 2: 运行测试，确认先失败**

Run: `npx vitest run src/core/clock.tod.test.ts`

Expected: FAIL，提示 `getTimeOfDayState` 或 `TimeOfDayState` 不存在。

**Step 3: 写最小实现**

```ts
export interface TimeOfDayState {
  hourFloat: number;
  timeSegment: 'dawn' | 'day' | 'dusk' | 'night';
  daylightLevel: number;
  isNight: boolean;
}

export function getHourFloat(clock: SimulationClock): number {
  return clock.hour;
}
```

再补上：

- `getTimeOfDayState(clock)`
- `isHourWithinWindow(hourFloat, startHour, endHour)`
- 黎明 / 黄昏插值逻辑

**Step 4: 再跑测试，确认通过**

Run: `npx vitest run src/core/clock.tod.test.ts`

Expected: PASS

**Step 5: 提交**

```bash
git add src/core/clock.ts src/core/clock.tod.test.ts
git commit -m "feat: add TOD derived clock helpers"
```

### Task 2: Pawn Chronotype 与排班生成

**Files:**
- Modify: `src/features/pawn/pawn.types.ts`
- Modify: `src/features/pawn/pawn.factory.ts`
- Modify: `src/features/pawn/pawn.systems.ts`
- Create: `src/features/pawn/pawn.chronotype.test.ts`

**Step 1: 先写失败测试**

```ts
import { createPawn } from './pawn.factory';

it('为普通 pawn 生成默认 chronotype 与 schedule', () => {
  const pawn = createPawn(/* 复用现有最小参数 */);
  expect(pawn.chronotype.sleepStartHour).toBeGreaterThanOrEqual(21);
  expect(pawn.chronotype.sleepStartHour).toBeLessThanOrEqual(24);
  expect(pawn.schedule.entries).toHaveLength(24);
});

it('night_owl 比普通 pawn 更晚睡', () => {
  const normal = createPawn(/* normal */);
  const owl = createPawn(/* traitIds: ['night_owl'] */);
  expect(owl.chronotype.sleepStartHour).toBeGreaterThan(normal.chronotype.sleepStartHour);
});
```

**Step 2: 运行测试，确认先失败**

Run: `npx vitest run src/features/pawn/pawn.chronotype.test.ts`

Expected: FAIL，提示 `chronotype` 字段不存在，或默认 schedule 仍是旧逻辑。

**Step 3: 写最小实现**

```ts
export interface PawnChronotype {
  scheduleShiftHours: number;
  sleepStartHour: number;
  sleepDurationHours: number;
  sleepEndHour: number;
  nightOwlBias: number;
}
```

实现要点：

- 在 `pawn.types.ts` 上新增 `chronotype`
- 在 `pawn.factory.ts` 中基于基础模板 + 随机偏移生成 chronotype
- 保持 `schedule.entries` 为 chronotype 的 24 小时镜像
- 在 `pawn.systems.ts` 中为 `night_owl`、`high_energy` 增加 trait 修正
- 保留 `light_sleeper` / `hardy` 现有职责

**Step 4: 再跑测试，确认通过**

Run: `npx vitest run src/features/pawn/pawn.chronotype.test.ts src/features/pawn/pawn.systems.test.ts`

Expected: PASS

**Step 5: 提交**

```bash
git add src/features/pawn/pawn.types.ts src/features/pawn/pawn.factory.ts src/features/pawn/pawn.systems.ts src/features/pawn/pawn.chronotype.test.ts
git commit -m "feat: add pawn chronotype and schedule generation"
```

### Task 3: 睡眠评估接入 TOD 与个体作息

**Files:**
- Modify: `src/features/ai/work-evaluators/needs.evaluator.ts`
- Modify: `src/features/ai/work-evaluators/evaluators.test.ts`
- Optional Modify: `src/features/ai/sleep.behavior.test.ts`

**Step 1: 先写失败测试**

```ts
it('夜间普通 pawn 会比夜猫子更早获得睡眠偏置', () => {
  // 构造相同 rest，不同 trait，不同 chronotype
  // 断言 normal 的 sleep score > night_owl
});

it('高精力 pawn 在夜间仍可能保持非睡眠，但最终不会完全失去睡眠意愿', () => {
  // 构造 high_energy，断言分数差异存在但非永久压制
});
```

**Step 2: 运行测试，确认先失败**

Run: `npx vitest run src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/sleep.behavior.test.ts`

Expected: FAIL，旧实现仍只看 `rest` 阈值。

**Step 3: 写最小实现**

```ts
const tod = getTimeOfDayState(world.clock);
const restPressure = /* 基于 rest 的压力 */;
const schedulePressure = /* 基于个人睡眠窗口 */;
const nightBias = tod.isNight ? /* 正向睡眠偏置 */ : 0;
const score = base + restPressure + schedulePressure + nightBias + pawn.chronotype.nightOwlBias;
```

实现要求：

- 保留现有“有床优先，无床回退”的链路
- 不把普通工作统一夜间降权，先只增强睡眠打分
- 极度疲劳时仍应稳定触发睡眠

**Step 4: 再跑测试，确认通过**

Run: `npx vitest run src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/sleep.behavior.test.ts`

Expected: PASS

**Step 5: 提交**

```bash
git add src/features/ai/work-evaluators/needs.evaluator.ts src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/sleep.behavior.test.ts
git commit -m "feat: drive sleep evaluation with TOD and chronotype"
```

### Task 4: Scenario 验收与测试支撑

**Files:**
- Modify: `src/testing/scenario-fixtures/world-fixtures.ts`
- Modify: `src/testing/scenario-probes/pawn-probes.ts`
- Modify: `src/testing/scenario-dsl/scenario.types.ts`
- Modify: `src/testing/scenario-probes/query-api.ts`
- Create: `src/testing/scenarios/tod-sleep-rhythm.scenario.ts`
- Create: `src/testing/headless/tod-sleep-rhythm.scenario.test.ts`
- Modify: `src/testing/scenario-registry.ts`

**Step 1: 先写失败场景与断言**

```ts
export const todSleepRhythmScenario = createScenario({
  id: 'tod-sleep-rhythm',
  title: '普通人早睡，夜猫子和高精力小人晚睡',
  // setup: 傍晚起步，3 个 pawn，足够床位和食物
  // script: 等待 normal 先睡，再等待特殊 pawn 延后入睡
  // expect: 最终全部恢复 rest，床位与 reservation 干净
});
```

**Step 2: 运行场景测试，确认先失败**

Run: `npm run test:scenario -- src/testing/headless/tod-sleep-rhythm.scenario.test.ts`

Expected: FAIL，缺少场景、fixture、probe 或行为尚未满足断言。

**Step 3: 写最小支撑实现**

需要补的能力：

- fixture：设置起始时钟到傍晚
- fixture：按 trait 生成指定 pawn
- probe：读取 pawn 当前 `rest`、当前 `jobDefId`、chronotype 或当前小时
- registry：注册新 scenario

**Step 4: 再跑场景测试，确认通过**

Run: `npm run test:scenario -- src/testing/headless/tod-sleep-rhythm.scenario.test.ts`

Expected: PASS

**Step 5: 提交**

```bash
git add src/testing/scenario-fixtures/world-fixtures.ts src/testing/scenario-probes/pawn-probes.ts src/testing/scenario-dsl/scenario.types.ts src/testing/scenario-probes/query-api.ts src/testing/scenarios/tod-sleep-rhythm.scenario.ts src/testing/headless/tod-sleep-rhythm.scenario.test.ts src/testing/scenario-registry.ts
git commit -m "test: add TOD sleep rhythm scenario coverage"
```

### Task 5: 昼夜视觉过渡

**Files:**
- Create: `src/adapter/render/daylight-visuals.ts`
- Create: `src/adapter/render/daylight-visuals.test.ts`
- Create: `src/adapter/render/day-night-overlay.ts`
- Modify: `src/adapter/render/render-sync.ts`
- Modify: `src/adapter/main-scene.ts`

**Step 1: 先写失败测试**

```ts
import { getDaylightVisualState } from './daylight-visuals';

it('白天的遮罩透明度应低于夜晚', () => {
  const day = getDaylightVisualState({ daylightLevel: 1, timeSegment: 'day', isNight: false, hourFloat: 12 });
  const night = getDaylightVisualState({ daylightLevel: 0, timeSegment: 'night', isNight: true, hourFloat: 1 });
  expect(day.alpha).toBeLessThan(night.alpha);
});
```

**Step 2: 运行测试，确认先失败**

Run: `npx vitest run src/adapter/render/daylight-visuals.test.ts`

Expected: FAIL，文件或函数不存在。

**Step 3: 写最小实现**

```ts
export function getDaylightVisualState(tod: TimeOfDayState) {
  return {
    color: 0x0f1b2d,
    alpha: 1 - tod.daylightLevel,
  };
}
```

再实现：

- `DayNightOverlay`：包装 Phaser 图层遮罩
- `RenderSync` 中持有 overlay 实例
- `MainScene.update()` 或 `RenderSync.sync()` 中按帧刷新

**Step 4: 再跑测试，确认通过**

Run: `npx vitest run src/adapter/render/daylight-visuals.test.ts`

Expected: PASS

**Step 5: 提交**

```bash
git add src/adapter/render/daylight-visuals.ts src/adapter/render/daylight-visuals.test.ts src/adapter/render/day-night-overlay.ts src/adapter/render/render-sync.ts src/adapter/main-scene.ts
git commit -m "feat: add day night presentation overlay"
```

### Task 6: 全量回归与收尾验证

**Files:**
- Review only: `src/testing/headless/scenario-regression.test.ts`
- Review only: `docs/testing/scenario-testing.md`

**Step 1: 跑单测与行为测试**

Run: `npx vitest run src/core/clock.tod.test.ts src/features/pawn/pawn.chronotype.test.ts src/features/pawn/pawn.systems.test.ts src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/sleep.behavior.test.ts src/adapter/render/daylight-visuals.test.ts`

Expected: 全部 PASS

**Step 2: 跑新增场景和关键回归**

Run: `npm run test:scenario -- src/testing/headless/tod-sleep-rhythm.scenario.test.ts src/testing/headless/sleep-bed-occupancy.scenario.test.ts src/testing/headless/eating.scenario.test.ts src/testing/headless/stockpile-haul.scenario.test.ts src/testing/headless/blueprint-construction.scenario.test.ts`

Expected: 全部 PASS

**Step 3: 跑全量场景回归**

Run: `npm run test:scenario -- src/testing/headless/scenario-regression.test.ts`

Expected: PASS；每个注册场景都通过

**Step 4: 检查工作区与结果**

Run: `git status --short`

Expected: 只有本次特性相关改动；无意外脏文件

**Step 5: 最终提交**

```bash
git add src/core/clock.ts src/core/clock.tod.test.ts src/features/pawn/pawn.types.ts src/features/pawn/pawn.factory.ts src/features/pawn/pawn.systems.ts src/features/pawn/pawn.chronotype.test.ts src/features/ai/work-evaluators/needs.evaluator.ts src/features/ai/work-evaluators/evaluators.test.ts src/features/ai/sleep.behavior.test.ts src/testing/scenario-fixtures/world-fixtures.ts src/testing/scenario-probes/pawn-probes.ts src/testing/scenario-dsl/scenario.types.ts src/testing/scenario-probes/query-api.ts src/testing/scenarios/tod-sleep-rhythm.scenario.ts src/testing/headless/tod-sleep-rhythm.scenario.test.ts src/testing/scenario-registry.ts src/adapter/render/daylight-visuals.ts src/adapter/render/daylight-visuals.test.ts src/adapter/render/day-night-overlay.ts src/adapter/render/render-sync.ts src/adapter/main-scene.ts
git commit -m "feat: add TOD sleep rhythm system"
```

## 交付检查清单

- `SimulationClock` 已提供可复用 TOD 派生
- `PawnChronotype` 已稳定生成并可从 trait 派生
- 普通 pawn 夜间更易长睡，但不是强锁
- `night_owl` / `high_energy` 可明显晚睡
- TOD 视觉过渡平滑，无整点跳变
- `tod-sleep-rhythm` 场景通过
- 现有 sleep / eat / haul / construction 回归通过
