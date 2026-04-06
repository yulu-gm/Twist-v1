import { describe, expect, it } from "vitest";
import { runScenarioHeadless, type ScenarioDefinition } from "../../src/headless/index";

describe("runScenarioHeadless", () => {
  it("最小场景（1 pawn、无 expectations）返回结构正确且不抛错", () => {
    const def: ScenarioDefinition = {
      name: "minimal",
      description: "smoke",
      seed: 0xabc,
      pawns: [{ name: "Solo", cell: { col: 0, row: 0 } }]
    };
    const { sim, report, results } = runScenarioHeadless(def);
    expect(sim.getPawns()).toHaveLength(1);
    expect(sim.getPawns()[0]!.name).toBe("Solo");
    expect(report.pawns).toHaveLength(1);
    expect(report.assertionResults).toEqual([]);
    expect(results).toEqual([]);
  });

  it("带立即满足的 noop 期望时 results 与 report.assertionResults 一致", () => {
    const def: ScenarioDefinition = {
      name: "noop-expect",
      description: "immediate no-pawn-starved",
      seed: 1,
      pawns: [{ name: "A", cell: { col: 1, row: 1 } }],
      expectations: [
        {
          label: "饱食未归零",
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
});
