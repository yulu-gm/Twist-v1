import { describe, expect, it } from "vitest";
import { createBehaviorFSM, type BehaviorFSM } from "../../src/game/behavior/behavior-state-machine";
import {
  assignBedToPawn,
  createEntityRegistry,
  transformBlueprintToBuilding
} from "../../src/game/entity";
import { applyNightRestTimeEvent, setupNightRestFlow } from "../../src/game/flows/night-rest-flow";
import { createTimeEventBus, publish } from "../../src/game/time";

function fsmMap(entries: Array<[string, BehaviorFSM]>): (id: string) => BehaviorFSM | undefined {
  const m = new Map(entries);
  return (id) => m.get(id);
}

function makeBed(reg: ReturnType<typeof createEntityRegistry>, cell: { col: number; row: number }) {
  const bp = reg.create({
    kind: "blueprint",
    blueprintKind: "bed",
    cell,
    coveredCells: [cell],
    buildProgress01: 1,
    buildState: "completed",
    relatedWorkItemIds: []
  });
  const out = transformBlueprintToBuilding(reg, bp.id);
  expect(out.kind).toBe("ok");
  if (out.kind !== "ok") throw new Error("expected bed building");
  return reg.get(out.buildingId)!;
}

describe("night-rest-flow", () => {
  it("publish night-start：有床小人进入 resting", () => {
    const reg = createEntityRegistry();
    const bed = makeBed(reg, { col: 0, row: 0 });
    if (bed.kind !== "building") throw new Error("expected building");
    const pawn = reg.create({
      kind: "pawn",
      cell: { col: 1, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    expect(assignBedToPawn(reg, bed.id, pawn.id)).toEqual({ kind: "ok" });

    const fsm = createBehaviorFSM(pawn.id);
    fsm.currentState = "idle";

    const bus = createTimeEventBus();
    const unsub = setupNightRestFlow(bus, {
      registry: reg,
      getFsm: fsmMap([[pawn.id, fsm]])
    });

    publish(bus, [{ kind: "night-start", dayNumber: 1, minuteOfDay: 18 * 60 }]);
    expect(fsm.currentState).toBe("resting");

    unsub();
  });

  it("publish night-start：无床小人不强制 resting", () => {
    const reg = createEntityRegistry();
    reg.create({
      kind: "pawn",
      cell: { col: 1, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    const pawn = [...reg.getByKind("pawn")][0]!;
    const fsm = createBehaviorFSM(pawn.id);
    fsm.currentState = "wandering";

    const bus = createTimeEventBus();
    setupNightRestFlow(bus, {
      registry: reg,
      getFsm: fsmMap([[pawn.id, fsm]])
    });

    publish(bus, [{ kind: "night-start", dayNumber: 1, minuteOfDay: 18 * 60 }]);
    expect(fsm.currentState).toBe("wandering");
  });

  it("publish day-start：所有 resting 小人醒来为 idle", () => {
    const reg = createEntityRegistry();
    const bedA = makeBed(reg, { col: 0, row: 0 });
    const bedB = makeBed(reg, { col: 2, row: 0 });
    if (bedA.kind !== "building" || bedB.kind !== "building") throw new Error("expected buildings");

    const pawnA = reg.create({
      kind: "pawn",
      cell: { col: 1, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    const pawnB = reg.create({
      kind: "pawn",
      cell: { col: 3, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    expect(assignBedToPawn(reg, bedA.id, pawnA.id)).toEqual({ kind: "ok" });
    expect(assignBedToPawn(reg, bedB.id, pawnB.id)).toEqual({ kind: "ok" });

    const fsmA = createBehaviorFSM(pawnA.id);
    const fsmB = createBehaviorFSM(pawnB.id);
    fsmA.currentState = "resting";
    fsmB.currentState = "resting";

    const bus = createTimeEventBus();
    setupNightRestFlow(bus, {
      registry: reg,
      getFsm: fsmMap([
        [pawnA.id, fsmA],
        [pawnB.id, fsmB]
      ])
    });

    publish(bus, [{ kind: "day-start", dayNumber: 1, minuteOfDay: 6 * 60 }]);
    expect(fsmA.currentState).toBe("idle");
    expect(fsmB.currentState).toBe("idle");
  });

  it("applyNightRestTimeEvent 可直接驱动 day-start", () => {
    const reg = createEntityRegistry();
    const pawn = reg.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    const fsm = createBehaviorFSM(pawn.id);
    fsm.currentState = "resting";

    applyNightRestTimeEvent(
      {
        registry: reg,
        getFsm: (id) => (id === pawn.id ? fsm : undefined)
      },
      { kind: "day-start", dayNumber: 2, minuteOfDay: 6 * 60 }
    );

    expect(fsm.currentState).toBe("idle");
  });
});
