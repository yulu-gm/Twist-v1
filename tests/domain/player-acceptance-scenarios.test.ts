import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID,
  PLAYER_ACCEPTANCE_SCENARIOS,
  playerAcceptanceScenarioById,
  resolveSimConfigForScenario,
  scenarioToMockWorldPortConfig
} from "../../src/data/player-acceptance-scenarios";
import { DEFAULT_SIM_CONFIG } from "../../src/game/sim-config";

describe("player acceptance scenarios", () => {
  it("has unique ids and default id is defined", () => {
    const ids = PLAYER_ACCEPTANCE_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(playerAcceptanceScenarioById(DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID)?.id).toBe("off");
  });

  it("resolves every scenario by id", () => {
    for (const s of PLAYER_ACCEPTANCE_SCENARIOS) {
      expect(playerAcceptanceScenarioById(s.id)?.title).toBe(s.title);
    }
  });

  it("scenarioToMockWorldPortConfig honors reject cells and alwaysAccept", () => {
    const s = playerAcceptanceScenarioById("b-m1-reject-cell")!;
    const c = scenarioToMockWorldPortConfig(s);
    expect(c.alwaysAccept).toBe(true);
    expect(c.rejectIfTouchesCellKeys.has("0,0")).toBe(true);
  });

  it("resolveSimConfigForScenario applies simOverrides", () => {
    const sparse = playerAcceptanceScenarioById("demo-sparse-map")!;
    expect(resolveSimConfigForScenario(sparse).stoneCellCount).toBe(4);
    const fastNeed = playerAcceptanceScenarioById("b-m2-need-signals")!;
    const cfg = resolveSimConfigForScenario(fastNeed);
    expect(cfg.needGrowthPerSec.hunger).toBeGreaterThan(DEFAULT_SIM_CONFIG.needGrowthPerSec.hunger);
  });
});
