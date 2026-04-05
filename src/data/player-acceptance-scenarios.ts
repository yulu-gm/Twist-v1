/**
 * 人工验收场景（A/B 合并后）：WorldCore 真实接缝 + 可选网关注入规则 + 模拟层覆盖。
 * 切换验收项时应整场景重启（`scene.restart`），以便地图与状态按本表重新生成。
 */

import type { MockWorldPortConfig } from "../player/world-port-types";
import type { SimConfig } from "../game/sim-config";
import { DEFAULT_SIM_CONFIG } from "../game/sim-config";

/** 数据侧可序列化的网关验收片段（格键为 string[]）。 */
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
   * 并入本局 `WorldGridConfig.blockedCellKeys`（与随机石格合并），用于领域层障碍格拒斥等验收。
   */
  forcedBlockedCellKeys?: readonly string[];
  /**
   * 应用到世界网关（`WorldCoreWorldPort` / `MockWorldPort`）：在 `resetSession` 之后整表替换规则。
   * 未提供时等价于全部接受、无额外冲突格注入。
   */
  mockWorldPort?: ScenarioMockWorldPort;
  /** 进入时清空地图任务标记与玩家通道「最后结果」。 */
  resetMarkersOnEnter: boolean;
  showReplayButton?: boolean;
  /**
   * 可选：覆盖模拟层参数（如石头格数量、需求增长倍率）。
   */
  simOverrides?: Readonly<{
    stoneCellCount?: number;
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

export const PLAYER_ACCEPTANCE_SCENARIOS: readonly PlayerAcceptanceScenario[] = [
  {
    id: "off",
    title: "关闭验收说明",
    goal: "不展开步骤说明；网关为默认（接受有效领域结果，无注入冲突格）。",
    steps: ["需要逐步验收时，在右下角列表选择场景（将重启场景）。"],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: false,
    showReplayButton: false
  },
  {
    id: "ab-demolish-stone-workorder",
    title: "合并 · 拆除石格 → 工单",
    goal: "在注入障碍实体的石格上下达拆除，领域接受并生成拆除工单；文案含「领域」或工单描述。",
    steps: [
      "建议先选「演示 · 稀疏石头」或本场景自带少量石格（默认生成亦有随机石格）。",
      "选「拆除」(W)，框选一块**红色石块**所在格并松开。",
      "玩家通道应显示**接受**；格上出现「拆除」类任务标记；脚注「世界快照」中工单/标记计数应反映世界状态。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 10 },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-build-bed-blueprint",
    title: "合并 · 空地上铺床蓝图",
    goal: "在无障碍占用的空格上建造，领域接受并落下床铺蓝图与建造工单。",
    steps: [
      "选「建造」(T)，在**确认无石块**的连续空格上框选或用笔刷拖过至少两格后松开。",
      "应显示**接受**，文案提示床铺/蓝图；各格有「建造」标记。",
      "若误点在石格上，应显示**拒绝**（占用冲突），且不修改已成功铺下的其它格（单条命令内为先失败则整笔拒绝时可换一格重试）。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 6 },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-build-rejected-on-stone",
    title: "合并 · 建造落在石格 → 领域拒绝",
    goal: "验证 WorldCore 占用检测：蓝图不能与已有障碍实体重叠。",
    steps: [
      "选「演示 · 稀疏石头」或本项（少石格）后，选「建造」(T)。",
      "单点或框选**仅覆盖已知石块**的格并松开。",
      "应显示**拒绝**，且石格上**不应**出现建造标记。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 8 },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-idle-clears-world-markers",
    title: "合并 · 待机清除同步世界标记",
    goal: "先对石格下达拆除产生世界侧标记，再用待机框选同格清除，`clear_task_markers` 同步清掉 WorldCore 标记与未认领开放工单。",
    steps: [
      "选「拆除」(W)，框选一块石格并松开，确认接受且出现标记。",
      "选「待机」(O)，框选**同一格**并松开。",
      "标记应消失且接受；脚注中标记/工单计数应回落（未认领工单被收回）。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 10 },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-intent-only-tool",
    title: "合并 · 伐木等仅存意图（无工单）",
    goal: "伐木/开采等尚未映射到 WorldCore 工单时仍接受，仅更新 UI 标记；脚注实体/工单计数不因该类命令增加工单。",
    steps: [
      "选「伐木」(R) 或「开采」(Q)，框选若干空格并松开。",
      "应显示接受；格上出现对应中文标记。",
      "对比脚注：工单数不应像「拆除」那样递增（或记下快照后再下达拆除对比）。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-gateway-reject-cell",
    title: "领域 · 障碍格 (0,0) 拒斥通用指派",
    goal: "左上角格固定为石块：对伐木/割草等非拆除类意图，领域因障碍格拒绝；拆除石块本身仍走工单流程。",
    forcedBlockedCellKeys: ["0,0"],
    steps: [
      "选「割草」(E) 或「伐木」(R) 等非拆除工具。",
      "框选包含左上角格 **0,0**（本场景固定为石格）的区域，应**拒绝**，且无新标记。",
      "再框选完全不含 0,0 的空格区域，应**接受**并出现标记。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-gateway-global-reject",
    title: "网关注入 · 全局拒绝",
    goal: "验收桩关闭 alwaysAccept 时任意有效命令均被拒绝。",
    steps: ["选「开采」(Q) 并任意框选一格。", "应始终显示**拒绝**。"],
    mockWorldPort: { alwaysAccept: false, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-replay-command-log",
    title: "合并 · 命令日志回放",
    goal: "从会话基线重放已记录命令，结果仍为接受（含领域与网关两层）。",
    steps: [
      "用拆除或建造成功提交至少两次命令（均需接受）。",
      "点击「回放命令日志」，应提示条数且接受数等于条数。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 10 },
    resetMarkersOnEnter: true,
    showReplayButton: true
  },
  {
    id: "ab-ux-esc-cancel",
    title: "交互 · Esc 取消手势",
    goal: "拖拽中途 Esc 取消预览，松手不产生提交。",
    steps: [
      "选任意可框选工具，左键拖出预览（先不松开）。",
      "按 Esc，预览应消失。",
      "再松开鼠标，不应出现新的网关结果文案。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-ux-tool-switch",
    title: "交互 · 换工具清草稿",
    goal: "框选未完成时切换工具栏槽位，草稿预览被丢弃。",
    steps: [
      "选「伐木」(R)，左键拖出预览（先不松开）。",
      "点击另一工具（如「建造」T）。",
      "预览应消失。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-build-brush-stroke",
    title: "交互 · 建造笔刷折线",
    goal: "建造工具使用 brush-stroke 输入形状，多格连续接受。",
    steps: [
      "选「建造」(T)，左键沿折线拖过至少 3 格**空地平**后松开。",
      "沿路格均应有标记且网关接受（若一笔触石则整笔按领域规则可能拒绝）。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { stoneCellCount: 5 },
    resetMarkersOnEnter: true,
    showReplayButton: false
  },
  {
    id: "ab-need-signals-panel",
    title: "需求 · 详情信号与打断提示",
    goal: "详情面板展示需求紧急度与打断许可；本场景加快需求增长便于观察。",
    steps: [
      "顶部名册选一名小人，看右侧详情。",
      "加速时间或等待数秒，观察「需求信号」「打断许可」变化。"
    ],
    mockWorldPort: { alwaysAccept: true, rejectIfTouchesCellKeys: [] },
    simOverrides: { needGrowthScale: 2.8 },
    resetMarkersOnEnter: false,
    showReplayButton: false
  },
  {
    id: "demo-sparse-stones",
    title: "演示 · 稀疏石头地图",
    goal: "减少随机石格数量，便于走位与对准石格做拆除/建造对照。",
    steps: ["切换后场景重启。", "地面应有少量石块，其余可走。"],
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
