# 审计报告: src/game/interaction/index.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 本文件仅为 barrel，未在导出边界上体现 `oh-code-design/交互系统.yaml` 中 **分层**（输入采集层、交互模式层、交互意图层、反馈协调层）与 **模块**（模式注册表、选区会话管理器、笔刷会话管理器、交互命令生成器、反馈状态仓）的对应关系；`buildDomainCommand`、`commitPlayerSelectionToWorld`、`applyDomainCommandToWorldCore` 等与「交互命令生成器 / 意图转领域命令」强相关的符号与 `mode-registry`、`session-manager` 等并列导出，阅读者无法从公共 API 对齐设计中的层次与模块归属。
- [依据]: `oh-code-design/交互系统.yaml` → `分层`、`模块`；`oh-gen-doc/交互系统.yaml` → `玩家输入`、`交互模式`（输入→模式→结果的链路应与包内边界一致）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。

## 3. 架构违规 (Architecture Violations)

- [指控]: 从 `src/game/interaction/index.ts` 再导出 `../../player/` 下多模块（`apply-domain-command`、`build-domain-command`、`commit-player-intent`、`interaction-mode-presenter`、`brush-stroke`、`tool-input-policy`），使 `game/interaction` 成为 **反向依赖并透出 player 实现** 的聚合面，易混淆依赖方向：设计约定 **输入** 来自 UI（见下），通常应由外围 `player`/场景调用 `game` 内交互能力，而非由 `game` 包公共出口回指 `player`。
- [依据]: `oh-code-design/交互系统.yaml` → `接口边界` → `输入`（来自 UI 系统的菜单选择结果等）、`输出`（向地图/实体/建筑/UI 等各子系统）；与「输入采集贴近 UI、领域交互在 game」的分层预期不一致。
- [影响]: 新增调用方可能通过 `game/interaction` 间接依赖 `player`，加重跨层耦合，后续拆分或替换玩家线实现时牵连面扩大。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0106]: 将 `applyDomainCommandToWorldCore`、`buildDomainCommand`、`commitPlayerSelectionToWorld`、`interactionInputShapeForToolId` 等与玩家线强绑定的导出迁回 `src/player/` 的公共出口（或独立 `player-bridge`/`game-player` 适配层），使 `src/game/interaction` 主要导出本目录内模式注册、选区/会话、领域命令类型及与设计 **模块** 直接对应的符号。
- [行动点 #0107]: 若短期必须保留便捷 barrel，在 `src/game/README.md`（或本包专用说明）中写明：哪些符号属于 **交互系统** 核心、哪些为 **player 适配再导出**、以及依赖方向例外的理由与迁移计划。