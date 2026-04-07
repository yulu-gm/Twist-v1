# 审计报告: src/game/behavior/index.ts

## 1. 漏做需求

- 本文件仅为对 `sim-loop`、`behavior-state-machine`、`behavior-context`、`action-scorer`、`goal-driven-planning`、`wander-planning`、`sim-config` 的再导出（barrel），未承载业务逻辑。
- 对照 `oh-code-design/行为系统.yaml` 中的分层与模块（行为上下文汇总器、行动评分器、行为状态机、行为执行协调等），对应能力均已通过上述子路径的符号对外聚合；`oh-gen-doc/行为系统.yaml` 中的状态机、散步、工作决策等描述由子模块实现，**不能**从本索引文件推断子模块实现是否完整。
- `a-star-pathfinding.ts` 未从本文件导出：当前仓库内仅 `goal-driven-planning.ts` 引用，属内部实现细节，与设计中「路径计算不宜堆在行为系统对外面」的风险表述（`oh-code-design/行为系统.yaml`「风险」）方向一致，**不构成**本 barrel 的漏导出需求。

**结论**：就 `index.ts` 自身而言，未发现与设计文档要求相冲突的「应在此文件实现却缺失」的需求。

## 2. 无用兼容与 Mock

- 无 Mock、临时分支、`TODO` 或旧系统兼容代码；仅为 `export` / `export type` 列表。

**结论**：未发现明显问题。

## 3. 架构违规

- 本文件不读写领域状态、不跨层调用 UI/场景，仅做模块边界聚合，符合 `oh-code-design/行为系统.yaml` 中通过子模块划分职责的意图。
- 仓库内存在从 `../game/behavior/goal-driven-planning` 等**子路径**直接导入类型的用法（如 `src/ui/status-display-model.ts`），属于调用方选择，**非**本 `index.ts` 文件本身的架构越权。

**结论**：未发现明显问题。

## 4. 修复建议

- **可选（一致性）**：若希望「行为系统对外单一入口」，可在本 barrel 中补充再导出 `goal-driven-planning` 中已被 UI/headless 使用的类型（如 `GoalKind`），并逐步将深层路径 import 收敛到 `../game/behavior`，以减少入口分裂；此为工程约定优化，非设计强制条款。
- 若后续新增子模块且需对外稳定 API，优先在本 `index.ts` 显式列出公开符号，避免调用方散落深层路径——便于与 `oh-code-design/行为系统.yaml` 中的模块边界叙述对齐。
