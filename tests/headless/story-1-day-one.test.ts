/**
 * Story-1 第一天无头集成：按 T-27 逐步 submit + expectation 组。
 * 场景 ID 注释：MAP-001、MAP-002、WORK-002、WORK-001、BUILD-001、BUILD-002、NEED-002、BEHAVIOR-003。
 */
import { describe, expect, it } from "vitest";
import { describePawnDebugLabel } from "../../src/game/pawn-state";
import { claimWorkItem } from "../../src/game/world-core";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario, runAllExpectations, runScenarioHeadless } from "../../src/headless/scenario-runner";
import type { ScenarioExpectation } from "../../src/headless/scenario-types";
import { toWorldTimeSnapshot } from "../../src/game/time/world-time";
import {
  STORY_1_BED_CELL,
  STORY_1_DAY_ONE_BOOTSTRAP_EXPECTATIONS,
  STORY_1_DAY_ONE_EXPECTATION_GROUPS,
  STORY_1_DAY_ONE_SCENARIO,
  STORY_1_DOMAIN_COMMANDS,
  STORY_1_FOOD_CELLS,
  STORY_1_TREE_CELL,
  STORY_1_WALL_CELL
} from "../../scenarios/story-1-day-one.scenario";

function runExpectGroup(sim: ReturnType<typeof createHeadlessSim>, exps: readonly ScenarioExpectation[]): void {
  const results = runAllExpectations(sim, [...exps]);
  expect(results.every((r) => r.passed)).toBe(true);
}

function claimNextOpenConstruct(sim: ReturnType<typeof createHeadlessSim>, pawnId: string): void {
  const w = sim.getWorldPort().getWorld();
  const wi = [...w.workItems.values()].find((x) => x.kind === "construct-blueprint" && x.status === "open");
  expect(wi).toBeDefined();
  const claimed = claimWorkItem(sim.getWorldPort().getWorld(), wi!.id, pawnId);
  expect(claimed.outcome.kind).toBe("claimed");
  sim.getWorldPort().setWorld(claimed.world);
}

function forceNight(sim: ReturnType<typeof createHeadlessSim>): void {
  const w = sim.getWorldPort().getWorld();
  const minuteOfDay = 19 * 60;
  w.timeConfig = { ...w.timeConfig, startMinuteOfDay: minuteOfDay };
  w.time = toWorldTimeSnapshot(
    { dayNumber: w.time.dayNumber, minuteOfDay },
    { paused: w.time.paused, speed: w.time.speed }
  );
  sim.getWorldPort().setWorld(w);
}

