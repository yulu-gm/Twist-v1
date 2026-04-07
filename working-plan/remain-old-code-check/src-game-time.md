# 审计：`src/game/time/`

对照文档：`oh-gen-doc/时间系统.yaml`、`oh-acceptance/时间系统.yaml`（下文逐条引用其中章节与场景编号，不粘贴全文）。

---

## 一句结论

`src/game/time` 把「日内推进、昼夜分段、跨日归一、暂停与倍速下的仿真步长、时间边界检测与订阅总线」收在同一目录；与 `oh-gen-doc/时间系统.yaml` 的「实时推进 + 暂停停表 + 昼夜循环」**大方向一致**，与 `oh-acceptance/时间系统.yaml` 的 **TIME-003 / TIME-004** 在代码层有直接落点。但目前存在 **三套可观测“时间信号”**（`WorldTimeEvent`、`TimeEventBus` 的 `TimeEvent`、`WorldTimeSnapshot` 本身），其中 **`advanceWorldClock` 返回的 `events` 在主循环中未被消费**；另有 **`GameOrchestrator` 与 `advanceWorldClock` 对 `effectiveSimulationDeltaSeconds` 的串联调用** 可能导致倍速与帧上限语义与文档「游戏速度可调节（`oh-gen-doc/时间系统.yaml` · `时间推进` · `影响因素`）」不一致。`time-of-day.ts` 内的 **调色板插值**（`TIME_OF_DAY_ANCHORS` / `sampleTimeOfDayPalette`）是强展示耦合，在验收 **TIME-001** 的 presentation 条中被隐含依赖，但 **`oh-gen-doc/时间系统.yaml` 未单独描述「栅格/界面色板随时刻插值」**，属于能力超前于策划叙述。

---

## 要解决什么问题（审计视角）

从 `oh-gen-doc/时间系统.yaml` 出发，策划关心：`时间结构` 下游戏日与昼夜、`时间推进` 下实时比与暂停/速度、`游戏初始时间` 的初始日与时段、`时间与行为的关联` 中读条/移动与昼夜触发，以及 `时间相关配置` 中仍标为待配置的日长与昼夜阈值、现实时间比率、速度档位。

从 `oh-acceptance/时间系统.yaml` 出发，验收关心：**TIME-001** 推进与昼夜切换、**TIME-002** 跨天归一与时段与事件、**TIME-003** 暂停冻结、**TIME-004** 单帧过大增量的安全截断。

本目录 **直接承担**「换算 + 判定 + 边界事件 + 展示用采样」中的核心前半段；**不实现** `oh-gen-doc/时间系统.yaml` 里 `时间与行为的关联` 的全量（读条/移动/需求衰减在其它系统，仅通过「仿真秒」间接依赖）。

---

## 设计上怎么应对（文档应然 vs 代码现状）

### 对照 `oh-gen-doc/时间系统.yaml`

| 文档节点 | 代码对应与备注 |
|----------|----------------|
| `时间结构` · `游戏日` · `白天` / `夜晚` | `world-time.ts` 中 `timePeriodForMinute`：白天 `[6:00, 18:00)`，其余为夜；与文档「白天结束后的夜晚」语义相容，但 **昼夜阈值被写死为 6/18**，而文档 `时间相关配置` · `待配置项` 写明 **「白天/夜晚的划分阈值」待配置** — 实现超前于策划定值。 |
| `时间推进` · `实时推进` · `速度` / `影响因素` | `time-of-day.ts` · `TimeOfDayConfig.realSecondsPerDay` 实现「现实秒 ↔ 日内分钟」；`TimeControlState.speed` 与 `paused` 参与 `effectiveSimulationDeltaSeconds`。文档中 **「待配置（游戏时间/现实时间比率）」** 在代码中有默认值（`DEFAULT_TIME_OF_DAY_CONFIG`），与文档「待配置」定性部分重叠。 |
| `时间推进` · `影响因素` · `游戏暂停时时间停止` | `effectiveSimulationDeltaSeconds` 在暂停时返回 `0`，与文档一致。 |
| `游戏初始时间` · `第一天` · `白天` | `createInitialTimeOfDayState` 使用 `startMinuteOfDay: 6 * 60`，首日落在白天段，与文档一致。 |
| `时间与行为的关联` | 本目录不负责读条/移动/需求；仅提供时间状态与事件钩子，与文档「机制在别模块」一致。 |
| `时间相关配置` · `待配置项` · `游戏速度档位设置` | `TimeSpeed = 1 \| 2 \| 3` 已是档位枚举；文档仍标待配置 — 实现略超前。 |

