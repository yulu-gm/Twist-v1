import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import { claimWorkItem } from "../../src/game/world-core";
import { createHeadlessSim } from "../../src/headless";
import { runScenarioHeadless } from "../../src/headless/scenario-runner";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { BUILD_WALL_FLOW_SCENARIO } from "../../scenarios/build-wall-flow.scenario";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("build_wall_blueprint → WorldCore（玩家选区路径）", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("三格笔刷：`build`+brush-stroke → 3 个 wall 蓝图 + 3 条 construct-blueprint；逐条认领后落成墙建筑", () => {
    const sim = createHeadlessSim({ seed: BUILD_WALL_FLOW_SCENARIO.seed });
    sim.spawnPawn("WallBuilder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);

    const cells = [
      { col: 14, row: 5 },
      { col: 15, row: 5 },
      { col: 16, row: 5 }
    ];
    const keys = cells.map((c) => coordKey(c));
    const outcome = sim.commitPlayerSelection({
      toolId: "build",
      selectionModifier: "replace",
      cellKeys: new Set(keys),
      inputShape: "brush-stroke",
      currentMarkers: new Map(),
      nowMs: 0
    });
    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("build_wall_blueprint");
    expect(outcome.submitResult?.accepted).toBe(true);
    expect(outcome.submitResult?.messages.some((m) => m.includes("墙蓝图"))).toBe(true);

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

  it("单格墙笔刷：不手工认领，靠 autoClaim + 走向锚格落成墙（与实机笔刷后一致）", () => {
    const sim = createHeadlessSim({ seed: BUILD_WALL_FLOW_SCENARIO.seed });
    sim.spawnPawn("WallBuilder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);
    // 与 build-wall-flow.scenario 的 playerSelectionAfterHydrate 目标格一致
    const cell = { col: 11, row: 6 };
    const outcome = sim.commitPlayerSelection({
      toolId: "build",
      selectionModifier: "replace",
      cellKeys: new Set([coordKey(cell)]),
      inputShape: "brush-stroke",
      currentMarkers: new Map(),
      nowMs: 0
    });
    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("build_wall_blueprint");
    const worldAfterBrush = sim.getWorldPort().getWorld();
    expect(
      [...worldAfterBrush.workItems.values()].some(
        (w) => w.kind === "construct-blueprint" && w.status === "open"
      )
    ).toBe(true);

    const done = sim.runUntil(() => {
      const w = sim.getWorldPort().getWorld();
      return [...w.entities.values()].some(
        (e) =>
          e.kind === "building" &&
          e.buildingKind === "wall" &&
          e.cell.col === cell.col &&
          e.cell.row === cell.row
      );
    }, { maxTicks: 5_000 });
    expect(done.reachedPredicate).toBe(true);
  });

  it("首段墙落成后经 idle 再布第二段墙：仍能 autoClaim 并完成（回归墙格可走振荡 + 游荡中拒认领）", () => {
    const sim = createHeadlessSim({ seed: BUILD_WALL_FLOW_SCENARIO.seed });
    sim.spawnPawn("WallBuilder", DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!);
    const cellFirst = { col: 11, row: 6 };
    const cellSecond = { col: 12, row: 6 };

    expect(
      sim.commitPlayerSelection({
        toolId: "build",
        selectionModifier: "replace",
        cellKeys: new Set([coordKey(cellFirst)]),
        inputShape: "brush-stroke",
        currentMarkers: new Map(),
        nowMs: 0
      }).didSubmitToWorld
    ).toBe(true);

    const firstDone = sim.runUntil(() => {
      const w = sim.getWorldPort().getWorld();
      return [...w.entities.values()].some(
        (e) =>
          e.kind === "building" &&
          e.buildingKind === "wall" &&
          e.cell.col === cellFirst.col &&
          e.cell.row === cellFirst.row
      );
    }, { maxTicks: 6_000 });
    expect(firstDone.reachedPredicate).toBe(true);

    // 模拟「过一小段时间」：若墙格仍可走，小人易在墙与邻格间来回踱步并长期 isMoving，无法认领新单
    for (let i = 0; i < 200; i++) {
      sim.tick(16);
    }

    expect(
      sim.commitPlayerSelection({
        toolId: "build",
        selectionModifier: "replace",
        cellKeys: new Set([coordKey(cellSecond)]),
        inputShape: "brush-stroke",
        currentMarkers: new Map(),
        nowMs: 0
      }).didSubmitToWorld
    ).toBe(true);

    const secondDone = sim.runUntil(() => {
      const w = sim.getWorldPort().getWorld();
      return [...w.entities.values()].some(
        (e) =>
          e.kind === "building" &&
          e.buildingKind === "wall" &&
          e.cell.col === cellSecond.col &&
          e.cell.row === cellSecond.row
      );
    }, { maxTicks: 6_000 });
    expect(secondDone.reachedPredicate).toBe(true);
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
