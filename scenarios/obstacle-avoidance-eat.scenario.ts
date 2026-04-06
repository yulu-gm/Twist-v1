import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/**
 * 食物在 (5,7)，途中 (4,7) 放石；小人自 (3,7) 出发须向 eat 规划移动并绕开石格。
 * 与 `chooseStepTowardCell` + `isWalkableCell` 行为一致，供无头与面板复现。
 */
const BARRIER: { col: number; row: number } = { col: 4, row: 7 };
const START: { col: number; row: number } = { col: 3, row: 7 };

export const OBSTACLE_AVOIDANCE_EAT_SCENARIO: ScenarioDefinition = {
  name: "obstacle-avoidance-eat",
  description: "饥饿走向 food-1 时绕开正面障碍格",
  seed: 0x0b_57_41_43_4c,
  obstacles: [{ cell: BARRIER, label: "eat-path-stone" }],
  pawns: [
    {
      name: "Hungry",
      cell: START,
      overrides: {
        satiety: 6,
        needs: { hunger: 93, rest: 18, recreation: 22 }
      }
    }
  ],
  expectations: [
    {
      label: "pawn-0 将进食列为当前目标（绕开障碍后仍可对准 food-1）",
      type: "pawn-reaches-goal",
      params: { goalKind: "eat", pawnId: "pawn-0" },
      maxTicks: 2_000
    }
  ],
  manualAcceptance: {
    steps: [
      "载入场景：Hungry 在 (3,7)，(4,7) 为障碍石，食物 food-1 在 (5,7)。",
      "运行模拟：小人应绕开 (4,7) ，仍向食物移动并最终以 eat 为目标。"
    ],
    outcomes: ["无头：2000 tick 内 `currentGoal.kind === eat`（与 Vitest 一致）。"]
  }
};
