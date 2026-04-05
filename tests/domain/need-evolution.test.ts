import { describe, expect, it } from "vitest";
import {
  BASE_SATIETY_DRAIN_PER_SECOND,
  EATING_SATIETY_RECOVERY_PER_SECOND,
  evolveNeeds,
  RESTING_ENERGY_RECOVERY_PER_SECOND,
  WORKING_SATIETY_MULTIPLIER
} from "../../src/game/need/need-evolution-engine";
import { createNeedProfile } from "../../src/game/need/need-profile";
import {
  isNeedSatisfied,
  PARTIAL_INTERRUPT_REFERENCE_SECONDS,
  settleEating,
  settleInterrupted,
  settleResting
} from "../../src/game/need/satisfaction-settler";
import { WARNING_THRESHOLD } from "../../src/game/need/threshold-rules";

describe("need evolution (evolveNeeds)", () => {
  it("随时间衰减饱食与精力（idle）", () => {
    const p = createNeedProfile("a", 80, 80);
    const next = evolveNeeds(p, 100, "idle");
    expect(next.satiety).toBeLessThan(p.satiety);
    expect(next.energy).toBeLessThan(p.energy);
    expect(next.pawnId).toBe("a");
  });

  it("working 比 idle 更快消耗饱食", () => {
    const p = createNeedProfile("b", 90, 90);
    const dt = 50;
    const idle = evolveNeeds(p, dt, "idle");
    const working = evolveNeeds(p, dt, "working");
    const idleLoss = p.satiety - idle.satiety;
    const workLoss = p.satiety - working.satiety;
    expect(workLoss).toBeGreaterThan(idleLoss);
    expect(workLoss / idleLoss).toBeCloseTo(WORKING_SATIETY_MULTIPLIER, 5);
  });

  it("wandering 消耗介于 idle 与 working 之间（饱食）", () => {
    const p = createNeedProfile("c", 90, 90);
    const dt = 60;
    const idle = evolveNeeds(p, dt, "idle");
    const wand = evolveNeeds(p, dt, "wandering");
    const work = evolveNeeds(p, dt, "working");
    const idleLoss = p.satiety - idle.satiety;
    const wandLoss = p.satiety - wand.satiety;
    const workLoss = p.satiety - work.satiety;
    expect(wandLoss).toBeGreaterThan(idleLoss);
    expect(wandLoss).toBeLessThan(workLoss);
  });

  it("resting 恢复精力并仍经 updateNeedProfile clamp", () => {
    const p = createNeedProfile("d", 50, 10);
    const r = evolveNeeds(p, 500, "resting");
    expect(r.energy).toBeGreaterThan(p.energy);
    expect(r.energy).toBeLessThanOrEqual(100);
  });
});

describe("satisfaction settler", () => {
  it("settleEating 按速率提升饱食度", () => {
    const p = createNeedProfile("e", 30, 50);
    const sec = 10;
    const next = settleEating(p, sec);
    expect(next.satiety).toBe(p.satiety + EATING_SATIETY_RECOVERY_PER_SECOND * sec);
    expect(next.energy).toBe(p.energy);
  });

  it("settleResting 按速率提升精力", () => {
    const p = createNeedProfile("f", 50, 25);
    const sec = 8;
    const next = settleResting(p, sec);
    expect(next.energy).toBe(p.energy + RESTING_ENERGY_RECOVERY_PER_SECOND * sec);
    expect(next.satiety).toBe(p.satiety);
  });

  it("isNeedSatisfied 使用 WARNING_THRESHOLD", () => {
    const ok = createNeedProfile("g", WARNING_THRESHOLD, WARNING_THRESHOLD);
    const low = createNeedProfile("h", WARNING_THRESHOLD - 1, 100);
    expect(isNeedSatisfied(ok, "hunger")).toBe(true);
    expect(isNeedSatisfied(ok, "fatigue")).toBe(true);
    expect(isNeedSatisfied(low, "hunger")).toBe(false);
    expect(isNeedSatisfied(createNeedProfile("i", 100, WARNING_THRESHOLD - 1), "fatigue")).toBe(
      false
    );
  });

  it("settleInterrupted 为满额参考段增量的一半", () => {
    const p = createNeedProfile("j", 20, 20);
    const ref = PARTIAL_INTERRUPT_REFERENCE_SECONDS;
    const fullEat = settleEating(p, ref);
    const partialEat = settleInterrupted(p, "hunger");
    expect(partialEat.satiety - p.satiety).toBeCloseTo(
      (fullEat.satiety - p.satiety) * 0.5,
      5
    );

    const fullRest = settleResting(p, ref);
    const partialRest = settleInterrupted(p, "fatigue");
    expect(partialRest.energy - p.energy).toBeCloseTo(
      (fullRest.energy - p.energy) * 0.5,
      5
    );
  });

  it("负时长视为 0", () => {
    const p = createNeedProfile("k", 50, 50);
    expect(settleEating(p, -5)).toEqual(p);
    expect(settleResting(p, -3)).toEqual(p);
    expect(evolveNeeds(p, -1, "working")).toEqual(p);
  });
});

describe("satiety drain baseline sanity", () => {
  it("idle 饱食下降量 = BASE 速率 × 时长", () => {
    const p = createNeedProfile("m", 70, 70);
    const dt = 25;
    const next = evolveNeeds(p, dt, "idle");
    expect(p.satiety - next.satiety).toBeCloseTo(BASE_SATIETY_DRAIN_PER_SECOND * dt, 10);
  });
});
