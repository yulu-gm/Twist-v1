import { describe, expect, it } from "vitest";
import {
  canBeInterrupted,
  canTransition,
  createBehaviorFSM,
  getCurrentState,
  transition
} from "../../src/game/behavior/behavior-state-machine";

describe("behavior-state-machine", () => {
  it("createBehaviorFSM 初始为 idle", () => {
    const fsm = createBehaviorFSM("p-1");
    expect(fsm.pawnId).toBe("p-1");
    expect(getCurrentState(fsm)).toBe("idle");
  });

  it("合法转换：idle → moving 并可变更新", () => {
    const fsm = createBehaviorFSM("p-1");
    const r = transition(fsm, "moving", {});
    expect(r).toEqual({ ok: true, previousState: "idle" });
    expect(getCurrentState(fsm)).toBe("moving");
  });

  it("合法转换：working → eating（需求打断边）", () => {
    const fsm = createBehaviorFSM("p-2");
    fsm.currentState = "working";
    expect(transition(fsm, "eating", { interruptPriority: 70 })).toMatchObject({ ok: true });
    expect(getCurrentState(fsm)).toBe("eating");
  });

  it("非法转换：idle → idle", () => {
    const fsm = createBehaviorFSM("p-3");
    const r = transition(fsm, "idle", {});
    expect(r).toEqual({ ok: false, reason: "already-in-state" });
    expect(getCurrentState(fsm)).toBe("idle");
  });

  it("非法转换：eating 不可直接回到 eating（同态）", () => {
    const fsm = createBehaviorFSM("p-4");
    fsm.currentState = "eating";
    expect(canTransition(fsm, "eating")).toBe(false);
    expect(transition(fsm, "eating", {})).toEqual({ ok: false, reason: "already-in-state" });
  });

  it("非法转换：不存在的边（如 wandering → wandering）", () => {
    const fsm = createBehaviorFSM("p-5");
    fsm.currentState = "wandering";
    expect(canTransition(fsm, "moving")).toBe(true);
    expect(canTransition(fsm, "wandering")).toBe(false);
  });

  it("canBeInterrupted：wandering 易被低优先级打断，working 需更高优先级", () => {
    const wander = createBehaviorFSM("p-6");
    wander.currentState = "wandering";
    expect(canBeInterrupted(wander, 10)).toBe(true);
    expect(canBeInterrupted(wander, 9)).toBe(false);

    const work = createBehaviorFSM("p-7");
    work.currentState = "working";
    expect(canBeInterrupted(work, 55)).toBe(true);
    expect(canBeInterrupted(work, 54)).toBe(false);
  });

  it("canBeInterrupted：锁抬高阈值", () => {
    const fsm = createBehaviorFSM("p-8");
    fsm.currentState = "eating";
    fsm.lockedUntilInterruptPriority = 60;
    expect(canBeInterrupted(fsm, 60)).toBe(true);
    expect(canBeInterrupted(fsm, 59)).toBe(false);
  });

  it("锁未满足优先级时 transition 失败且不修改状态", () => {
    const fsm = createBehaviorFSM("p-9");
    fsm.currentState = "working";
    fsm.lockedUntilInterruptPriority = 80;
    const r = transition(fsm, "eating", { interruptPriority: 40 });
    expect(r).toEqual({ ok: false, reason: "below-lock-priority" });
    expect(getCurrentState(fsm)).toBe("working");
    expect(fsm.lockedUntilInterruptPriority).toBe(80);
  });

  it("足够优先级可突破锁并清空锁", () => {
    const fsm = createBehaviorFSM("p-10");
    fsm.currentState = "working";
    fsm.lockedUntilInterruptPriority = 80;
    const r = transition(fsm, "eating", { interruptPriority: 80 });
    expect(r).toMatchObject({ ok: true, previousState: "working" });
    expect(getCurrentState(fsm)).toBe("eating");
    expect(fsm.lockedUntilInterruptPriority).toBeUndefined();
  });

  it("completeNatural 可无视锁完成到 idle", () => {
    const fsm = createBehaviorFSM("p-11");
    fsm.currentState = "working";
    fsm.lockedUntilInterruptPriority = 99;
    const r = transition(fsm, "idle", { completeNatural: true });
    expect(r).toMatchObject({ ok: true, previousState: "working" });
    expect(getCurrentState(fsm)).toBe("idle");
  });
});
