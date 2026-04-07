import { describe, expect, it } from "vitest";
import {
  GAME_ORCHESTRATOR_HOOK_KEYS_SORTED_FOR_CONTRACT,
  createHeadlessSim
} from "../../src/headless/headless-sim";

describe("GameOrchestratorHooks contract (headless vs type surface)", () => {
  it("exports strictly sorted hook keys with no duplicates", () => {
    const keys = GAME_ORCHESTRATOR_HOOK_KEYS_SORTED_FOR_CONTRACT;
    const sorted = [...keys].sort((a, b) => String(a).localeCompare(String(b)));
    expect(keys).toEqual(sorted);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("createHeadlessSim loads after noop runtime contract (module init)", () => {
    expect(() => createHeadlessSim()).not.toThrow();
  });
});
