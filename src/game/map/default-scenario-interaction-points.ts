/**
 * 默认关卡交互点样板（关卡/种子数据）；与 {@link world-grid!DEFAULT_WORLD_GRID} 几何默认分离，避免双真相。
 */

import { DEFAULT_WORLD_GRID, type InteractionPoint, type WorldGridConfig } from "./world-grid";

export const DEFAULT_SCENARIO_INTERACTION_POINTS: readonly InteractionPoint[] = [
  {
    id: "food-1",
    kind: "food",
    cell: { col: 5, row: 7 },
    useDurationSec: 2.4,
    needDelta: { hunger: -55 }
  },
  {
    id: "bed-1",
    kind: "bed",
    cell: { col: 9, row: 7 },
    useDurationSec: 3.6,
    needDelta: { rest: -65 }
  },
  {
    id: "bed-2",
    kind: "bed",
    cell: { col: 10, row: 7 },
    useDurationSec: 3.6,
    needDelta: { rest: -65 }
  },
  {
    id: "recreation-1",
    kind: "recreation",
    cell: { col: 14, row: 6 },
    useDurationSec: 2.8,
    needDelta: { recreation: -50 }
  },
  {
    id: "recreation-2",
    kind: "recreation",
    cell: { col: 15, row: 6 },
    useDurationSec: 2.8,
    needDelta: { recreation: -50 }
  }
];

/** 与默认几何组合后的交互点模板（编排器 `interactionTemplate`、无自定义网格时的 headless 等）。 */
export const DEFAULT_INTERACTION_TEMPLATE_GRID: WorldGridConfig = {
  ...DEFAULT_WORLD_GRID,
  interactionPoints: DEFAULT_SCENARIO_INTERACTION_POINTS
};
