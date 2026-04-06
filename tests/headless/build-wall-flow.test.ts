import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import { claimWorkItem } from "../../src/game/world-core";
import { createHeadlessSim } from "../../src/headless";
import { runScenarioHeadless } from "../../src/headless/scenario-runner";
import type { DomainCommand } from "../../src/player/s0-contract";
import { BUILD_WALL_FLOW_SCENARIO } from "../../scenarios/build-wall-flow.scenario";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeBuildWallBlueprintCommand(targetCellKeys: readonly string[]): DomainCommand {
  return {
    commandId: `cmd-wall-${targetCellKeys.join("-")}`,
    verb: "build_wall_blueprint",
    targetCellKeys: [...targetCellKeys],
    targetEntityIds: [],
    sourceMode: {
      source: { kind: "toolbar", toolId: "build_wall_blueprint" },
      selectionModifier: "replace",
      inputShape: "rect-selection"
    }
  };
}

describe("build_wall_blueprint → WorldCore", () => {
  it("三格提交：3 个 wall 蓝图 + 3 条 construct-blueprint；逐条认领后落成墙建筑", () => {
    const sim = createHeadlessSim({ seed: BUILD_WALL_FLOW_SCENARIO.seed });
    sim.spawnPawn("WallBuilder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);

    const cells = [
      { col: 14, row: 5 },
      { col: 15, row: 5 },
      { col: 16, row: 5 }
    ];
    const keys = cells.map((c) => coordKey(c));
    const submit = sim.getWorldPort().submit(makeBuildWallBlueprintCommand(keys), 0);
    expect(submit.accepted).toBe(true);
    expect(submit.messages.some((m) => m.includes("墙蓝图"))).toBe(true);

    const world0 = sim.getWorldPort().getWorld();
    const blueprints = [...world0.entities.values()].filter(
      (e) => e.kind === "blueprint" && e.blueprintKind === "wall"
    );
    expect(blueprints).toHaveLength(3);
    const constructs = [...world0.workItems.values()].filter((w) => w.kind === "construct-blueprint");
    expect(constructs).toHaveLength(3);
    expect(constructs.every((w) => w.status === "open")).toBe(true);

    const pawn = sim.getPawns().find((p) => p.name === "WallBuilder");
    expect(pawn).toBeDefined();

    for (;;) {
      const nextOpen = [...sim.getWorldPort().getWorld().workItems.values()].find(
        (w) => w.kind === "construct-blueprint" && w.status === "open"
      );
      if (!nextOpen) break;
      const claimed = claimWorkItem(sim.getWorldPort().getWorld(), nextOpen.id, pawn!.id);
      expect(claimed.outcome.kind).toBe("claimed");
      sim.getWorldPort().setWorld(claimed.world);
      const done = sim.runUntil(() => {
        const w = sim.getWorldPort().getWorld().workItems.get(nextOpen.id);
        return w?.status === "completed";
      }, { maxTicks: 5_000 });
      expect(done.reachedPredicate).toBe(true);
    }

    const buildings = [...sim.getWorldPort().getWorld().entities.values()].filter(
      (e) => e.kind === "building" && e.buildingKind === "wall"
    );
    expect(buildings).toHaveLength(3);
    for (const c of cells) {
      expect(buildings.some((b) => b.cell.col === c.col && b.cell.row === c.row)).toBe(true);
    }
  });

  it("build-wall-flow scenario passes expectations", () => {
    const { results } = runScenarioHeadless(BUILD_WALL_FLOW_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("applyDomainCommandToWorldCore 含 build_wall_blueprint 分支", () => {
    const srcPath = join(__dirname, "..", "..", "src", "player", "apply-domain-command.ts");
    const src = readFileSync(srcPath, "utf8");
    expect(src).toContain('"build_wall_blueprint"');
    expect(src).toContain("applyDomainCommandToWorldCore");
  });
});
