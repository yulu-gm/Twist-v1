import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { HAUL_MARK_PICKUP_SCENARIO } from "../../scenarios/haul-mark-pickup.scenario";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario, runScenarioHeadless } from "../../src/headless/scenario-runner";
import type { DomainCommand } from "../../src/player/s0-contract";
import type { ScenarioDefinition } from "../../src/headless/scenario-types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeHaulCommand(targetCellKeys: readonly string[]): DomainCommand {
  return {
    commandId: `cmd-haul-${targetCellKeys.join("-")}`,
    verb: "assign_tool_task:haul",
    targetCellKeys: [...targetCellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId: "haul" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  };
}

describe("haul-mark-pickup（haul → pick-up-resource）", () => {
  it("runScenarioHeadless：expectation work-item-exists 通过", () => {
    const { report } = runScenarioHeadless(HAUL_MARK_PICKUP_SCENARIO);
    const results = report.assertionResults ?? [];
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("hydrate 后物资可拾取且存在 open 的 pick-up-resource 工单", () => {
    const sim = createHeadlessSim({ seed: HAUL_MARK_PICKUP_SCENARIO.seed });
    hydrateScenario(sim, HAUL_MARK_PICKUP_SCENARIO);

    const foodResources = [...sim.getWorldPort().getWorld().entities.values()].filter(
      (e) => e.kind === "resource" && e.materialKind === "food" && e.containerKind === "ground"
    );
    expect(foodResources).toHaveLength(2);
    expect(foodResources.every((e) => e.pickupAllowed === true)).toBe(true);

    const pickups = [...sim.getWorldPort().getWorld().workItems.values()].filter(
      (w) => w.kind === "pick-up-resource"
    );
    expect(pickups.some((w) => w.status === "open")).toBe(true);
    for (const res of foodResources) {
      expect(
        pickups.some((w) => w.targetEntityId === res.id && w.anchorCell.col === res.cell.col)
      ).toBe(true);
    }
  });

  it("submit haul：pickupAllowed 从 false 变为 true", () => {
    const sim = createHeadlessSim({ seed: HAUL_MARK_PICKUP_SCENARIO.seed });
    const def: ScenarioDefinition = {
      ...HAUL_MARK_PICKUP_SCENARIO,
      domainCommandsAfterHydrate: undefined,
      expectations: undefined
    };
    hydrateScenario(sim, def);

    const keys = HAUL_MARK_PICKUP_SCENARIO.resources!.map((r) => coordKey(r.cell));
    let foodResources = [...sim.getWorldPort().getWorld().entities.values()].filter(
      (e) => e.kind === "resource" && e.materialKind === "food"
    );
    expect(foodResources).toHaveLength(2);
    expect(foodResources.every((e) => e.pickupAllowed === false)).toBe(true);

    const result = sim.getWorldPort().submit(makeHaulCommand(keys), 1);
    expect(result.accepted).toBe(true);
    expect(result.messages.some((m) => m.includes("pick-up-resource"))).toBe(true);

    foodResources = [...sim.getWorldPort().getWorld().entities.values()].filter(
      (e) => e.kind === "resource" && e.materialKind === "food"
    );
    expect(foodResources.every((e) => e.pickupAllowed === true)).toBe(true);
    expect(
      [...sim.getWorldPort().getWorld().workItems.values()].some(
        (w) => w.kind === "pick-up-resource" && w.status === "open"
      )
    ).toBe(true);
  });

  it("applyDomainCommandToWorldCore 含 haul 与 pick-up-resource 分支", () => {
    const srcPath = join(__dirname, "..", "..", "src", "player", "apply-domain-command.ts");
    const src = readFileSync(srcPath, "utf8");
    expect(src).toContain('toolId === "haul"');
    expect(src).toContain("pick-up-resource");
  });
});
