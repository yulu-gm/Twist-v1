# 审计：`src/game/need/`（T-08）

对照文档：[`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml)、[`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml)；总规范见 [`working-plan/remain-old-code-check/README.md`](README.md)。

---

## 一句结论

`src/game/need/` 在**同一模块内并列**了面向 `NeedSnapshot`（`satiety` / `energy`，与 [`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 中「饱食度 / 精力值」量纲一致）的演化与结算，以及面向 `PawnNeeds`（`hunger` / `rest` / `recreation`）的推进工具；其中 **`recreation` 与娱乐类交互点在策划 YAML 中未定义**，且 **`need-evolution-engine.ts` 的 `evolveNeeds` 在 `src` 主游戏路径无引用**（`tests/domain/need-evolution.test.ts` 等有单测），与主循环使用的 `advanceNeeds` 构成潜在双轨；**食物 / 床铺 / 娱乐 mock 点在地图样板中定义，经 `sim-loop` + `goal-driven-planning` 与 `need-utils` 中的 `recreation` 默认与增长率间接耦合**（本目录不直接 `import` 地图文件）。

---

## 要解决什么问题

本审计核对：`need` 子系统的领域边界是否与 [`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 的**需求类型**（仅「饱食度」「精力值」及进食/休息驱动行为）一致，是否满足 [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) 中 **NEED-001～NEED-004** 所描述的状态与输出，并标出 **mock 食物 / 娱乐交互点** 在数据流上的挂钩位置（不在本目录硬编码格子，但通过 `PawnNeeds` 与全局配置连贯）。

**与 [`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 的对照要点**

- 文档 **饱食度**：随时间下降、阈值触发饥饿、寻找食物、进食恢复。代码侧：`need-profile` / `threshold-rules` 用 `satiety` 与 `evaluateHungerStage`；`satisfaction-settler.settleEating` 与 `need-evolution-engine` 中 `eating` 行为速率对齐文档「进食恢复」方向（数值为工程待定）。
- 文档 **精力值**：白天消耗、夜间/阈值触发疲劳、床铺休息恢复。代码侧：`energy` + `evaluateFatigueStage`；`settleResting` 与 `resting` 行为速率对应「睡眠/休息恢复」。
- 文档 **需求驱动行为** 仅覆盖进食与休息。代码侧：`needActionSuggestion` 仅产出 `eat` | `rest` | `none`，与文档范围一致；**未出现「娱乐」需求类型**。
- **缺口**：`need-utils` 中 `DEFAULT_PAWN_NEEDS` 与 `advanceNeeds` 对 **`recreation`** 的读写，在 [`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 中**无对应条目**，属文档外能力。

**与 [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) 的对照要点**

- **NEED-001**：饱食度下降、阈值阶段、进食建议、结算回满——对应 `threshold-rules`、`needActionSuggestion`（向行为层可建议 `eat`）、`settleEating`；UI 文案不在本目录，但 `need-signals` 为 UI 提供饥饿紧迫度信号。
- **NEED-002**：夜晚疲劳、休息建议、睡眠期间精力恢复——与 `evaluateFatigueStage`、`needActionSuggestion`（`rest`）、`settleResting` 及演化中 `resting` 行为一致；**「时间系统广播夜晚」** 在验收 given 中，本目录不包含昼夜事件，仅消费行为状态（若主循环未传 `resting`，则依赖上游）。
- **NEED-003**：进食中断、部分恢复——`satisfaction-settler.settleInterrupted` 实现「参考秒数一半增量的部分结算」，与验收意图对齐；**是否**与行为系统的中断事件一一绑定需在集成层核对（非本目录职责）。
- **NEED-004**：数值锁 0、`critical` 阶段、最高优先级压力——`need-profile.clampNeedStat` 与 `evaluateHungerStage` / `evaluateFatigueStage` 在 ≤20 时为 `critical`，`needActionSuggestion` 在 `critical` 时 `allowInterrupt: true`；**「向行为系统持续输出最高优先级」** 的措辞需结合 `sim-loop` 消费方确认是否等价实现。

---

## 设计上怎么应对

- **应然**（按 route-demand）：[`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 为事实源时，`need` 模块应以 **饱食 / 精力** 单一清晰模型贯通演化、阈值、建议行动与 UI 信号；文档未写的维度不应在主路径长期双写三套字段。
- **现状**：`pawn-state` 已标注 `needs` 中 `hunger` / `rest` **deprecated**，主展示量为 `satiety` / `energy`，但 `advanceNeeds` 仍 **同时** 推进 `needs.*` 与 `satiety` / `energy`（饥饿与饱食互为反向增量），并额外推进 **`recreation`**；[`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 未定义娱乐，与 **地图样板中 `recreation-*` 交互点**（`DEFAULT_WORLD_GRID.interactionPoints`）形成「策划文档无、网格 mock 有」的链路，**娱乐属于典型「孤立需求 / mock 耦合」外延**。
- **现状**：`need-evolution-engine` 将消耗与 `BehaviorState` 绑定，是另一条演化公式；**`evolveNeeds` 未被 `src/game` 主循环挂载**（仅经 `index.ts` 导出，并有 domain 单测），若长期不与运行时统一，符合 README 中「多套并行 / 未挂载」风险画像。
- **现状**：[`need-signals.ts`](../../src/game/need/need-signals.ts) 注释写明 **mock 打断阈值**（休息 75、饥饿 80），与 `threshold-rules` 中 **WARNING 40 / CRITICAL 20**、`HUNGER_INTERRUPT_THRESHOLD` 70 等 **非同一套刻度**，易产生「面板信号 vs 模拟打断」不一致。

---

## 代码里大致怎么走

- **对外聚合**：[`index.ts`](../../src/game/need/index.ts) 导出工具、`NeedSnapshot` 流、`threshold-rules`、`evolution-engine`、满足结算器。
- **`need-profile.ts`**：`NeedSnapshot`（`satiety`、`energy`、`hungerStage`、`fatigueStage`）；创建与增量更新均 **clamp 0..100** 并重算阶段。
- **`threshold-rules.ts`**：`WARNING_THRESHOLD` / `CRITICAL_THRESHOLD`；`needActionSuggestion` 在阶段非 `normal` 时在吃/睡间择优；另有面向工单的 `HUNGER_INTERRUPT_THRESHOLD`、`REST_SLEEP_PRIORITY_THRESHOLD`（与 `game-orchestrator` 引用相关）。
- **`need-evolution-engine.ts`**：`DEFAULT_EVOLUTION_BY_BEHAVIOR` + `evolveNeeds( profile, dt, behaviorState )`；**主模拟循环未调用**（单测见 `tests/domain/need-evolution.test.ts`）。
- **`satisfaction-settler.ts`**：`settleEating` / `settleResting` / `settleInterrupted` / `isNeedSatisfied`，速率常数自 `need-evolution-engine` 引入以保持与「进食/休息演化」一致；`SatisfiableNeedKind` 仅 `hunger` | `fatigue`，**不含 recreation**。
- **`need-signals.ts`**：读 `PawnNeeds` 的 **`hunger` / `rest`**，映射为 `NeedUrgency` 与「是否允许为休息/饥饿打断工作」布尔量；**不读取 `recreation`**。
- **`need-utils.ts`**：`DEFAULT_PAWN_NEEDS`（含 **`recreation: 20`**）、`withPawnNeeds`、`advanceNeeds`（按 `Record<NeedKind, number>` 推进 `needs`，并对 `satiety` / `energy` 用 `hunger` / `rest` 速率双写）、`applyNeedDelta`；与地图交互的 `needDelta`（如 `food-1` 的 `hunger: -55`、`recreation-*` 的 `recreation: -50`）在 **交互结算处** 写入小人状态，**本文件不引用地图 ID**。
- **上游消费**：`sim-loop` 使用 `advanceNeeds`；[`hud-manager`](../../src/ui/hud-manager.ts) 用 `needSignalsFromNeeds` 展示「需求信号（B-M2 桩）」并并列显示 **娱乐** 数值；`flows/need-interrupt-flow` 使用 `NeedSnapshot` + `needActionSuggestion` + `settleEating`（流程轨，非 `tickSimulation` 唯一路径）。

---

## 尚不明确或需要产品/策划拍板

1. **`recreation` 是否纳入「需求系统」正式范围**：当前 [`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) 与 [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) 均未描述娱乐；若保留地图 **娱乐点**，是否补充 YAML 与验收场景，或从主循环 / 默认需求中移除，需策划决定。
2. **`NeedSnapshot` 轨与 `PawnNeeds` 轨的归一时间表**： deprecated 字段仍由 `advanceNeeds` 驱动时，**两条量纲**（紧迫度上升的 `hunger` vs 越高越饱的 `satiety`）对阅读者与 AI 审计成本较高；是否以文档为准统一到一种对外模型，需产品与工程共识。
3. **`evolveNeeds` / `BehaviorState` 演化表的去留**：若主游戏恒用 `advanceNeeds` + `needGrowthPerSec`，`need-evolution-engine` 是保留给未来 FSM 全量接入、还是删除/合并，依赖行为系统单一路线决策（参见行为子报告与 [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) 与行为验收的交叉引用）。
4. **打断与警告阈值单一来源**：[`need-signals.ts`](../../src/game/need/need-signals.ts) 中 **mock 阈值** 与 `threshold-rules`、工单打断阈值是否必须对齐到同一配置或同一函数，需产品确认 **UI 提示** 与 **实际打断** 是否允许暂时不一致。

---

## 问题清单（类型标注）

| 类型 | 说明 |
| --- | --- |
| **孤立需求** | **`recreation`**：在 [`need-utils.ts`](../../src/game/need/need-utils.ts) 默认与 `advanceNeeds` 中参与演化，但 [`oh-gen-doc/需求系统.yaml`](../../oh-gen-doc/需求系统.yaml) / [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) **均未定义**；与地图样板 **娱乐类 interactionPoint**（`recreation` kind、`needDelta.recreation`）构成 **mock 玩法扩展**，文档链路未闭合。 |
| **多套并行** | **`evolveNeeds`（`need-evolution-engine`）** 与主循环 **`advanceNeeds`（`need-utils`）** 两套时间演化；前者 **未接入 `sim-loop`**（有 domain 单测），后者驱动 [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) 所指「时间推进」的实际路径。 |
| **mock / 桩** | [`need-signals.ts`](../../src/game/need/need-signals.ts) 注释 **明示 mock 阈值**（75 / 80）；与 `threshold-rules` 阶段阈值、sim-loop 内工单打断逻辑 **非统一命名空间**，存在体验与调试上的分叉风险。 |
| **mock 食物 / 娱乐点耦合（数据契约）** | **食物**：策划 YAML 强调「包装食品」等叙事，代码网格为通用 **`food` 交互点** + `needDelta.hunger`（[`world-grid.ts`](../../src/game/map/world-grid.ts) 样板 `food-1`）；需求侧不绑定实体类型，**叙事与地图样板 ID 的耦合在地图/策划层**。 **娱乐**：同上，**`recreation-*` 点** 仅通过 `needDelta.recreation` 与 `PawnNeeds` / `advanceNeeds` 及 `goal-driven-planning` 的 `recreate` 目标相连，**需求模块提供 `recreation` 槽位但未在需求 YAML 中立项**。 |
| **验收交叉** | [`oh-acceptance/需求系统.yaml`](../../oh-acceptance/需求系统.yaml) **NEED-003** 依赖「行为系统通知需求系统」；本目录仅有结算函数，**集成契约**需在行为与编排层报告中闭合。 |

（`rg` 检索范围：`src/game/need/`；关键词含 `mock`、`compat`、`legacy`、`legacy`、`stub`、`deprecated`、`fake`、`TODO` 等时，**除 `need-signals.ts` 中两处 mock 注释外无其他命中**。）
