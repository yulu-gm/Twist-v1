/**
 * refactor-test：无头模拟器与帧步进底层回归；不承担 TIME-004 场景语义主验收。
 * TIME-004 主证据：`tests/headless/time-frame-gap-guard.test.ts` + `time-frame-gap-guard.scenario.ts`。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_OF_DAY_CONFIG, MAX_FRAME_DT_SEC } from "../../src/game/time";
import {
  createHeadlessSim,
  type HeadlessSim
} from "../../src/headless/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

function assertSourceHasNoPhaserImport(relativePathFromRepoRoot: string): void {
  const abs = join(__dirname, "..", "..", relativePathFromRepoRoot);
  const src = readFileSync(abs, "utf8");
  expect(src).not.toMatch(/from\s+["']phaser["']/);
}

function totalWorldMinutes(t: { dayNumber: number; minuteOfDay: number }): number {
  return (t.dayNumber - 1) * 24 * 60 + t.minuteOfDay;
}

function collectDeterministicSnapshot(sim: HeadlessSim): string {
  const t = sim.getWorldTime();
  const pawns = sim.getPawns().map((p) => ({
    id: p.id,
    col: p.logicalCell.col,
    row: p.logicalCell.row,
    moveTarget: p.moveTarget
      ? { col: p.moveTarget.col, row: p.moveTarget.row }
      : null,
    moveProgress01: p.moveProgress01,
    satiety: p.satiety,
    energy: p.energy
  }));
  return JSON.stringify({
    dayNumber: t.dayNumber,
    minuteOfDay: t.minuteOfDay,
    pawns
  });
}

describe("createHeadlessSim (headless)", () => {
  it("构造时不抛异常", () => {
    expect(() => createHeadlessSim()).not.toThrow();
  });

  it("tick 后世界时间推进", () => {
    const sim = createHeadlessSim({ seed: 1 });
    const before = sim.getWorldTime().minuteOfDay;
    sim.tick(16);
    const after = sim.getWorldTime().minuteOfDay;
    expect(after).not.toBe(before);
  });

  it("tick(10_000) 单帧世界时间推进不超过 MAX_FRAME_DT_SEC × speed", () => {
    const sim = createHeadlessSim({ seed: 1 });
    const before = sim.getWorldTime();
    const speed = before.speed;
    const minutesPerSimSecond =
      (24 * 60) / DEFAULT_TIME_OF_DAY_CONFIG.realSecondsPerDay;
    const maxMinuteAdvance = MAX_FRAME_DT_SEC * speed * minutesPerSimSecond;
    sim.tick(10_000);
    const after = sim.getWorldTime();
    const delta = totalWorldMinutes(after) - totalWorldMinutes(before);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(maxMinuteAdvance + 1e-9);
  });

  it("spawnPawn 后 getPawns 长度为 1", () => {
    const sim = createHeadlessSim({ seed: 2 });
    expect(sim.getPawns().length).toBe(0);
    sim.spawnPawn("Alex", { col: 5, row: 5 });
    expect(sim.getPawns().length).toBe(1);
    expect(sim.getPawns()[0]!.name).toBe("Alex");
  });

  it("runUntil 在谓词满足时终止并统计 tick 次数", () => {
    const sim = createHeadlessSim({ seed: 3 });
    const result = sim.runUntil(() => sim.getTickCount() >= 10, { deltaMs: 16, maxTicks: 100 });
    expect(result.reachedPredicate).toBe(true);
    expect(result.ticksRun).toBe(10);
    expect(sim.getTickCount()).toBe(10);
  });

  it("相同 seed 下 200 tick 后关键状态一致", () => {
    const seed = 4242;
    const run = (): string => {
      const sim = createHeadlessSim({ seed });
      sim.spawnPawn("Det", { col: 5, row: 5 });
      for (let i = 0; i < 200; i += 1) {
        sim.tick(16);
      }
      return collectDeterministicSnapshot(sim);
    };
    expect(run()).toBe(run());
  });

  it("本测试与 headless-sim 源码不出现 phaser 模块 import", () => {
    assertSourceHasNoPhaserImport("src/headless/headless-sim.ts");
    assertSourceHasNoPhaserImport("tests/headless/headless-sim-basic.test.ts");
  });
});
