import { describe, expect, it } from "vitest";
import { describePawnDebugLabel } from "../../src/game/pawn-state";
import {
  createHeadlessSim,
  hydrateScenario,
  runScenarioHeadless
} from "../../src/headless";
import { DEFAULT_WORLD_GRID } from "../../src/game/map";
import type { ScenarioDefinition } from "../../src/headless/scenario-types";
import { NEED_INTERRUPT_DURING_WORK_SCENARIO } from "../../scenarios/need-interrupt-during-work.scenario";

describe("need-interrupt-during-work", () => {
  it("headless scenario 满足 eat / 不饿死期望", () => {
    const { results } = runScenarioHeadless(NEED_INTERRUPT_DURING_WORK_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("伐木进行中压低饱食度后出现 pawn-goal-changed 转向 eat，且工单回到 open", () => {
    const scenarioFull: ScenarioDefinition = {
      ...NEED_INTERRUPT_DURING_WORK_SCENARIO,
      expectations: [],
      pawns: [
        {
          name: "HungryLumber",
          cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!,
          overrides: {
            satiety: 100,
            energy: 100,
            needs: { hunger: 15, rest: 10, recreation: 20 }
          }
        }
      ]
    };

    const sim = createHeadlessSim({ seed: NEED_INTERRUPT_DURING_WORK_SCENARIO.seed });
    hydrateScenario(sim, scenarioFull);

    const claimed = sim.runUntil(() => {
      return [...sim.getWorldPort().getWorld().workItems.values()].some(
        (w) => w.kind === "chop-tree" && w.status === "claimed" && w.claimedBy === "pawn-0"
      );
    }, { maxTicks: 4000 });
    expect(claimed.reachedPredicate).toBe(true);

    const ref = sim.getSimAccess().getPawnsRef();
    const p = ref[0]!;
    const starved = {
      ...p,
      satiety: 5,
      needs: { hunger: 92, rest: p.needs.rest, recreation: p.needs.recreation }
    };
    ref[0] = { ...starved, debugLabel: describePawnDebugLabel(starved) };

    sim.getSimEventCollector().clear();

    sim.runUntil(() => sim.getPawns()[0]?.currentGoal?.kind === "eat", { maxTicks: 4000 });

    const goalEvents = sim.getSimEventCollector().getEventsByKind("pawn-goal-changed");
    const toEat = goalEvents.find((e) => e.after?.kind === "eat" && e.before?.kind !== "eat");
    expect(toEat).toBeDefined();

    const chop = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (w) => w.kind === "chop-tree"
    );
    expect(chop?.status).toBe("open");
    expect(chop?.claimedBy).toBeUndefined();
  });
});
