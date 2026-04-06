import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * refactor-test：保留回归（命令/工单直连），WORK-003 主证据以 `chop-tree-command.scenario.ts` expectations
 * + `scenario-runner.test.ts` 为准。
 */
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { CHOP_TREE_COMMAND_SCENARIO } from "../../scenarios/chop-tree-command.scenario";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import type { ScenarioDefinition } from "../../src/headless/scenario-types";
import type { DomainCommand } from "../../src/player/s0-contract";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeLumberCommand(targetCellKeys: readonly string[]): DomainCommand {
  return {
    commandId: `cmd-lumber-${targetCellKeys.join("-")}`,
    verb: "assign_tool_task:lumber",
    targetCellKeys: [...targetCellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "menu", menuId: "orders", itemId: "lumber" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  };
}

describe("chop-tree-command（lumber → WorldCore）", () => {
  it("hydrate + submit lumber：树 loggingMarked 且存在 open 的 chop-tree 工单", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_COMMAND_SCENARIO.seed });
    const def: ScenarioDefinition = {
      ...CHOP_TREE_COMMAND_SCENARIO,
      domainCommandsAfterHydrate: undefined,
      expectations: undefined
    };
    hydrateScenario(sim, def);

    const treeCell = CHOP_TREE_COMMAND_SCENARIO.trees![0]!.cell;
    const beforeIds = new Set([...sim.getWorldPort().getWorld().workItems.keys()]);

    const result = sim
      .getWorldPort()
      .submit(makeLumberCommand([coordKey(treeCell)]), 1);

    expect(result.accepted).toBe(true);
    expect(result.messages.some((m) => m.includes("chop-tree"))).toBe(true);

    const trees = [...sim.getWorldPort().getWorld().entities.values()].filter((e) => e.kind === "tree");
    expect(trees).toHaveLength(1);
    expect(trees[0]!.loggingMarked).toBe(true);

    const chop = [...sim.getWorldPort().getWorld().workItems.values()].filter((w) => w.kind === "chop-tree");
    expect(chop.some((w) => w.status === "open")).toBe(true);
    expect(chop.some((w) => w.targetEntityId === trees[0]!.id && w.anchorCell.col === treeCell.col)).toBe(
      true
    );

    const newIds = [...sim.getWorldPort().getWorld().workItems.keys()].filter((id) => !beforeIds.has(id));
    expect(newIds.length).toBeGreaterThan(0);
  });

  it("无树格提交 lumber 不新增工单", () => {
    const sim = createHeadlessSim({ seed: CHOP_TREE_COMMAND_SCENARIO.seed });
    hydrateScenario(sim, CHOP_TREE_COMMAND_SCENARIO);

    const emptyKey = "1,1";
    const countBefore = sim.getWorldPort().getWorld().workItems.size;
    const result = sim.getWorldPort().submit(makeLumberCommand([emptyKey]), 2);
    expect(result.accepted).toBe(true);
    expect(sim.getWorldPort().getWorld().workItems.size).toBe(countBefore);
  });

  it("applyDomainCommandToWorldCore 的 lumber 分支含 chop-tree", () => {
    const srcPath = join(__dirname, "..", "..", "src", "player", "apply-domain-command.ts");
    const src = readFileSync(srcPath, "utf8");
    expect(src).toContain("lumber");
    expect(src).toContain("chop-tree");
  });
});
