import { describe, expect, it, vi } from "vitest";
import { createBehaviorFSM } from "../../src/game/behavior/behavior-state-machine";
import {
  defaultNeedInterruptScoringContext,
  handleNeedInterruptTick,
  runNeedInterruptScenario
} from "../../src/game/flows/need-interrupt-flow";
import { createNeedProfile } from "../../src/game/need/need-profile";
import { isNeedSatisfied } from "../../src/game/need/satisfaction-settler";
import {
  addWork,
  claimWork,
  createWorkRegistry,
  generateChopWork,
  replaceWorkRegistryOrders
} from "../../src/game/work";

const cell = { col: 2, row: 3 };

describe("need-interrupt-flow", () => {
  it("工作中 satiety=15 时 runNeedInterruptScenario 触发 releaseWork，进食后再 claim", async () => {
    vi.resetModules();
    const workSchedulerMod = await import("../../src/game/work/work-scheduler");
    const releaseSpy = vi.spyOn(workSchedulerMod, "releaseWork");
    const { runNeedInterruptScenario: runScenario, defaultNeedInterruptScoringContext: scoring } =
      await import("../../src/game/flows/need-interrupt-flow");
    const { createBehaviorFSM: createFsm } = await import("../../src/game/behavior/behavior-state-machine");
    const { createNeedProfile: needProfile } = await import("../../src/game/need/need-profile");
    const { isNeedSatisfied: hungerOk } = await import("../../src/game/need/satisfaction-settler");
    const wr = await import("../../src/game/work");

    const registry = wr.createWorkRegistry();
    const work = wr.generateChopWork("tree-need-int", cell);
    wr.addWork(registry, work);
    const pawnId = "pawn-ada";
    const initialClaim = wr.claimWork(registry, work.workId, pawnId);
    replaceWorkRegistryOrders(registry, initialClaim.registry);
    expect(initialClaim.outcome).toEqual({ kind: "claimed" });

    const fsm = createFsm(pawnId);
    fsm.currentState = "working";

    const profile = needProfile(pawnId, 15, 80);
    const scoringContext = scoring(pawnId, profile, registry);

    const scenario = runScenario({
      fsm,
      workRegistry: registry,
      workId: work.workId,
      pawnId,
      profile,
      scoringContext
    });

    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledWith(registry, work.workId, pawnId);
    releaseSpy.mockRestore();

    if (scenario.kind === "tick-failed") {
      throw new Error(`unexpected tick-failed: ${JSON.stringify(scenario.tick)}`);
    }

    expect(scenario.kind).toBe("ok");
    expect(hungerOk(scenario.profileAfterEating, "hunger")).toBe(true);
    expect(scenario.claimAfterResume).toEqual({ kind: "claimed" });
    expect(registry.orders.get(work.workId)?.status).toBe("claimed");
    expect(registry.orders.get(work.workId)?.claimedByPawnId).toBe(pawnId);
    expect(fsm.currentState).toBe("idle");
  });

  it("handleNeedInterruptTick 单独调用时工单立即变为 open 并进入 eating", () => {
    const registry = createWorkRegistry();
    const work = generateChopWork("tree-tick-only", { col: 1, row: 1 });
    addWork(registry, work);
    const pawnId = "pawn-ced";
    const ic = claimWork(registry, work.workId, pawnId);
    replaceWorkRegistryOrders(registry, ic.registry);
    const fsm = createBehaviorFSM(pawnId);
    fsm.currentState = "working";
    const profile = createNeedProfile(pawnId, 15, 90);
    const tick = handleNeedInterruptTick({
      fsm,
      workRegistry: registry,
      workId: work.workId,
      pawnId,
      profile,
      scoringContext: defaultNeedInterruptScoringContext(pawnId, profile, registry)
    });
    expect(tick.kind).toBe("released-and-eating");
    expect(registry.orders.get(work.workId)?.status).toBe("open");
    expect(fsm.currentState).toBe("eating");
  });

  it("runNeedInterruptScenario 从零开始：认领 → working → 打断进食 → 再认领", () => {
    const registry = createWorkRegistry();
    const work = generateChopWork("tree-flow-only", cell);
    addWork(registry, work);
    const pawnId = "pawn-bob";
    const ic = claimWork(registry, work.workId, pawnId);
    replaceWorkRegistryOrders(registry, ic.registry);

    const fsm = createBehaviorFSM(pawnId);
    fsm.currentState = "working";
    const profile = createNeedProfile(pawnId, 15, 75);
    const ctx = defaultNeedInterruptScoringContext(pawnId, profile, registry);

    const out = runNeedInterruptScenario({
      fsm,
      workRegistry: registry,
      workId: work.workId,
      pawnId,
      profile,
      scoringContext: ctx
    });

    expect(out.kind).toBe("ok");
    expect(out.kind === "ok" && out.claimAfterResume.kind).toBe("claimed");
    expect(fsm.currentState).toBe("idle");
  });
});