### 对照 `oh-acceptance/时间系统.yaml`

| 场景 | 代码对应与差异 | `oh-acceptance/时间系统.yaml` |
|------|----------------|------------------------------|
| **TIME-001** | `advanceTimeOfDay` + `normalizeTimeState` 累加游戏时间；`timePeriodForMinute` 切昼夜；`detectTimeEvents` 可产生 `night-start`；`sampleTimeOfDayPalette` + 编排侧 `onPaletteChanged` 支撑 presentation。 | `then.domain_state` 中「时间换算器」「时段判定器」「夜晚开始」与总线广播 — 与 `TimeEventBus` + `night-start` 大体对齐。 |
| **TIME-002** | `normalizeTimeState` 执行跨日进位与日内余数；`detectTimeEvents` 发 `new-day`（0:00）与后续 `day-start`（6:00）。 | `then.domain_state` 要求跨天后 **「时段重置为白天」** 并广播 **「跨天」和「白天开始」」** — 代码在 **日历日界线** 上先发 `new-day`，但 **0:00–6:00 仍为 `night`**（与 `timePeriodForMinute` 一致），**不会在跨过午夜瞬间产生 `day-start`**；「白天开始」仅发生在 **6:00**。若验收语义是「午夜即白天」，则 **与实现不符**；若语义是「新日历日始于凌晨但仍属夜直到 6 点」，则 **需在验收文案中收窄表述**。 |
| **TIME-003** | `simulationDt === 0` 时 `advanceWorldClock` 仍同步 `paused`/`speed` 到 `WorldTimeSnapshot`，且不推进日内分钟；编排侧短路不跑读条/tick 类逻辑。 | 与 **TIME-003** `then.domain_state` 一致。 |
| **TIME-004** | `MAX_FRAME_DT_SEC = 0.5` 与 `effectiveSimulationDeltaSeconds` 内 `Math.min(..., MAX_FRAME_DT_SEC)`。 | 与 **TIME-004** 意图一致；但若上层已先调用一次 `effectiveSimulationDeltaSeconds` 再传入 `advanceWorldClock`，则 **第二轮再乘 `speed` 与再 clamp** 会改变有效增量（见问题清单）。 |

---

## 代码里大致怎么走（入口与协作）

- **`time-of-day.ts`**：`TimeOfDayState` / `advanceTimeOfDay` / `normalizeTimeState`（跨日）；`effectiveSimulationDeltaSeconds`（暂停、clamp、`speed`）；`sampleTimeOfDayPalette`（按锚点插值 UI/栅格色）；`formatTimeOfDayLabel`；常量 `MAX_FRAME_DT_SEC`、`DEFAULT_TIME_OF_DAY_CONFIG`。
- **`world-time.ts`**：`WorldTimeSnapshot`、`toWorldTimeSnapshot`、`timePeriodForMinute`、`advanceWorldClock`（内部再调 `effectiveSimulationDeltaSeconds` 后调 `advanceTimeOfDay`）；产出 **`WorldTimeEvent[]`（`time-advanced` / `period-changed` / `day-changed`）**。
- **`time-event-bus.ts`**：`detectTimeEvents(prev, next)` 沿单调时间收集 `new-day` / `day-start` / `night-start`；`createTimeEventBus` / `subscribe` / `publish`。
- **`index.ts`**：重导出上述模块。
- **编排层**（不在本目录，但对审计「是否旧演示专用」关键）：`src/game/game-orchestrator.ts` 在 `tick` 中先算 `simulationDt = effectiveSimulationDeltaSeconds(realDt, ...)`，再 `advanceWorldClock(worldBefore, simulationDt, ...)`，再 **`detectTimeEvents` + `publish`** 驱动 `src/game/flows/night-rest-flow.ts`（订阅 `night-start` / `day-start`）。**`advanceWorldClock` 的返回值 `events` 未被使用。**

