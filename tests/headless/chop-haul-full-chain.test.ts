import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { CHOP_HAUL_FULL_CHAIN_SCENARIO } from "../../scenarios/chop-haul-full-chain.scenario";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario, runAllExpectations, runScenarioHeadless } from "../../src/headless/scenario-runner";

describe("chop-haul-full-chain scenario", () => {
  it("hydrate + lumber → runScenarioHeadless 全期望通过，木材 cell 落在存储区覆盖格内", () => {
    const { results, report, sim } = runScenarioHeadless(CHOP_HAUL_FULL_CHAIN_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
    const ar = report.assertionResults ?? [];
    expect(ar.length).toBeGreaterThan(0);
    expect(ar.every((r) => r.passed)).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const zones = [...world.entities.values()].filter((e) => e.kind === "zone" && e.zoneKind === "storage");
    expect(zones.length).toBeGreaterThanOrEqual(1);
    const zone = zones[0]!;
    const coveredKeys = new Set((zone.coveredCells ?? [zone.cell]).map((c) => coordKey(c)));

    const woodInZone = [...world.entities.values()].find(
      (e) =>
        e.kind === "resource" &&
        e.materialKind === "wood" &&
        e.containerKind === "zone" &&
        e.containerEntityId === zone.id
    );
    expect(woodInZone).toBeDefined();
    expect(coveredKeys.has(coordKey(woodInZone!.cell))).toBe(true);
  });

  it("先 hydrate 再 submit lumber，同一 sim 上跑 expectations", () => {
    const sim = createHeadlessSim({ seed: CHOP_HAUL_FULL_CHAIN_SCENARIO.seed });
    const { domainCommandsAfterHydrate, ...rest } = CHOP_HAUL_FULL_CHAIN_SCENARIO;
    hydrateScenario(sim, { ...rest, domainCommandsAfterHydrate: undefined });
    for (const cmd of domainCommandsAfterHydrate ?? []) {
      sim.getWorldPort().submit(cmd, 0);
    }
    const results = runAllExpectations(sim, CHOP_HAUL_FULL_CHAIN_SCENARIO.expectations ?? []);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
