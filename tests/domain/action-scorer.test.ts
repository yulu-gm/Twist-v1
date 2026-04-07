import { describe, expect, it } from "vitest";
import { scoreActions, type ActionCandidate } from "../../src/game/behavior/action-scorer";
import { aggregateBehaviorContext } from "../../src/game/behavior/behavior-context";
import { addWork, createWorkRegistry } from "../../src/game/work/work-registry";
import type { WorkOrder } from "../../src/game/work/work-types";
import type { WorldTimeSnapshot } from "../../src/game/time/world-time";

function snapshot(period: WorldTimeSnapshot["currentPeriod"]): WorldTimeSnapshot {
  return {
    dayNumber: 1,
    minuteOfDay: period === "day" ? 720 : 1200,
    dayProgress01: 0.5,
    currentPeriod: period,
    paused: false,
    speed: 1
  };
}

function work(partial: Partial<WorkOrder> & Pick<WorkOrder, "workId" | "priority">): WorkOrder {
  return {
    kind: "chop",
    status: "open",
    targetEntityId: "e-1",
    targetCell: { col: 0, row: 0 },
    sourceReason: "test",
    steps: [],
    ...partial
  };
}

describe("action-scorer", () => {
  it("需求优先于工作：极低饱腹时吃排在高优先级工作之前", () => {
    const reg = createWorkRegistry();
    addWork(
      reg,
      work({
        workId: "w-hi",
        priority: 100,
        kind: "construct",
        targetEntityId: "build-1"
      })
    );

    const ctx = aggregateBehaviorContext(
      "p-1",
      { satiety: 5, energy: 90 },
      reg,
      snapshot("day"),
      { foodReachable: true, bedReachable: true, reachableCellCount: 50 }
    );

    const ranked = scoreActions(ctx);
    expect(ranked[0]?.kind).toBe("eat");
    const workIdx = ranked.findIndex((c) => c.kind === "work");
    const eatIdx = ranked.findIndex((c) => c.kind === "eat");
    expect(eatIdx).toBeLessThan(workIdx);
  });

  it("工作优先于散步：需求正常时有开放工单则工单优于 wander", () => {
    const reg = createWorkRegistry();
    addWork(
      reg,
      work({
        workId: "w-1",
        priority: 8,
        kind: "chop",
        targetEntityId: "tree-1"
      })
    );

    const ctx = aggregateBehaviorContext(
      "p-2",
      { satiety: 92, energy: 88 },
      reg,
      snapshot("day"),
      { foodReachable: true, bedReachable: true, reachableCellCount: 120 }
    );

    const ranked = scoreActions(ctx);
    const workIdx = ranked.findIndex((c) => c.kind === "work" && c.targetId === "w-1");
    const wanderIdx = ranked.findIndex((c) => c.kind === "wander");
    expect(workIdx).not.toBe(-1);
    expect(wanderIdx).not.toBe(-1);
    expect(workIdx).toBeLessThan(wanderIdx);
  });

  it("同分稳定：多项工作分数相同时保持注册表遍历顺序", () => {
    const reg = createWorkRegistry();
    addWork(
      reg,
      work({ workId: "w-first", priority: 10, targetEntityId: "a", kind: "chop" })
    );
    addWork(
      reg,
      work({ workId: "w-second", priority: 10, targetEntityId: "b", kind: "haul" })
    );

    const ctx = aggregateBehaviorContext(
      "p-3",
      { satiety: 80, energy: 80 },
      reg,
      snapshot("night"),
      { foodReachable: false, bedReachable: true, reachableCellCount: 10 }
    );

    const works = scoreActions(ctx).filter((c): c is ActionCandidate & { targetId: string } => c.kind === "work");
    expect(works.map((c) => c.targetId)).toEqual(["w-first", "w-second"]);
  });

  it("地图提供食物/床铺目标 id 时 eat/rest 候选携带 targetId", () => {
    const reg = createWorkRegistry();
    const ctx = aggregateBehaviorContext(
      "p-4",
      { satiety: 10, energy: 15 },
      reg,
      snapshot("day"),
      {
        foodReachable: true,
        bedReachable: true,
        reachableCellCount: 20,
        foodTargetId: "food-entity-1",
        bedTargetId: "bed-entity-2"
      }
    );
    const ranked = scoreActions(ctx);
    const eat = ranked.find((c) => c.kind === "eat");
    const rest = ranked.find((c) => c.kind === "rest");
    expect(eat?.targetId).toBe("food-entity-1");
    expect(rest?.targetId).toBe("bed-entity-2");
  });

  it("mapQuery 为格点谓词时：摘要虽为保守默认，仍可按需求给出吃/休紧急分", () => {
    const reg = createWorkRegistry();
    addWork(
      reg,
      work({
        workId: "w-low",
        priority: 5,
        kind: "chop",
        targetEntityId: "tree-1"
      })
    );

    const ctx = aggregateBehaviorContext(
      "p-predicate",
      { satiety: 8, energy: 90 },
      reg,
      snapshot("day"),
      () => true
    );

    expect(ctx.map.foodReachable).toBe(false);
    expect(ctx.mapCellQuery).toBeTypeOf("function");

    const ranked = scoreActions(ctx);
    expect(ranked[0]?.kind).toBe("eat");
  });

  it("pawnCell 与 targetCell 曼哈顿距离：同等 priority 时近工单分更高且排在先", () => {
    const reg = createWorkRegistry();
    addWork(
      reg,
      work({
        workId: "w-far",
        priority: 10,
        targetEntityId: "far",
        targetCell: { col: 100, row: 100 }
      })
    );
    addWork(
      reg,
      work({
        workId: "w-near",
        priority: 10,
        targetEntityId: "near",
        targetCell: { col: 2, row: 1 }
      })
    );

    const ctx = aggregateBehaviorContext(
      "p-dist",
      { satiety: 85, energy: 85 },
      reg,
      snapshot("day"),
      { foodReachable: false, bedReachable: false, reachableCellCount: 50 },
      { pawnCell: { col: 0, row: 0 } }
    );

    const works = scoreActions(ctx).filter((c): c is ActionCandidate & { targetId: string } => c.kind === "work");
    expect(works.map((c) => c.targetId)).toEqual(["w-near", "w-far"]);
    expect((works[0]?.score ?? 0) > (works[1]?.score ?? 0)).toBe(true);
  });

  it("夜间相对白天提高 rest 加权（同 deficit 下夜间 rest 分数更高）", () => {
    const ctxBase = {
      pawnId: "p-time" as const,
      needState: { satiety: 90, energy: 40 },
      candidateWorks: [] as const,
      map: { foodReachable: false, bedReachable: true, reachableCellCount: 10 }
    };
    const dayCtx = { ...ctxBase, time: { currentPeriod: "day" as const, minuteOfDay: 720 } };
    const nightCtx = { ...ctxBase, time: { currentPeriod: "night" as const, minuteOfDay: 1200 } };
    const dayRest = scoreActions(dayCtx).find((c) => c.kind === "rest")?.score ?? 0;
    const nightRest = scoreActions(nightCtx).find((c) => c.kind === "rest")?.score ?? 0;
    expect(nightRest).toBeGreaterThan(dayRest);
  });
});
