import { describe, expect, it } from "vitest";
import {
  canBeInterrupted,
  canTransition,
  cloneBehaviorFSM,
  createBehaviorFSM,
  getCurrentState,
  setBehaviorSubState,
  transition,
  transitionImmutable
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

  it("transition 成功后清空 subState；协调层可 setBehaviorSubState", () => {
    const fsm = createBehaviorFSM("p-12");
    fsm.currentState = "working";
    setBehaviorSubState(fsm, "chopping");
    expect(fsm.subState).toBe("chopping");
    transition(fsm, "moving", { interruptPriority: 48 });
    expect(fsm.subState).toBeUndefined();
    setBehaviorSubState(fsm, "pickup");
    expect(fsm.subState).toBe("pickup");
  });

  it("转移失败时不应清空已有 subState", () => {
    const fsm = createBehaviorFSM("p-13");
    fsm.currentState = "working";
    setBehaviorSubState(fsm, "building");
    fsm.lockedUntilInterruptPriority = 80;
    transition(fsm, "eating", { interruptPriority: 40 });
    expect(getCurrentState(fsm)).toBe("working");
    expect(fsm.subState).toBe("building");
  });

  it("cloneBehaviorFSM 复制 pawnId、主状态、subState 与锁字段", () => {
    const fsm = createBehaviorFSM("p-14");
    fsm.currentState = "eating";
    setBehaviorSubState(fsm, "eatingMeal");
    fsm.lockedUntilInterruptPriority = 50;
    const c = cloneBehaviorFSM(fsm);
    expect(c).toEqual(fsm);
    expect(c).not.toBe(fsm);
    transition(c, "idle", { completeNatural: true });
    expect(getCurrentState(fsm)).toBe("eating");
    expect(fsm.subState).toBe("eatingMeal");
    expect(getCurrentState(c)).toBe("idle");
    expect(c.subState).toBeUndefined();
  });

  it("transitionImmutable：成功时不改原 FSM，next 与原地 transition 结果一致", () => {
    const fsm = createBehaviorFSM("p-15");
    const { next, result } = transitionImmutable(fsm, "moving", {});
    expect(result).toEqual({ ok: true, previousState: "idle" });
    expect(getCurrentState(fsm)).toBe("idle");
    expect(getCurrentState(next)).toBe("moving");

    const baseline = createBehaviorFSM("p-15");
    transition(baseline, "moving", {});
    expect(next).toEqual(baseline);
  });

  it("transitionImmutable：失败时不改原 FSM，next 保持克隆快照", () => {
    const fsm = createBehaviorFSM("p-16");
    fsm.currentState = "working";
    setBehaviorSubState(fsm, "chopping");
    fsm.lockedUntilInterruptPriority = 80;
    const before = cloneBehaviorFSM(fsm);
    const { next, result } = transitionImmutable(fsm, "eating", { interruptPriority: 40 });
    expect(result).toEqual({ ok: false, reason: "below-lock-priority" });
    expect(fsm).toEqual(before);
    expect(next).toEqual(before);
  });
});
