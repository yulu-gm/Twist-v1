/**
 * refactor-test：保留回归（day-one 地图 bootstrap 直连），MAP-001 主证据以双场景注册
 * + `scenario-runner.test.ts` 冒烟为准；本文件断言首屏树/食物/小人可见。
 */
import { describe, expect, it } from "vitest";
import { isInsideGrid } from "../../src/game/map";
import { captureVisibleState, createHeadlessSim } from "../../src/headless";
import { hydrateScenario, runAllExpectations } from "../../src/headless/scenario-runner";
import {
  STORY_1_DAY_ONE_BOOTSTRAP_EXPECTATIONS,
  STORY_1_DAY_ONE_SCENARIO,
  STORY_1_FOOD_CELLS,
  STORY_1_TREE_CELL
} from "../../scenarios/story-1-day-one.scenario";

describe("MAP-001 map initial state", () => {
  it("hydrates the first-screen day-one map with visible pawns, tree, and ground food", () => {
    const sim = createHeadlessSim({
      seed: STORY_1_DAY_ONE_SCENARIO.seed,
      worldGrid: STORY_1_DAY_ONE_SCENARIO.gridConfig
    });
    const hydration = hydrateScenario(sim, STORY_1_DAY_ONE_SCENARIO);
    const world = sim.getWorldPort().getWorld();

    const results = runAllExpectations(sim, STORY_1_DAY_ONE_BOOTSTRAP_EXPECTATIONS);
    expect(results.every((result) => result.passed)).toBe(true);
    expect(hydration.playerSelections).toEqual([]);

    expect(sim.getPawns()).toHaveLength(3);
    expect(sim.getPawns().every((pawn) => isInsideGrid(world.grid, pawn.logicalCell))).toBe(true);

    const tree = [...world.entities.values()].find(
      (entity) =>
        entity.kind === "tree" &&
        entity.cell.col === STORY_1_TREE_CELL.col &&
        entity.cell.row === STORY_1_TREE_CELL.row
    );
    expect(tree).toBeDefined();
    expect(tree?.loggingMarked).toBe(false);

    const foods = STORY_1_FOOD_CELLS.map((cell) =>
      [...world.entities.values()].find(
        (entity) =>
          entity.kind === "resource" &&
          entity.materialKind === "food" &&
          entity.containerKind === "ground" &&
          entity.cell.col === cell.col &&
          entity.cell.row === cell.row
      )
    );
    expect(foods.every((food) => food !== undefined)).toBe(true);
    expect(foods.every((food) => food?.pickupAllowed === false)).toBe(true);

    const visible = captureVisibleState(sim, { playerSelections: hydration.playerSelections });
    expect(visible.failures).toEqual([]);
    expect(visible.workItems).toEqual([]);
  });
});