describe("story-1-day-one integration (T-27)", () => {
  it("runScenarioHeadless 仅 MAP-001 基线可通过（注册场景冒烟）", () => {
    const { results } = runScenarioHeadless(STORY_1_DAY_ONE_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("a–f：zone → haul → 伐木全链 → 墙 → 床（含 MAP-001/002、WORK-001/002、BUILD-001/002）", () => {
    const sim = createHeadlessSim({
      seed: STORY_1_DAY_ONE_SCENARIO.seed,
      worldGrid: STORY_1_DAY_ONE_SCENARIO.gridConfig
    });
    hydrateScenario(sim, STORY_1_DAY_ONE_SCENARIO);

    // a. MAP-001：初始树 + 散落食物
    runExpectGroup(sim, STORY_1_DAY_ONE_BOOTSTRAP_EXPECTATIONS);
    const world0 = sim.getWorldPort().getWorld();
    expect([...world0.entities.values()].some((e) => e.kind === "tree")).toBe(true);
    const foods = [...world0.entities.values()].filter(
      (e) => e.kind === "resource" && e.materialKind === "food" && e.containerKind === "ground"
    );
    expect(foods.length).toBeGreaterThanOrEqual(2);

    // b. MAP-002：zone_create
    const zc = sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.zoneCreate, 1);
    expect(zc.accepted).toBe(true);
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterZoneCreate);

    // c. WORK-002：haul → 食物入库
    const haul = sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.haulFood, 2);
    expect(haul.accepted).toBe(true);
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterHaulToZone);
    const zone = [...sim.getWorldPort().getWorld().entities.values()].find((e) => e.kind === "zone");
    expect(zone).toBeDefined();
    const foodInZone = [...sim.getWorldPort().getWorld().entities.values()].some(
      (e) =>
        e.kind === "resource" &&
        e.materialKind === "food" &&
        e.containerKind === "zone" &&
        e.containerEntityId === zone!.id
    );
    expect(foodInZone).toBe(true);

    // d. WORK-001：lumber 全链（含木材入 zone）
    const lumber = sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.lumberTree, 3);
    expect(lumber.accepted).toBe(true);
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterLumberChain);

    // e. BUILD-001：墙蓝图 → 落成
    const wallCmd = sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.wallBlueprint, 4);
    expect(wallCmd.accepted).toBe(true);
    claimNextOpenConstruct(sim, "pawn-2");
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterWallBuilt);
    expect(
      [...sim.getWorldPort().getWorld().entities.values()].some(
        (e) => e.kind === "building" && e.buildingKind === "wall" && e.cell.col === STORY_1_WALL_CELL.col
      )
    ).toBe(true);

    // f. BUILD-002：床落成 + restSpot 归属
    const bedCmd = sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.placeBed, 5);
    expect(bedCmd.accepted).toBe(true);
    claimNextOpenConstruct(sim, "pawn-2");
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterBedBuilt);
    const bedEntity = [...sim.getWorldPort().getWorld().entities.values()].find(
      (e) =>
        e.kind === "building" &&
        e.buildingKind === "bed" &&
        e.cell.col === STORY_1_BED_CELL.col &&
        e.cell.row === STORY_1_BED_CELL.row
    );
    expect(bedEntity).toBeDefined();
    const spot = sim.getWorldPort().getWorld().restSpots.find((s) => s.buildingEntityId === bedEntity!.id);
    expect(spot).toBeDefined();
    expect(spot!.ownerPawnId).toBeDefined();
  });

  // g. NEED-002：夜晚 + 低精力 → currentGoal sleep（依赖 DEFAULT_WORLD_GRID 模板床交互点或既有睡眠驱动）
  it("g：NEED-002 夜间低精力 → sleep 目标", () => {
    const sim = createHeadlessSim({
      seed: STORY_1_DAY_ONE_SCENARIO.seed,
      worldGrid: STORY_1_DAY_ONE_SCENARIO.gridConfig
    });
    hydrateScenario(sim, STORY_1_DAY_ONE_SCENARIO);
    sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.zoneCreate, 1);
    sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.haulFood, 2);
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterHaulToZone);
    sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.lumberTree, 3);
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterLumberChain);
    sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.wallBlueprint, 4);
    claimNextOpenConstruct(sim, "pawn-2");
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterWallBuilt);
    sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.placeBed, 5);
    claimNextOpenConstruct(sim, "pawn-2");
    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.afterBedBuilt);

    sim.runUntil(() => true, { maxTicks: 400, deltaMs: 16 });

    forceNight(sim);
    const ref = sim.getSimAccess().getPawnsRef();
    const p0 = ref[0]!;
    const tired = {
      ...p0,
      energy: 10,
      needs: { hunger: 8, rest: 90, recreation: p0.needs.recreation }
    };
    ref[0] = { ...tired, debugLabel: describePawnDebugLabel(tired) };

    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.nightSleep);
  });

  // h. BEHAVIOR-003：伐木 claimed 后人为压低饱食度 → eat + chop-tree 重回 open
  it("h：BEHAVIOR-003 伐木进行中饥饿 → 释放工单并 eat", () => {
    const sim = createHeadlessSim({
      seed: STORY_1_DAY_ONE_SCENARIO.seed,
      worldGrid: STORY_1_DAY_ONE_SCENARIO.gridConfig
    });
    hydrateScenario(sim, {
      ...STORY_1_DAY_ONE_SCENARIO,
      pawns: [{ name: "Chopper", cell: { col: 16, row: 5 }, overrides: { satiety: 100, energy: 100 } }],
      trees: [{ cell: STORY_1_TREE_CELL }],
      resources: []
    });
    sim.getWorldPort().submit(STORY_1_DOMAIN_COMMANDS.lumberTree, 0);

    const claimed = sim.runUntil(() => {
      return [...sim.getWorldPort().getWorld().workItems.values()].some(
        (w) => w.kind === "chop-tree" && w.status === "claimed" && w.claimedBy === "pawn-0"
      );
    }, { maxTicks: 6_000 });
    expect(claimed.reachedPredicate).toBe(true);

    const ref = sim.getSimAccess().getPawnsRef();
    const p = ref[0]!;
    const starved = {
      ...p,
      satiety: 5,
      needs: { hunger: 92, rest: p.needs.rest, recreation: p.needs.recreation }
    };
    ref[0] = { ...starved, debugLabel: describePawnDebugLabel(starved) };

    runExpectGroup(sim, STORY_1_DAY_ONE_EXPECTATION_GROUPS.hungerInterrupt);

    const chop = [...sim.getWorldPort().getWorld().workItems.values()].find((w) => w.kind === "chop-tree");
    expect(chop?.status).toBe("open");
  });
});
