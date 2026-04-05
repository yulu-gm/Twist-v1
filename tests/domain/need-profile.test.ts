import { describe, expect, it } from "vitest";
import {
  createNeedProfile,
  updateNeedProfile,
  type NeedSnapshot
} from "../../src/game/need/need-profile";
import {
  CRITICAL_THRESHOLD,
  WARNING_THRESHOLD,
  evaluateFatigueStage,
  evaluateHungerStage,
  needActionSuggestion
} from "../../src/game/need/threshold-rules";

describe("need thresholds (40 / 20)", () => {
  it("饥饿：40 为正常，39 为警戒", () => {
    expect(evaluateHungerStage(40)).toBe("normal");
    expect(evaluateHungerStage(39)).toBe("warning");
  });

  it("饥饿：21 为警戒，20 为紧急", () => {
    expect(evaluateHungerStage(21)).toBe("warning");
    expect(evaluateHungerStage(20)).toBe("critical");
  });

  it("疲劳：与饱食度对称", () => {
    expect(evaluateFatigueStage(40)).toBe("normal");
    expect(evaluateFatigueStage(39)).toBe("warning");
    expect(evaluateFatigueStage(21)).toBe("warning");
    expect(evaluateFatigueStage(20)).toBe("critical");
  });

  it("常量与任务树一致", () => {
    expect(WARNING_THRESHOLD).toBe(40);
    expect(CRITICAL_THRESHOLD).toBe(20);
  });
});

describe("createNeedProfile", () => {
  it("创建时 clamp 并推导阶段", () => {
    const p = createNeedProfile("p1", -5, 105);
    expect(p.satiety).toBe(0);
    expect(p.energy).toBe(100);
    expect(p.hungerStage).toBe("critical");
    expect(p.fatigueStage).toBe("normal");
  });
});

describe("updateNeedProfile clamp", () => {
  it("加减后限制在 0..100 并重算阶段", () => {
    const base: NeedSnapshot = createNeedProfile("p2", 50, 50);
    const down = updateNeedProfile(base, -60, -60);
    expect(down.satiety).toBe(0);
    expect(down.energy).toBe(0);
    expect(down.hungerStage).toBe("critical");
    expect(down.fatigueStage).toBe("critical");

    const up = updateNeedProfile(down, 200, 200);
    expect(up.satiety).toBe(100);
    expect(up.energy).toBe(100);
    expect(up.hungerStage).toBe("normal");
    expect(up.fatigueStage).toBe("normal");
  });
});

describe("needActionSuggestion", () => {
  it("双正常则无建议", () => {
    const s = needActionSuggestion({
      satiety: 80,
      energy: 80,
      hungerStage: "normal",
      fatigueStage: "normal"
    });
    expect(s.actionKind).toBe("none");
    expect(s.urgency).toBe(0);
    expect(s.allowInterrupt).toBe(false);
  });

  it("饥饿更糟时建议进食", () => {
    const s = needActionSuggestion({
      satiety: 30,
      energy: 80,
      hungerStage: "warning",
      fatigueStage: "normal"
    });
    expect(s.actionKind).toBe("eat");
    expect(s.urgency).toBe(50);
    expect(s.allowInterrupt).toBe(false);
  });

  it("紧急阶段允许打断", () => {
    const s = needActionSuggestion({
      satiety: 10,
      energy: 80,
      hungerStage: "critical",
      fatigueStage: "normal"
    });
    expect(s.actionKind).toBe("eat");
    expect(s.urgency).toBe(100);
    expect(s.allowInterrupt).toBe(true);
  });

  it("同级时按缺口偏向更缺的一项", () => {
    const rest = needActionSuggestion({
      satiety: 35,
      energy: 30,
      hungerStage: "warning",
      fatigueStage: "warning"
    });
    expect(rest.actionKind).toBe("rest");

    const eat = needActionSuggestion({
      satiety: 30,
      energy: 35,
      hungerStage: "warning",
      fatigueStage: "warning"
    });
    expect(eat.actionKind).toBe("eat");
  });
});
