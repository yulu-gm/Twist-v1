# 审计报告: src/game/entity/gameplay-tree-spawn.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。
- **对照说明**：`oh-gen-doc/实体系统.yaml` 中「树木」的「位置」与初始「伐木状态」为正常态时，本文件通过 `cell`、`occupiedCells: [cell]` 与 `loggingMarked: false` 与策划语义一致；「已标记伐木 / 伐木中」由交互与工作系统在运行时更新，不属于入世界草案的职责。
- **对照说明**：`oh-code-design/实体系统.yaml` 中「树木实体」关键字段含「位置」「伐木标记」「是否被占用」；本草案显式给出位置与伐木标记初值；「是否被占用」在当前 `WorldEntitySnapshot` / `EntityDraft` 模型中由工单与占格等路径表达，非本工厂单独字段，与本文件职责边界一致。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。文件无 `mock` / `temp` / `TODO` 分支，仅为纯函数工厂，无旧系统并行入口。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。
- **依据**：`oh-code-design/实体系统.yaml`「实体原型定义」职责包含各类型默认值与必填约束；本模块仅依赖 `../map/world-grid` 与 `../world-core-types`，不越层调用 UI/交互/工作编排，符合「定义草案、由 `spawnWorldEntity` 统一落地」的分层。
- 文件头注释要求场景载入、主世界播种、无头 hydrate 经此工厂统一草案；仓库内 `scenario-loader.ts`、`scenario-runner.ts`、`world-seed-entities.ts` 均引用 `createGameplayTreeDraft`，与「避免分叉」的设计意图一致。

## 4. 修复建议 (Refactor Suggestions)

- 当前实现已足够薄，无强制改动。若后续策划将「树木」扩展为多格占用或创建时需携带更多初态字段，可在此集中增补 `EntityDraft` 字段并保持 `occupiedCells` 与 `cell` 一致（与现有注释一致），避免在多处内联字面量草案。
