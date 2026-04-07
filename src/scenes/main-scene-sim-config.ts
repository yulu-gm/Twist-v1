/**
 * 交互客户端（含 Phaser 主场景）相对 {@link DEFAULT_SIM_CONFIG} 的需求增长倍率装配。
 * 与纯模拟参数 {@link SimConfig} 分离，避免呈现语境泄漏进 `behavior/`。
 */

import { DEFAULT_SIM_CONFIG, type SimConfig } from "../game/behavior/sim-config";

/** 仅缩放 `needGrowthPerSec`，使 playable 场景下需求变化更易观察。 */
export const INTERACTIVE_CLIENT_NEED_GROWTH_SCALE = 0.05;

/** 交互客户端用：移动/石头/工单锚格等沿用默认，需求增长按 {@link INTERACTIVE_CLIENT_NEED_GROWTH_SCALE} 缩放。 */
export function createInteractiveClientSimConfig(): SimConfig {
  const d = DEFAULT_SIM_CONFIG;
  const s = INTERACTIVE_CLIENT_NEED_GROWTH_SCALE;
  return {
    ...d,
    needGrowthPerSec: {
      hunger: d.needGrowthPerSec.hunger * s,
      rest: d.needGrowthPerSec.rest * s,
      recreation: d.needGrowthPerSec.recreation * s
    }
  };
}
