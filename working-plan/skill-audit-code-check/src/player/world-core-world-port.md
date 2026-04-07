# 审计报告: src/player/world-core-world-port.ts

## 1. 漏做需求 (Missing Requirements)
- 未发现明显问题：`submit` 将 `DomainCommand` 经 `applyDomainCommandToWorldCore` 落到 `WorldCore`，与 `oh-code-design/交互系统.yaml` 中「交互意图层」把输入结果转为领域命令、「交互命令生成器」产出领域命令，以及「接口边界」中向地图/实体/建筑等子系统提交请求的整体方向一致（聚合经 WorldCore 统一应用可视为编排实现细节）。
- 说明：`replayAll` / `sessionBaseline` / `rejectIfTouchesCellKeys` 等属 B 线验收与注入能力，`oh-gen-doc` 中未检索到对等条款，按技能要求不记为文档缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)
- [指控]: 类注释与类型仍使用 `MockWorldPortConfig`、`MockLineAPort`、`MockWorldSubmitResult`、`applyMockConfig` 等命名（见 `world-port-types.ts` 与本文 3–9、13–16、55–63、65–69、92–123 行），而 `WorldCoreWorldPort` 已是默认实装路径（如 `world-bootstrap` 引用），命名暗示「仅 Mock」易误导维护者。
- [影响]: 生产与验收能力混名，增加「可否删/可否关」的判断成本。

## 3. 架构违规 (Architecture Violations)
- [指控]: 本文件在 `player` 包内 `implements OrchestratorWorldBridge`，而 `OrchestratorWorldBridge` 定义于 `../game/orchestrator-world-bridge.ts`；该文件又 `import type { PlayerWorldPort } from "../player/world-port-types"`，与 `game` 侧多处 `import ... from "../player/..."`（如 `world-bootstrap.ts`、`game-orchestrator.ts`、`interaction/index.ts`）共同形成 **game ↔ player 双向依赖**。
- [依据]: `oh-code-design/实体系统.yaml`「应用编排层」职责为接收交互等系统的状态变更请求并协调更新；边界应清晰、依赖宜单向。当前桥接类型放在 `game`、实现在 `player`，与类型再指回 `player`，违背「模块边界单向可理解」的常见分层约束（技能所述「无视设计」中的依赖方向风险）。

## 4. 修复建议 (Refactor Suggestions)
- [行动点 #0288]: 将 `MockWorldPortConfig` / `applyMockConfig` 等重命名为中性名（如 `WorldPortGateConfig` / `applyGateConfig`），并在注释中明确「验收注入」与「生产默认」的边界。
- [行动点 #0289] **已核对（已修复）**: 将 `OrchestratorWorldBridge` / `WorldSimAccess` 迁至 `src/player/orchestrator-world-bridge.ts`（与 `WorldCoreWorldPort` 同包）；`GameOrchestrator` 改为自 `../player/orchestrator-world-bridge` 引用类型；删除 `src/game/orchestrator-world-bridge.ts`。依赖方向为 `game → player` 与 `player → game`（后者经 `world-core` 等既有领域模块，无 `player ↔ game` 类型定义环）。