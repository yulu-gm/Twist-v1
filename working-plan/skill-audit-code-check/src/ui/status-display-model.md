# 审计报告: src/ui/status-display-model.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-code-design/UI系统.yaml`「状态展示模型」要求聚合多个系统只读字段；本文件提供 `aggregateStatusDisplay` 与 `DashboardDisplay`（154–163 行），但 **仓库内无引用**（除定义处），主 HUD 未使用该聚合，构成设计能力闲置与需求未落地。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。

## 3. 架构违规 (Architecture Violations)

- [指控]: `pawnDetailBehaviorLabelZh` 被 `HudManager` 使用，而 `aggregateStatusDisplay` 与 `DashboardDisplay` 孤立，导致「读模型」分裂：一部分在 `HudManager` 内联计算，一部分在本文件未接线，违背 `oh-code-design/UI系统.yaml` 统一状态展示模型的意图。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0361]: 在 `HudManager.syncPawnDetail` 或上层 presenter 中接入 `aggregateStatusDisplay`，或删除未使用 API 避免假进度。
- [行动点 #0362]: 为 `WORK_ITEM_KIND_TO_BEHAVIOR_ZH` 缺失的 kind 提供 fallback 或编译期 exhaustiveness 检查。