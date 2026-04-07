/** sim-config：模拟层集中参数（与 Phaser 无关）。 */

import type { NeedKind } from "./pawn-state";

export type SimConfig = Readonly<{
  /** 每格移动耗时（秒）。 */
  moveDurationSec: number;
  /** 开局随机石头格数量。 */
  stoneCellCount: number;
  /** 场景可行走格充足时，至少生成的树木格数量（与既有上限 8 取并集）。 */
  minSceneTreeCount: number;
  /** 开局至少生成的石块格数量（与 stoneCellCount 取较大者）。 */
  minSceneRockCount: number;
  /** 需求每秒增长速率。 */
  needGrowthPerSec: Readonly<Record<NeedKind, number>>;
  /** 执行工单（伐木/开采/拾取）耗时（秒）。 */
  workPerformDurationSec: number;
}>;

export const DEFAULT_SIM_CONFIG: SimConfig = {
  moveDurationSec: 0.42,
  stoneCellCount: 14,
  minSceneTreeCount: 1,
  minSceneRockCount: 1,
  needGrowthPerSec: {
    hunger: 0,
    rest: 0,
    recreation: 0
  },
  workPerformDurationSec: 2.4
};
