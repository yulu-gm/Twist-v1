# 审计报告: src/game/orchestrator-world-bridge.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。本文件仅声明 `OrchestratorWorldBridge` 接口（继承 `PlayerWorldPort` 并增加 `getWorld` / `setWorld`），不包含业务实现。`oh-code-design/` 与 `oh-gen-doc/` 中未出现 `OrchestratorWorldBridge`、`WorldCoreWorldPort` 或「编排器—世界桥接」等对等命名，无法将某条 YAML 条款映射为「本接口必须额外暴露而未暴露的方法」；具体提交、过滤、回放等行为由实现类与其它模块承担，不宜在本纯类型文件上认定功能遗漏。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。文件内无 `mock` / `temp` / `TODO` 分支或死代码。注释说明由 `WorldCoreWorldPort` 实现，属正常契约说明。父类型 `PlayerWorldPort`（见 `src/player/world-port-types.ts`）命名中含 `Mock` 系既有 B 线契约，非本文件引入的临时兼容层。

## 3. 架构违规 (Architecture Violations)

- [指控]: 将「玩家世界网关」(`PlayerWorldPort`，含 `submit` 等) 与对 `WorldCore` 的 `getWorld` / `setWorld` 合成为单一接口，类型上未区分「仅经领域命令驱动变更」与「模拟循环直接持有/替换世界内核」两种角色；仓库中多处将 `getPlayerWorldPort()` 断言为 `OrchestratorWorldBridge` 以读取 `WorldCore`（例如 `GameScene`），分层边界主要依赖约定与 cast，而非文档级双端口契约。
- [依据]: `oh-code-design/交互系统.yaml` 在「分层」中区分输入采集、交互模式、**交互意图层**（把输入转为领域命令）与对外「接口边界」中向各子系统**提交请求**的叙述；本接口在类型层面把「提交网关」与「完整世界内核句柄」绑在同一抽象上，与上述「意图—提交—系统」链路的清晰切分相比，弱化了只读/只写边界的静态表达力。是否构成「违规」取决于项目是否将「单实现类同时承担 tick 与 submit」视为可接受折中；从严格分层视角记为**契约偏宽、易产生越权调用面**的风险点。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0149]: 若需强化分层，可考虑将 `getWorld` / `setWorld` 抽至独立 `WorldSimAccess`（或仅编排器内部可见类型），`PlayerWorldPort` 保持纯玩家提交面；编排器构造时同时注入两者，减少 UI/场景对 `as OrchestratorWorldBridge` 的依赖。
- [行动点 #0150]: 在 `oh-code-design` 或 `oh-gen-doc` 中补充「编排层世界端口」条目，显式写明：真机实现是否允许在同对象上合并模拟访问与玩家提交、以及 `setWorld` 的适用场景（如热载、测试），便于后续审计有文可对。
  - **已落实**: 见 `oh-code-design/实体系统.yaml` 顶层键 `编排层世界端口`。