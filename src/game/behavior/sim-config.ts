/**
 * sim-config：模拟层集中参数（与 Phaser 无关）。
 *
 * 与 `oh-code-design/需求系统.yaml`「需求规则配置」的对照：当前**有意分模块**，并非未实现。
 * - **下降速率**（`sim-loop` 经 `advanceNeeds` 应用的 needs 增长 / 与 satiety·energy 对立）：`needGrowthPerSec`。
 * - **恢复速率**（行为上下文下的进食、休息等净变化）：`need/need-evolution-engine.ts`、`need/satisfaction-settler.ts`。
 * - **警戒 / 紧急阈值与阶段**：`need/threshold-rules.ts`。
 * 若以后要单一配置源，可再引入并列类型（如 `NeedRulesConfig`）并统一注入上述模块；在此之前本类型只承载模拟 tick 侧可调项（含工单锚格读条等非需求字段）。
 */

import type { NeedKind } from "../pawn-state";
import type { WorkItemKind } from "../work/work-types";

export type SimConfig = Readonly<{
  /** 每格移动耗时（秒）。 */
  moveDurationSec: number;
  /** 开局随机石头格数量。 */
  stoneCellCount: number;
  /**
   * 需求侧「下降」在模拟 tick 中的每秒速率（经 `advanceNeeds`）；与设计中「需求规则配置·下降速率」语义对齐，恢复与阈值见文件头说明。
   */
  needGrowthPerSec: Readonly<Record<NeedKind, number>>;
  /** 工单锚格四向邻接读条时长（秒）；与 world-work-tick 锚格落成及 UI 进度条一致，策划可调。 */
  workItemAnchorDurationSec: Readonly<Record<WorkItemKind, number>>;
}>;

export const DEFAULT_SIM_CONFIG: SimConfig = {
  moveDurationSec: 0.42,
  stoneCellCount: 14,
  needGrowthPerSec: {
    hunger: 2.6,
    rest: 1.9,
    recreation: 1.4
  },
  workItemAnchorDurationSec: {
    "construct-blueprint": 2,
    "deconstruct-obstacle": 2,
    "chop-tree": 3,
    "mine-stone": 3,
    "pick-up-resource": 0.5,
    "haul-to-zone": 0.5
  }
};