---

## 尚不明确或需要产品/策划拍板

1. **`oh-acceptance/时间系统.yaml` · TIME-002** 中「跨天后时段为白天」与 **0:00–6:00 仍为夜** 的时钟模型是否统一：若保留 6/18 分界，验收 `then` 宜改为「新日始于 0:00（`new-day`），**白天段从 6:00 的 `day-start` 起**」。
2. **`oh-gen-doc/时间系统.yaml` · `时间相关配置` · `待配置项`** 中的昼夜阈值、现实/游戏比率、速度档位 — 是否以当前代码默认值为暂行基线写入文档，避免「文档待配置、代码已固定」的长期漂移。
3. **展示色随时刻连续变化**（`sampleTimeOfDayPalette`）是否属于「时间系统」对外承诺的一部分：若仅算渲染实现细节，可留在 presentation 层文档；若玩家可感知为玩法（辨识度），宜在 `oh-gen-doc/时间系统.yaml` 增补一句非功能性需求。
4. **`WorldTimeEvent` 与 `TimeEvent` 的长期关系**：是否删除/合并其一，或明确一者仅供测试/回放，避免维护双套语义。

---

## 问题清单

| # | 摘要 | 类型（见 `working-plan/remain-old-code-check/README.md`） | 说明与文档对照 |
|---|------|----------------|---------------|
| P1 | `advanceWorldClock` 返回的 `WorldTimeEvent[]` 主循环未消费 | **多套并行 / 孤立需求** | `GameOrchestrator.tick` 仅用 `clock.world`；领域边界信号以 `detectTimeEvents` → `TimeEventBus` 为准。与 `oh-acceptance/时间系统.yaml` **TIME-001**/**TIME-002** 描述的「事件总线」在名称上对齐 `TimeEventBus`，但 **`WorldTimeEvent` 类型形同旁路**。 |
| P2 | `effectiveSimulationDeltaSeconds` 在编排层与 `advanceWorldClock` 内 **串联各调用一次** | **设计一致性 / 潜在缺陷** | 可能导致 **`TimeSpeed` 被应用两次** 及对已缩放增量再次 `clamp`。对照 `oh-gen-doc/时间系统.yaml` · `时间推进` · `影响因素`（**游戏速度可调节**）与 **TIME-004**（**单帧增量上限**）：有效倍速与安全上限的**实际乘子**需用单测或日志验证是否与策划预期一致。 |
| P3 | 昼夜阈值 **6:00 / 18:00** 写死在 `world-time.ts` 与 `time-event-bus.ts` | **设计一致性** | `oh-gen-doc/时间系统.yaml` · `时间相关配置` · `待 configuration项` 写明 **「白天/夜晚的划分阈值」待配置** — 代码为硬编码实现。 |
| P4 | **TIME-002**「跨天后即为白天」 vs **0:00 起仍为 night** | **文档/验收与实现偏差** | 见上文对照 **TIME-002**；需收敛 **「跨天」** 与 **「day-start（6:00）」** 的表述，或改代码以符合字面验收（会牵动 `timePeriodForMinute` 与 `detectTimeEvents`）。 |
| P5 | `time-of-day.ts` 内 **调色板锚点表** 与领域时间核心同文件 | **孤立需求（展示耦合）** | `oh-gen-doc/时间系统.yaml` 未描述色板插值；能力存在且被 HUD/栅格使用。若要坚持「领域纯、展示外移」，属后续重构范畴。 |
| P6 | `WorldTimeEvent` 的 `period-changed` 在 **「仅跨日、时段仍为 night」** 时仍会随 `dayNumber` 变化发出（条件为日变 **或** 段变） | **设计一致性** | 与 `TimeEvent` 的细粒度（`new-day` / `night-start` / `day-start`）不完全同构；因 P1 主路径未消费 `WorldTimeEvent`，当前风险主要在 **未来若接入消费者** 时的语义歧义。 |

---

*本报告仅审计 `src/game/time/`，并引用编排层 `src/game/game-orchestrator.ts`、`src/game/flows/night-rest-flow.ts` 说明事件消费链；**未修改任何源码**。仓库当前 `npx tsc --noEmit` 在其它路径仍有既有报错，与本次审计无关。*
