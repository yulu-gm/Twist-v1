/**
 * B 线玩家通道：人工验收场景定义（mock 网关 + 可选模拟层覆盖）。
 * 切换验收项时应整场景重启（`scene.restart`），以便地图与状态按本表重新生成。
 */

import type { MockWorldPortConfig } from "../player/mock-world-port";
import type { SimConfig } from "../game/sim-config";
import { DEFAULT_SIM_CONFIG } from "../game/sim-config";

/** 数据侧可序列化的 MockWorldPort 片段（格键为 string[]）。 */
export type ScenarioMockWorldPort = Readonly<{
  alwaysAccept?: boolean;
  rejectIfTouchesCellKeys?: readonly string[];
}>;

export type PlayerAcceptanceScenario = Readonly<{
  id: string;
  title: string;
  goal: string;
  steps: readonly string[];
  /**
   * 应用到 MockWorldPort（在 resetSession 之后整表替换基线）。
   * 未提供时等价于全部接受、无冲突格。
   */
  mockWorldPort?: ScenarioMockWorldPort;
  /** 进入时清空地图任务标记与玩家通道「最后结果」。 */
  resetMarkersOnEnter: boolean;
  showReplayButton?: boolean;
  /**
   * 可选：覆盖模拟层参数（如石头格数量、需求增长倍率），便于某场景专用世界桩。
   */
  simOverrides?: Readonly<{
    stoneCellCount?: number;
    /** 需求增长率乘在 DEFAULT_SIM_CONFIG.needGrowthPerSec 上。 */
    needGrowthScale?: number;
  }>;
}>;

/** 由验收场景得到网关完整配置（非部分合并，避免场景间泄漏规则）。 */
export function scenarioToMockWorldPortConfig(scenario: PlayerAcceptanceScenario): MockWorldPortConfig {
  const m = scenario.mockWorldPort;
  if (!m) {
    return { alwaysAccept: true, rejectIfTouchesCellKeys: new Set() };
  }
  return {
    alwaysAccept: m.alwaysAccept !== false,
    rejectIfTouchesCellKeys: new Set(m.rejectIfTouchesCellKeys ?? [])
  };
}

/** 首项为关闭说明展开（网关仍为接受一切）。 */
export const PLAYER_ACCEPTANCE_SCENARIOS: readonly PlayerAcceptanceScenario[] = [
  {
    id: "off",
    title: "关闭验收说明",
    goal: "不展开逐步验收说明；mock 网关为默认（全部接受）。",
    steps: ["需要按步骤验收时，在右下角验收列表中选对应项（将重启场景）。"],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: false,
    showReplayButton: false
  },
  {
    id: "b-m1-accept",
    title: "B-M1 · 命令被接受",
    goal: "框选或单点下发工具意图后，玩家通道出现「世界网关：接受」类文案。",
    steps: [
      "选小人工具列中的「伐木」(R)。",
      "在地图上拖拽框选一格或多格后松开鼠标。",
      "确认玩家通道结果为接受，且格上出现任务标记圆圈。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: true
  },
  {
    id: "b-m1-reject-cell",
    title: "B-M1 · 冲突格拒绝",
    goal: "若命令包含格键 (0,0)，mock 网关拒绝；不含 (0,0) 时通过。",
    steps: [
      "任选非「待机」工具（如割草 E）。",
      "框选「包含左上角格 0,0」的区域并松开，应看到「世界网关：拒绝」，且格上不应新增任务标记。",
      "再框选「完全不含 0,0」的区域，应看到「接受」，此时格上出现对应任务标记。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: ["0,0"] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "b-m1-global-reject",
    title: "B-M1 · 全局拒绝桩",
    goal: "mock 关闭接受时，任意有效命令均被拒绝。",
    steps: ["选开采(Q) 并任意框选一格。", "应始终显示拒绝。"],
    mockWorldPort: { alwaysAccept: false, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "b-m1-esc-cancel",
    title: "B-M1 · Esc 取消手势",
    goal: "拖拽中途按 Esc，预览消失，无脏提交。",
    steps: [
      "选任意可框选工具，左键拖拽框选（先不要松开）。",
      "按 Esc，确认预览消失。",
      "松开鼠标，不应因半截手势产生意外网关结果。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "b-m1-tool-switch",
    title: "B-M1 · 换工具清草稿",
    goal: "框选未完成时换工具，未提交 draft 被丢弃。",
    steps: [
      "选伐木(R)，左键拖出预览（先不要松开）。",
      "点击工具栏另一工具（如建造 T）。",
      "确认预览消失。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "b-m1-build-brush",
    title: "B-M1 · 建造笔刷路径",
    goal: "「建造」用笔刷折线；命令形状为 brush-stroke。",
    steps: [
      "选「建造」(T)。",
      "按下左键沿折线拖动至少 3 格后松开。",
      "确认沿路有标记且网关接受。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "b-m1-idle-clear",
    title: "B-M1 · 待机清除标记",
    goal: "待机框选已有标记格时下发清除意图并被接受。",
    steps: [
      "先用伐木打出若干标记。",
      "选「待机」(O)，框选这些格并松开。",
      "标记应消失，网关接受。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: false,
    showReplayButton: false
  },
  {
    id: "b-m1-replay-log",
    title: "B-M1 · 命令日志回放",
    goal: "回放将命令队列再次提交且结果仍为接受。",
    steps: [
      "用任意工具成功提交至少两次命令。",
      "点击「回放命令日志」，应提示条数且均为接受。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: true
  },
  {
    id: "b-m2-need-signals",
    title: "B-M2 · 需求信号展示",
    goal: "详情面板展示需求紧急度与打断许可桩；本场景加快需求增长便于观察。",
    steps: [
      "在顶部名册选一名小人，看右侧详情。",
      "加速时间或等待数秒，观察「需求信号」「打断许可」变化。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { needGrowthScale: 2.8 },
    resetMarkersOnEnter: false,
    showReplayButton: false
  },
  {
    id: "demo-sparse-map",
    title: "演示 · 稀疏石头地图",
    goal: "示例：用 simOverrides 减少随机石格，便于行走验收。",
    steps: ["切换至此项后场景重启。", "地面应仅有少量石头格（mock 桩）。"],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 4 },
    resetMarkersOnEnter: true,
    showReplayButton: false
  }
] as const;

export const DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID = "off";

export function playerAcceptanceScenarioById(
  id: string
): PlayerAcceptanceScenario | undefined {
  return PLAYER_ACCEPTANCE_SCENARIOS.find((s) => s.id === id);
}

/** 按验收场景的 simOverrides 得到本局 SimConfig（无覆盖则返回默认）。 */
export function resolveSimConfigForScenario(
  scenario: PlayerAcceptanceScenario | undefined
): SimConfig {
  const so = scenario?.simOverrides;
  if (!so || (so.stoneCellCount === undefined && so.needGrowthScale === undefined)) {
    return DEFAULT_SIM_CONFIG;
  }
  const scale = so.needGrowthScale ?? 1;
  const base = DEFAULT_SIM_CONFIG.needGrowthPerSec;
  return {
    ...DEFAULT_SIM_CONFIG,
    stoneCellCount: so.stoneCellCount ?? DEFAULT_SIM_CONFIG.stoneCellCount,
    needGrowthPerSec:
      scale === 1
        ? base
        : {
            hunger: base.hunger * scale,
            rest: base.rest * scale,
            recreation: base.recreation * scale
          }
  };
}
