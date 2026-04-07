# 审计报告: src/game/README.md

## 1. 漏做需求 (Missing Requirements)

- [指控]: 作为领域层入口说明，README 的子系统表与开篇列举未覆盖仓库内已存在、且与 `oh-code-design` 流程强相关的目录与文件，读者按设计文档对照代码时容易遗漏入口。
- [依据]:
  - `flows/` 目录（如 `night-rest-flow.ts`、`need-interrupt-flow.ts`、`build-flow.ts`、`chop-flow.ts`）在磁盘上存在，但 README 未提及；与 `oh-code-design/行为系统.yaml` 中「夜晚休息」「工作被需求打断」等关键流程、以及多系统协同的表述相比，缺少「流程编排/用例流」层级的索引说明。
  - 开篇仅举例 `world-core.ts`、`world-sim-bridge.ts`、`pawn-state.ts`，同目录下尚有 `game-orchestrator.ts`、`world-bootstrap.ts`、`world-work-tick.ts`、`world-construct-tick.ts`、`orchestrator-world-bridge.ts` 等顶层编排与 tick 文件未纳入说明，与 `oh-code-design` 各子系统「接口边界」「关键流程」所需的统一编排入口描述不完全对齐。
  - `map/` 一行只点名 `world-grid.ts`、`world-seed.ts`，而 `oh-code-design/地图系统.yaml` 明确列出「占用管理器」「区域管理器」等模块；代码侧存在 `occupancy-manager.ts`、`zone-manager.ts`、`storage-zones.ts` 等，README 未建立「设计模块名 ↔ 文件名」的对应，易造成「地图目录仅有几何与种子」的片面理解。
  - 顶层 `bed-auto-assign.ts` 未在 README 中与 `building/` 或建筑归属职责关联；`oh-code-design/建筑系统.yaml`「归属规则器」模块在文档层面的落点未在此说明中体现。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（README 为说明文档，无 Mock/TODO/临时兼容代码表述；「避免依赖已删除的顶层 re-export 桩路径」属于迁移指引，不构成无用兼容指控。）

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。（README 主张与 Phaser 解耦、子域分目录、`GameScene` 通过 barrel 与 `world-sim-bridge` 保持场景层较薄，与 `oh-code-design` 中领域层与 UI/交互分层的方向一致，未见与之直接冲突的表述。）
- [补充说明]: `interaction/` 在表中仅以 `floor-selection.ts` 为例，而 `oh-code-design/交互系统.yaml` 还包含模式注册表、会话管理器、命令生成器等模块语义；代码侧另有 `mode-registry.ts`、`session-manager.ts`、`domain-command-types.ts` 等。此属**文档覆盖偏窄**，不宜升格为「违反分层」的架构罪证，但应在后续修订 README 时一并列出代表性文件以免误读职责范围。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0013]: 在「子系统目录」表中增加 `flows/`（或等价名称）一行，说明其承载跨子系统的用例/流程编排，并列举与 `oh-code-design` 关键流程对应的文件名。
- [行动点 #0014]: 扩充开篇「顶层」说明，将 `game-orchestrator.ts`、各 `world-*-tick.ts`、`world-bootstrap.ts`、`orchestrator-world-bridge.ts` 等与「世界 tick / 编排」的关系用一两句话写清，避免仅三个文件名代表整个顶层。
- [行动点 #0015]: 在 `map/` 行补充 `occupancy-manager`、`zone-manager`、`storage-zones`（或与现文件名一致）与 `oh-code-design/地图系统.yaml` 中占用/区域模块的对应关系。
- [行动点 #0016]: 说明 `bed-auto-assign.ts` 与建筑归属/蓝图完成链路的文档归属（对照 `oh-code-design/建筑系统.yaml`「归属规则器」），或明确将其视为 `building` 域在顶层的延伸入口。
- [行动点 #0017]: 在 `interaction/` 行补充 `mode-registry`、`session-manager`、`domain-command-types` 等代表性模块，与 `oh-code-design/交互系统.yaml` 模块列表对齐。