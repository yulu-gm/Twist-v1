/**
 * refactor-test：`runScenarioHeadless` 契约 + **全部注册场景**（ALL_SCENARIOS）hydrate/expectations 冒烟。
 * 单条 scenario 的深断言仍由同名/专用 `*.test.ts` 承担；本文件是 36 `scenario_id` 的基线守门，非逐条替代业务专用用例。
 */
import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS } from "../../scenarios/index";
import { DEFAULT_WORLD_GRID, coordKey } from "../../src/game/map";
import { createWorldCore } from "../../src/game/world-core";
import type { WorldCore } from "../../src/game/world-core-types";
import {
  assertEventSequence,
  assertPlayerInputSemantic,
  assertVisibleFailureFeedback,
  assertVisibleHudTime,
  assertVisibleOwnership,
  assertVisibleWorkItemState,
  captureVisibleState,
  recordScenarioPlayerSelection,
  runScenarioHeadless,
  type HeadlessSim,
  type ScenarioDefinition
} from "../../src/headless/index";

function createVisibleStateTestSim(world: WorldCore): HeadlessSim {
  return {
    getWorldPort: () => ({
      getWorld: () => world
    }),
    getPawns: () => []
  } as unknown as HeadlessSim;
}

describe("runScenarioHeadless", () => {
  it("returns a stable shape for a minimal scenario", () => {
    const def: ScenarioDefinition = {
      name: "minimal",
      description: "smoke",
      seed: 0xabc,
      pawns: [{ name: "Solo", cell: { col: 0, row: 0 } }]
    };
    const { sim, report, results, hydration } = runScenarioHeadless(def);
    expect(sim.getPawns()).toHaveLength(1);
    expect(sim.getPawns()[0]!.name).toBe("Solo");
    expect(report.pawns).toHaveLength(1);
    expect(report.assertionResults).toEqual([]);
    expect(results).toEqual([]);
    expect(hydration.playerSelections).toEqual([]);
  });

  it("keeps report assertionResults aligned with immediate expectations", () => {
    const def: ScenarioDefinition = {
      name: "noop-expect",
      description: "immediate no-pawn-starved",
      seed: 1,
      pawns: [{ name: "A", cell: { col: 1, row: 1 } }],
      expectations: [
        {
          label: "still-fed",
          type: "no-pawn-starved",
          params: {}
        }
      ]
    };
    const { report, results } = runScenarioHeadless(def);
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
    expect(report.assertionResults).toEqual(results);
  });

  it("records no-tool semantics and rejected player feedback during hydration", () => {
    const blockedKey = coordKey({ col: 1, row: 1 });
    const def: ScenarioDefinition = {
      name: "player-input-observation",
      description: "observe no-tool and rejection",
      seed: 2,
      pawns: [{ name: "A", cell: { col: 0, row: 0 } }],
      worldPortConfig: {
        rejectIfTouchesCellKeys: [blockedKey]
      },
      playerSelectionAfterHydrate: [
        {
          label: "observe-idle",
          commandId: "idle",
          selectionModifier: "replace",
          cellKeys: [coordKey({ col: 0, row: 0 })],
          inputShape: "single-cell",
          semantics: "no-tool"
        },
        {
          label: "reject-build",
          commandId: "place-bed",
          selectionModifier: "replace",
          cellKeys: [blockedKey],
          inputShape: "single-cell"
        }
      ]
    };

    const { hydration, sim } = runScenarioHeadless(def);
    expect(hydration.playerSelections).toHaveLength(2);
    expect(assertPlayerInputSemantic(hydration.playerSelections[0]!, "no-tool").passed).toBe(true);
    expect(hydration.playerSelections[0]!.didSubmitToWorld).toBe(false);
    expect(hydration.playerSelections[1]!.accepted).toBe(false);
    expect(
      assertVisibleFailureFeedback(
        sim,
        {
          source: "submit-result",
          accepted: false,
          textIncludes: "世界网关：拒绝"
        },
        { playerSelections: hydration.playerSelections }
      ).passed
    ).toBe(true);
  });

  it("supports paused starts and post-hydrate frame-gap schedules", () => {
    const def: ScenarioDefinition = {
      name: "paused-frame-gap",
      description: "paused time stays frozen",
      seed: 3,
      pawns: [{ name: "A", cell: { col: 1, row: 1 } }],
      timeConfig: {
        startMinuteOfDay: 100,
        paused: true,
        speed: 3
      },
      tickScheduleAfterHydrate: [10_000]
    };

    const { report } = runScenarioHeadless(def);
    expect(report.worldTime.minuteOfDay).toBe(100);
    expect(report.worldTime.paused).toBe(true);
    expect(report.worldTime.speed).toBe(3);
  });

  it("can emit night-start through the shared event sequence helper", () => {
    const def: ScenarioDefinition = {
      name: "night-transition",
      description: "crosses into night after hydrate",
      seed: 4,
      pawns: [{ name: "A", cell: { col: 1, row: 1 } }],
      timeConfig: {
        startMinuteOfDay: 17 * 60 + 59
      }
    };

    const { sim } = runScenarioHeadless(def);
    const progressed = sim.runUntil(() => sim.getWorldTime().currentPeriod === "night", {
      deltaMs: 16,
      maxTicks: 40
    });
    expect(progressed.reachedPredicate).toBe(true);
    const result = assertEventSequence(sim, ["night-start"]);
    expect(result.passed).toBe(true);
  });

  it("hydrates every ALL_SCENARIOS entry without throwing and keeps report shape stable", () => {
    expect(ALL_SCENARIOS.length).toBeGreaterThan(0);
    for (const def of ALL_SCENARIOS) {
      const { sim, report, results, hydration } = runScenarioHeadless(def);
      expect(def.name).toBeTruthy();
      expect(sim.getPawns()).toHaveLength(def.pawns.length);
      expect(report.pawns).toHaveLength(def.pawns.length);
      expect(results).toHaveLength(def.expectations?.length ?? 0);
      expect(report.assertionResults).toEqual(results);
      expect(hydration.playerSelections.length).toBe(def.playerSelectionAfterHydrate?.length ?? 0);
    }
  });
});

