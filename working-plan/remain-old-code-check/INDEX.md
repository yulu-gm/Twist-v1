# 遗留 mock / 双轨 / 孤立需求 — 汇总索引（T-20）

## 一句结论

**人话讲透：** 这仓现在像「策划文档写了一本说明书，代码里却同时跑着两三套接线」——地图上的样板交互点、静态散落物和世界播种的 `resource` 各有一套故事；小人脑子一边是 `tickSimulation`+`PawnState`，一边是没怎么挂上的 `BehaviorFSM` 和 `flows`；工单又是 `world.workItems` 一套、`WorkRegistry` 一套；再加上无头场景、`MockWorldPort` 和主场景菜单三条命令链叠床架屋——**不把「唯一事实源」拍板定下来，验收、测试和真机很容易各绿各的。**

---

## 各子报告一览

> 「高风险条目」为各报告问题清单中**粗粒度计数**（含文档/验收偏差、并行实现、未挂载模块等），仅供排序与交叉阅读，非严谨评分。

| 相对路径 | 任务 | 粗粒度高风险（约） | 一条交叉风险摘要 |
| --- | --- | --- | --- |
| [README.md](README.md) | T-01 基线 | 规范（—） | 定义三类问题与 oh 对照口径；全文其余结论均在此基础上打标。 |
| [src-game-behavior.md](src-game-behavior.md) | T-02 | 高 · 4+ | FSM/`flows` 与主循环 `PawnState` 两套决策；`aggregateBehaviorContext` 未接入生产。 |
| [src-game-building.md](src-game-building.md) | T-03 | 高 · 4 | `safePlaceBlueprint` vs `createBlueprint`+Registry；`onCompleteRules` 无消费者。 |
| [src-game-entity.md](src-game-entity.md) | T-04 | 高 · 6 | `WorldCore` 与 `EntityRegistry` 双容器；ENTITY-001/002 与实现粒度偏差。 |
| [src-game-flows.md](src-game-flows.md) | T-05 | 高 · 6 | `flows` 近测试专用 vs 编排器 `night-start`；BEHAVIOR-003 字面与流程间隙。 |
| [src-game-interaction.md](src-game-interaction.md) | T-06 | 高 · 5 | `mode-registry`+会话 vs `command-menu`+`buildDomainCommand`；INTERACT-001 缺口。 |
| [src-game-map.md](src-game-map.md) | T-07 | 高 · 6 | 模板交互点/播种食物/`simulationInteractionPoints` 多线；与 `MOCK_SCATTERED_GROUND_ITEMS` 跨目录并行。 |
| [src-game-need.md](src-game-need.md) | T-08 | 高 · 5 | `recreation`+地图娱乐点无 YAML；`evolveNeeds` 未挂主循环；阈值 mock 与规则分叉。 |
| [src-game-time.md](src-game-time.md) | T-09 | 中高 · 6 | `WorldTimeEvent` 旁路、`effectiveSimulationDeltaSeconds` 可能双用；TIME-002 表述与 0～6 点夜段。 |
| [src-game-work.md](src-game-work.md) | T-10 | 高 · 7 | `WorkItemSnapshot` 与 `WorkOrder` 双轨；伐木/拾取/搬运拼接点因路径而异。 |
| [src-game-root.md](src-game-root.md) | T-11 | 高 · 8 | 编排 tick 缝合多系统；采矿/拆障/模板 fallback；`needs` 与 satiety/energy 双写。 |
| [src-scenes.md](src-scenes.md) | T-12 | 中高 · 7 | `mock-*` 零引用转发；`grid-cell-info` mock 与地图文档不对齐；调试能力超前 oh。 |
| [src-player.md](src-player.md) | T-13 | 高 · 5 | `MockWorldPort` 与 `WorldCoreWorldPort` 检票重复、过滤语义不等价。 |
| [src-ui.md](src-ui.md) | T-14 | 中高 · 10 | 菜单树 vs `command-menu` 路径形变；UI-002/003 义务多落场景层；类型占位悬空。 |
| [src-data.md](src-data.md) | T-15 | 高 · 7 | 静态表+领域动词未入 oh；地面 mock 与 `resource` 不同源。 |
| [src-headless.md](src-headless.md) | T-16 | 中高 · 6 | `applyMockConfig`、直接 `claimWorkItem` 与主路径分叉；`oh-acceptance` 无机器对齐。 |
| [src-runtime-log.md](src-runtime-log.md) | T-17 | 中 · 6 | 非业务双轨；oh 未覆盖可观测性；与 headless trace 模型平行。 |
| [src-entry.md](src-entry.md) | T-18 | 低 · 4 | 薄入口；`__TWIST_RUNTIME_LOG_DEV_SERVER__` 双处 declare；工程领先于 UI YAML。 |
| [repo-tests-and-data.md](repo-tests-and-data.md) | T-19 | 中高 · 8 | 验收 YAML 与测试注释/常量双轨；`MockWorldPort` 固化契约；根 `data/` 示例漂移。 |

---

## 主要跨目录问题归纳

**1. 地图「种子」vs 场景/mock「第二套地面叙事」**  
[`src-game-map.md`](src-game-map.md) 中模板 `interactionPoints`、播种的地面 `resource` 与 [`src-game-root.md`](src-game-root.md) 里 `simulationInteractionPoints` 合成逻辑，和 [`src-data.md`](src-data.md) / [`src-scenes.md`](src-scenes.md) 的 `MOCK_SCATTERED_GROUND_ITEMS`、`grid-cell-info` 静态 hover 并行——玩家眼里「地上有什么」可能跟领域快照不一致（[`repo-tests-and-data.md`](repo-tests-and-data.md) 亦提示 MAP-001 类观测分裂）。

