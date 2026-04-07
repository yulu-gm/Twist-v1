# 审计报告: src/headless/headless-sim.ts

## 1. 漏做需求

- [指控]: `oh-code-design` 与 `oh-gen-doc` 均未定义独立的「无 Phaser 无头模拟」子系统条款，故**不存在**可逐条核对的「无头入口必须实现 XXX」类硬需求；本文件作为测试/场景驱动夹具，在文档层面属于**缺口**（未在设计中显式列为验收入口或分层模块）。
- [依据]: 对 `oh-code-design/*.yaml`、`oh-gen-doc/*.yaml` 全文检索无 headless / 无头 / 单测入口等关键词；审计无法将具体行号条款钉死到「漏做」。
- [指控]: `spawnPawn` 在内存中直接构造 `PawnState` 并 `push` 到 `simAccess.getPawnsRef()`，与 `oh-gen-doc/实体系统.yaml` 中小人「生成方式: 游戏开始时从地图中醒来」的叙事/规则表述**不对齐**；若策划要求所有小人登场必须经由世界/地图侧统一生成事件，则当前 headless 仅为**测试捷径**，成文需求与实现路径未在设计中声明豁免。
- [依据]: `oh-gen-doc/实体系统.yaml`「小人 → 初始状态 → 生成方式」。
- [对齐说明]: `commitPlayerSelection` 委托 `orchestrator.commitPlayerSelection`，与 `oh-code-design/交互系统.yaml`「交互意图层：把输入结果转为领域命令」及文件内注释「避免手写领域命令与工具栏/输入形态不一致」方向一致；`tick` 内串联 `WorldCore` 快照与 `SimEventCollector` 差分，有利于 `oh-code-design/行为系统.yaml`「可解释、可重放、**可测试**」目标，**不构成**明显漏做。

## 2. 无用兼容与 Mock

- 未发现明显问题：`NOOP_HOOKS` 并非遗留 Mock，而是 headless 场景下对 `GameOrchestrator` 所需 UI 同步钩子的**刻意空实现**，避免引入 Phaser/视图依赖；`DEFAULT_HEADLESS_SEED` 与固定调色板为可复现测试配置，属正常夹具而非「未删除的旧系统兼容分支」。
- [风险说明]（非典型「无用」代码）: 若生产路径中的 `GameOrchestratorHooks` 契约演进（新增必选副作用或顺序依赖），而仅 Phaser 侧更新、headless 仍全 noop，可能导致「单测全绿、界面路径才暴露缺陷」。此属**维护面风险**，不宜简单归类为应删除的兼容代码。

## 3. 架构违规

- [指控]: `spawnPawn` 绕过 `oh-code-design/实体系统.yaml` 中对领域对象创建的分工描述——「生命周期规则：管理创建、删除…」与「应用编排层：接收…状态变更请求、协调多实体联动更新」；本文件直接向 SimAccess 的可变 pawn 数组写入，属于**测试层直接注入模拟状态**，若将设计中的分层视为对「一切小人创建」的规范，则此处存在**未经编排层/生命周期规则抽象**的捷径。
- [依据]: `oh-code-design/实体系统.yaml`「分层 → 应用编排层 / 生命周期规则」及「实体目录：按实体标识集中管理所有实体」所表达的责任边界（当前实现以 `PawnState` + SimAccess 为运行载体，与设计蓝图中的「实体目录」理想形态可能不一致）。
- [豁免说明]: 无头模块本身依赖 `game` 与 `player` 端口组装 `WorldCore`、`GameOrchestrator`，**未出现** UI 系统文档所警示的「UI 直接决定领域可行性」类倒置；`worldGrid.blockedCellKeys` 强制 `new Set(...)` 的注释是为满足仿真侧可变网格与寻路可见性，属于**与地图/仿真契约对齐**，不视为违规。
- [依据]: `oh-code-design/UI系统.yaml`「风险：若 UI 直接决定领域可行性…」；本文件未引入 UI 层领域裁决。

## 4. 修复建议

- [行动点 #0216]: 在 `oh-code-design` 或 `oh-gen-doc` 增加简短附录（或指向 `oh-acceptance`），**显式承认** headless 为合法验收入口、以及 `spawnPawn` 为「注入初始小人」的测试 API，避免后续审计再次因「文档无头」而无法定性。
- [行动点 #0217]: 若长期希望与 `实体系统.yaml` 完全一致，可将「创建小人」收敛为单一工厂或编排 API（由 world/orchestrator 调用），headless 仅调用该 API，而非直接 `getPawnsRef().push`。
- [行动点 #0218]: 为 `GameOrchestratorHooks` 维护**契约测试**（或类型/快照断言），确保 Phaser 实现与 headless noop 集在签名与调用顺序上同步演进，降低第 2 节所述漂移风险。
- [行动点 #0219]: 保留并同步 `blockedCellKeys` 可变 `Set` 的约定至地图/世界启动相关设计说明，避免另一路径误用不可变快照导致寻路与障碍不同步。