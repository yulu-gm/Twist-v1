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

  it("ab-gateway-reject-cell pins 0,0 as forced stone; gateway config has no inject reject set", () => {
    const s = playerAcceptanceScenarioById("ab-gateway-reject-cell")!;
    expect(s.forcedBlockedCellKeys?.includes("0,0")).toBe(true);
    const c = scenarioToMockWorldPortConfig(s);
    expect(c.alwaysAccept).toBe(true);
    expect(c.rejectIfTouchesCellKeys.size).toBe(0);
  });

  it("resolveSimConfigForScenario applies simOverrides", () => {
    const sparse = playerAcceptanceScenarioById("demo-sparse-stones")!;
    expect(resolveSimConfigForScenario(sparse).stoneCellCount).toBe(4);
    const fastNeed = playerAcceptanceScenarioById("ab-need-signals-panel")!;
    const cfg = resolveSimConfigForScenario(fastNeed);
    expect(cfg.needGrowthPerSec.hunger).toBeGreaterThan(DEFAULT_SIM_CONFIG.needGrowthPerSec.hunger);
  });
});