**2. 行为_fsm 未接线 + 主循环「真大脑」**  
[`src-game-behavior.md`](src-game-behavior.md)：`BehaviorFSM`、`flows` 与 `tickSimulation`+`PawnState` 并行；[`src-game-flows.md`](src-game-flows.md) 指出 `night-rest-flow` 与 `GameOrchestrator` 对昼夜各说各话；[`src-game-need.md`](src-game-need.md) 的 `evolveNeeds` 未挂主线，与 [`src-headless.md`](src-headless.md) 观测字段共同加剧「文档写 FSM、跑的是另一套」风险。

**3. 工单双轨（World 快照 vs Registry）**  
[`src-game-work.md`](src-game-work.md) 与 [`src-game-root.md`](src-game-root.md)：`WorkItemSnapshot` / `work-operations` / `world-work-tick` 与 `WorkOrder` / `work-settler` / `chop-flow` 拼接不一致；伐木后拾取、搬运是否自动派生因路径而异；[`src-game-entity.md`](src-game-entity.md) 的 Registry 结算与 WorldCore 主路径不对齐会放大该问题。

**4. 建造/蓝图双入口**  
[`src-game-building.md`](src-game-building.md)：玩家域 `safePlaceBlueprint` 与 flow 测 `createBlueprint`+`construct`；`onCompleteRules` 与 [`src-game-entity.md`](src-game-entity.md) 硬编码交互能力重复表达；BUILD-002 归属是否在 World 完工路径闭环需跨 `work`/`entity`。

**5. 命令与交互「三条菜单宇宙」**  
[`src-game-interaction.md`](src-game-interaction.md)、[`src-player.md`](src-player.md)、[`src-data.md`](src-data.md)：`mode-registry` 默认 `interaction-mode` id 与 [`src-ui.md`](src-ui.md) / `command-menu` 热键树不一致；`MockWorldPort` 过滤与真网关不等价，测试可能假绿。

**6. 时间与事件信号多套**  
[`src-game-time.md`](src-game-time.md)：`advanceWorldClock` 返回事件未消费、`TimeEventBus` 另一套；与 [`src-game-flows.md`](src-game-flows.md) 夜间流程、`GameOrchestrator` 串联 `effectiveSimulationDeltaSeconds` 的倍速/clamp 需统一验证。

**7. 需求模型：文档两维、代码三维+娱乐**  
[`src-game-need.md`](src-game-need.md)：`recreation`、地图娱乐点、[`src-game-map.md`](src-game-map.md) 样板、`goal-driven-planning` 的 `recreate` 形成策划 YAML 外的闭环；`need-signals` mock 阈值与打断阈值多源。

**8. 无头 / 测试 / oh-acceptance 维护三轨**  
[`src-headless.md`](src-headless.md) 与 [`repo-tests-and-data.md`](repo-tests-and-data.md)：场景 `manualAcceptance`、`applyMockConfig`、抢单捷径与 `oh-acceptance` 无强制 scenario_id 绑定——文档、注释与代码易长期脱钩。

**9. UI 呈现与模块边界**  
[`src-scenes.md`](src-scenes.md) 承担进度条、Z 序；[`src-ui.md`](src-ui.md) 缺 UI-002/003 完整落地；[`src-runtime-log.md`](src-runtime-log.md)、[`src-entry.md`](src-entry.md) 说明调测管道与 oh 空白——交付边界需在文档或工程规范中单列。

---

## 子报告链接（覆盖 T-02～T-19 全部文件名）

| 任务 | 报告 |
| --- | --- |
| T-02 | [src-game-behavior.md](src-game-behavior.md) |
| T-03 | [src-game-building.md](src-game-building.md) |
| T-04 | [src-game-entity.md](src-game-entity.md) |
| T-05 | [src-game-flows.md](src-game-flows.md) |
| T-06 | [src-game-interaction.md](src-game-interaction.md) |
| T-07 | [src-game-map.md](src-game-map.md) |
| T-08 | [src-game-need.md](src-game-need.md) |
| T-09 | [src-game-time.md](src-game-time.md) |
| T-10 | [src-game-work.md](src-game-work.md) |
| T-11 | [src-game-root.md](src-game-root.md) |
| T-12 | [src-scenes.md](src-scenes.md) |
| T-13 | [src-player.md](src-player.md) |
| T-14 | [src-ui.md](src-ui.md) |
| T-15 | [src-data.md](src-data.md) |
| T-16 | [src-headless.md](src-headless.md) |
| T-17 | [src-runtime-log.md](src-runtime-log.md) |
| T-18 | [src-entry.md](src-entry.md) |
| T-19 | [repo-tests-and-data.md](repo-tests-and-data.md) |

**基线（T-01）**：[README.md](README.md)。

正文交叉阅读时还可直接跳转：[地图与 mock](src-game-map.md)、[编排与世界桥](src-game-root.md)、[工单双轨](src-game-work.md)、[实体双容器](src-game-entity.md)、[行为与 flow](src-game-behavior.md)、[流程编排测试轨](src-game-flows.md)、[交互双链](src-game-interaction.md)、[玩家网关](src-player.md)、[静态配置](src-data.md)、[场景层](src-scenes.md)、[无头分叉](src-headless.md)、[仓库测试与 data](repo-tests-and-data.md)。

---

*本文件仅汇总各子报告结论，未修改任何源码。*
