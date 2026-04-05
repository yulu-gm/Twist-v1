/** sim-config：模拟层集中参数（与 Phaser 无关）。 */

import type { NeedKind } from "../pawn-state";

export type SimConfig = Readonly<{
  /** 每格移动耗时（秒）。 */
  moveDurationSec: number;
  /** 开局随机石头格数量。 */
  stoneCellCount: number;
  /** 需求每秒增长速率。 */
  needGrowthPerSec: Readonly<Record<NeedKind, number>>;
}>;

export const DEFAULT_SIM_CONFIG: SimConfig = {
  moveDurationSec: 0.42,
  stoneCellCount: 14,
  needGrowthPerSec: {
    hunger: 2.6,
    rest: 1.9,
    recreation: 1.4
  }
};
