// 床蓝图场景：放置后存在 construct-blueprint 开放工单。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import { createHeadlessSim } from "../../src/headless";
import { runScenarioHeadless } from "../../src/headless/scenario-runner";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { BUILD_BED_FLOW_SCENARIO } from "../../scenarios/build-bed-flow.scenario";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("build-bed-flow scenario", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("passes all expectations", () => {
    const { results } = runScenarioHeadless(BUILD_BED_FLOW_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("`build`+single-cell（实机矩形单格）→ place_furniture:bed → 蓝图与 construct-blueprint 工单", () => {
    const sim = createHeadlessSim({ seed: BUILD_BED_FLOW_SCENARIO.seed });
    sim.spawnPawn("Builder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);
    const cell = { col: 11, row: 5 };
    const key = coordKey(cell);
    const outcome = sim.commitPlayerSelection({
      toolId: "build",
      selectionModifier: "replace",
      cellKeys: new Set([key]),
      inputShape: "single-cell",
      currentMarkers: new Map(),
      nowMs: 0
    });
    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("place_furniture:bed");
    expect(outcome.submitResult?.accepted).toBe(true);
    expect(outcome.submitResult?.messages.some((m) => m.includes("床铺"))).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const blueprints = [...world.entities.values()].filter(
      (e) => e.kind === "blueprint" && e.blueprintKind === "bed"
    );
    expect(blueprints).toHaveLength(1);
    const constructs = [...world.workItems.values()].filter((w) => w.kind === "construct-blueprint");
    expect(constructs).toHaveLength(1);
    expect(constructs[0]!.status).toBe("open");
  });

  it("applyDomainCommandToWorldCore 含 place_furniture:bed 分支", () => {
    const srcPath = join(__dirname, "..", "..", "src", "player", "apply-domain-command.ts");
    const src = readFileSync(srcPath, "utf8");
    expect(src).toContain('"place_furniture:bed"');
    expect(src).toContain("applyDomainCommandToWorldCore");
  });
});
