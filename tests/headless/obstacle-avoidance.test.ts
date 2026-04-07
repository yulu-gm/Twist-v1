/**
 * 障碍避让无头测试：
 * - `obstacle-avoidance-eat`：面板 / runScenarioHeadless 与 Vitest 对齐。
 * - 进食绕行：`hydrate` 后继续模拟，直至小人离开起点；复盘 `pawn-moved` 不落石格。
 * - 建造：`build_wall_blueprint` 链路与 `build-wall-flow` 一致，另在远距格放石验证「不踩该格」。
 * refactor-test：本场景不在 36 个 `scenario_id` 清单内；作为 ALL_SCENARIOS 扩展回归，由 `scenario-runner.test.ts` 冒烟覆盖。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SIM_CONFIG } from "../../src/game/behavior";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import { seedBlockedCellsAsObstacles } from "../../src/game/world-seed-obstacles";
import { claimWorkItem } from "../../src/game/world-core";
import { createHeadlessSim, hydrateScenario } from "../../src/headless";
import { runScenarioHeadless } from "../../src/headless/scenario-runner";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { OBSTACLE_AVOIDANCE_EAT_SCENARIO } from "../../scenarios/obstacle-avoidance-eat.scenario";

function collectBlockedKeysFromGrid(sim: ReturnType<typeof createHeadlessSim>): Set<string> {
  return new Set(sim.getWorldPort().getWorld().grid.blockedCellKeys ?? []);
}

function attachObstaclesAndResync(sim: ReturnType<typeof createHeadlessSim>, keys: ReadonlySet<string>): void {
  const next = seedBlockedCellsAsObstacles(sim.getWorldPort().getWorld(), keys);
  sim.getWorldPort().setWorld(next);
  sim.tick(16);
}

function assertNoPawnMovedOntoBlocked(
  sim: ReturnType<typeof createHeadlessSim>,
  blocked: ReadonlySet<string>
): void {
  for (const e of sim.getSimEventCollector().getEvents()) {
    if (e.kind !== "pawn-moved") continue;
    expect(blocked.has(coordKey(e.after)), `落脚在阻挡格: ${coordKey(e.after)}`).toBe(false);
  }
}

describe("obstacle-avoidance headless", () => {
  it("hydrate 后首帧同步：grid.blockedCellKeys 含障碍石格（无头可走性依赖）", () => {
    const sim = createHeadlessSim({ seed: OBSTACLE_AVOIDANCE_EAT_SCENARIO.seed });
    hydrateScenario(sim, OBSTACLE_AVOIDANCE_EAT_SCENARIO);
    sim.tick(16);
    expect(collectBlockedKeysFromGrid(sim).has(coordKey({ col: 4, row: 7 }))).toBe(true);
  });

  it("scenario obstacle-avoidance-eat 满足期望", () => {
    const { results } = runScenarioHeadless(OBSTACLE_AVOIDANCE_EAT_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("进食绕行：离开起点后全程 pawn-moved 不落石格", () => {
    const sim = createHeadlessSim({ seed: OBSTACLE_AVOIDANCE_EAT_SCENARIO.seed });
    hydrateScenario(sim, OBSTACLE_AVOIDANCE_EAT_SCENARIO);
    sim.tick(16);
    const blocked = collectBlockedKeysFromGrid(sim);
    expect(blocked.has(coordKey({ col: 4, row: 7 }))).toBe(true);

    const start = { ...sim.getPawns()[0]!.logicalCell };
    let leftStart = false;
    const maxTicks = 15_000;
    for (let i = 0; i < maxTicks; i += 1) {
      const p = sim.getPawns()[0]!;
      if (p.logicalCell.col !== start.col || p.logicalCell.row !== start.row) {
        leftStart = true;
        break;
      }
      sim.tick(16);
    }
    expect(leftStart, `应在 ${maxTicks} tick 内离开起点以验证绕行`).toBe(true);

    assertNoPawnMovedOntoBlocked(sim, blocked);
    const moves = sim.getSimEventCollector().getEvents().filter((e) => e.kind === "pawn-moved");
    expect(moves.length).toBeGreaterThan(0);
  });

  it("建墙流程 + 远距石格：落成墙建筑且永不踩该石格", () => {
    resetDomainCommandIdSequence();
    const farStone = coordKey({ col: 2, row: 1 });
    const wallCell = { col: 14, row: 5 };
    const start = { col: 11, row: 5 };

    const sim = createHeadlessSim({
      seed: 0x77_41_4c_4c,
      simConfig: {
        ...DEFAULT_SIM_CONFIG,
        moveDurationSec: 0.12,
        needGrowthPerSec: { hunger: 0, rest: 0, recreation: 0 }
      }
    });
    attachObstaclesAndResync(sim, new Set([farStone]));
    const blocked = collectBlockedKeysFromGrid(sim);
    expect(blocked.has(farStone)).toBe(true);

    const pawn = sim.spawnPawn("Mason", start, {
      needs: { hunger: 10, rest: 40, recreation: 40 }
    });

    const brush = sim.commitPlayerSelection({
      commandId: "build-wall",
      selectionModifier: "replace",
      cellKeys: new Set([coordKey(wallCell)]),
      inputShape: "brush-stroke",
      currentMarkers: new Map(),
      nowMs: 0
    });
    expect(brush.submitResult?.accepted).toBe(true);

    const work = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (w) => w.kind === "construct-blueprint" && w.status === "open"
    );
    expect(work).toBeDefined();
    const claimed = claimWorkItem(sim.getWorldPort().getWorld(), work!.id, pawn.id);
    expect(claimed.outcome.kind).toBe("claimed");
    sim.getWorldPort().setWorld(claimed.world);

    const workId = work!.id;
    for (let i = 0; i < 25_000; i += 1) {
      const wk = sim.getWorldPort().getWorld().workItems.get(workId);
      const hasWall = [...sim.getWorldPort().getWorld().entities.values()].some(
        (e) =>
          e.kind === "building" &&
          e.buildingKind === "wall" &&
          e.cell.col === wallCell.col &&
          e.cell.row === wallCell.row
      );
      if (wk?.status === "completed" || hasWall) break;
      sim.tick(16);
    }

    expect(
      [...sim.getWorldPort().getWorld().entities.values()].some(
        (e) =>
          e.kind === "building" &&
          e.buildingKind === "wall" &&
          e.cell.col === wallCell.col &&
          e.cell.row === wallCell.row
      )
    ).toBe(true);

    assertNoPawnMovedOntoBlocked(sim, blocked);
  });
});