describe("visible headless assertions", () => {
  it("captures HUD time, work status, ownership, and feedback from a shared snapshot", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    world.time = {
      ...world.time,
      dayNumber: 2,
      minuteOfDay: 8 * 60,
      dayProgress01: (8 * 60) / (24 * 60),
      currentPeriod: "day",
      paused: false,
      speed: 2
    };
    world.entities.set("bed-1", {
      id: "bed-1",
      kind: "building",
      cell: { col: 2, row: 2 },
      occupiedCells: [{ col: 2, row: 2 }],
      buildingKind: "bed",
      relatedWorkItemIds: [],
      interactionCapabilities: ["rest"],
      ownership: {
        ownerPawnId: "pawn-0",
        assignmentReason: "unassigned"
      }
    });
    world.workItems.set("w-claimed", {
      id: "w-claimed",
      kind: "construct-blueprint",
      anchorCell: { col: 2, row: 2 },
      status: "claimed",
      claimedBy: "pawn-0",
      failureCount: 1,
      priority: 9,
      sourceReason: "test"
    });
    const sim = createVisibleStateTestSim(world);
    const selectionRecord = recordScenarioPlayerSelection(
      {
        label: "rejected-build",
        commandId: "place-bed",
        selectionModifier: "replace",
        cellKeys: [coordKey({ col: 2, row: 2 })],
        inputShape: "single-cell"
      },
      {
        didSubmitToWorld: true,
        command: null,
        submitResult: {
          accepted: false,
          messages: ["blocked"]
        },
        nextMarkers: new Map(),
        resultSummaryLine: "世界网关：拒绝 — blocked"
      }
    );

    const snapshot = captureVisibleState(sim, { playerSelections: [selectionRecord] });
    expect(snapshot.hud.timeLabel).toBe("Day 2 08:00");
    expect(snapshot.workItems).toHaveLength(1);
    expect(snapshot.ownerships).toHaveLength(1);
    expect(snapshot.failures).toHaveLength(2);
    expect(assertVisibleHudTime(sim, { timeLabel: "Day 2 08:00", speed: 2 }).passed).toBe(true);
    expect(
      assertVisibleWorkItemState(sim, {
        id: "w-claimed",
        status: "claimed",
        claimedBy: "pawn-0",
        failureCountAtLeast: 1
      }).passed
    ).toBe(true);
    expect(
      assertVisibleOwnership(sim, {
        entityId: "bed-1",
        buildingKind: "bed",
        ownerPawnId: "pawn-0"
      }).passed
    ).toBe(true);
    expect(
      assertVisibleFailureFeedback(
        sim,
        {
          source: "submit-result",
          accepted: false,
          textIncludes: "世界网关：拒绝"
        },
        { playerSelections: [selectionRecord] }
      ).passed
    ).toBe(true);
  });
});
