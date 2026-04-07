# 审计报告: src/player/task-marker-target-cells.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: **`lumber` 与 `haul` 对「阻挡格 + 仍覆盖目标实体」的处理与领域应用层不一致**：本文件在阻挡格上直接丢弃整格（109–114 行 `lumber`、117–122 行 `haul`），而 `src/player/apply-domain-command.ts` 仅在「阻挡且该格没有未标记树/地面物资」时才跳过（约 396–399 行、464–467 行）。结果是：**障碍格上仍存在可登记树/物资时，预览标记不会出现，但提交后仍会登记工单**，与文件头注释宣称的「与工单登记口径一致」相矛盾。
- [依据]: `oh-code-design/UI系统.yaml`「风险」中强调反馈与真实规则须一致（若展示与可行性脱节，玩家会误判）；`oh-gen-doc/UI系统.yaml`「伐木工具」「物资拾取标记工具」要求框选命中树木/物资后呈现可理解的选中反馈，隐含「有单可接的格」应与领域判定对齐。

- [指控]: **`mine` 分支未镜像 `apply-domain-command.ts` 中与拆除工单的互斥**（领域层在登记开采前会 `hasNonCompletedWorkForTarget(..., "deconstruct-obstacle", stone.id)` 跳过，约 435–437 行）。本文件 132–136 行仅按石料未 `miningMarked` 过滤，**可能在已挂拆除意图的石格上仍显示开采向任务标记，而实际不会登记开采工单**。
- [依据]: 同上，`oh-code-design/UI系统.yaml`「地图叠加反馈层」与「风险」；工作流上应与 `oh-code-design/工作系统.yaml` 中从标记生成工作的链路一致。

- [指控]: **`demolish` 分支未镜像领域对「石料 + 已登记开采」的拒绝条件**（`apply-domain-command.ts` 约 310–322 行）。本文件 125–129 行只要格上有障碍实体即纳入标记，**可能在领域会整单拒绝的格上仍显示拆除向预览标记**（具体是否提交成功还取决于同批其它格，但单格语义已漂移）。
- [依据]: `oh-code-design/交互系统.yaml`「交互意图层」职责包含提交前校验与过滤；反馈集合应与该口径同源，否则违背 `oh-code-design/UI系统.yaml` 所列风险。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（本文件无 `mock`/`TODO` 式临时分支；未知 `toolId` 的兜底 139–142 行与 `idle` 全量透传 92–94 行属于产品行为选择，需在端口契约层统一说明，但不构成典型「死代码 Mock」）。

## 3. 架构违规 (Architecture Violations)

- [指控]: **`mergedBlockedCellKeys`、`findObstacleCoveringCell`、树/石/地面物资查找等与 `apply-domain-command.ts` 开头私有函数逐字重复**，两套实现并行维护，违背「选格 → 可执行目标」单一事实来源，属于玩家适配层与领域应用层之间的**规则复制**。
- [依据]: `oh-code-design/交互系统.yaml`「交互意图层」（把输入结果转为领域命令并在提交前校验）、「交互命令生成器」模块（将模式结果转成领域命令）；`oh-code-design/UI系统.yaml` 分层目标「以读模型驱动展示，避免 UI 直接承担领域规则」——当前做法是用另一份手写规则「模拟」领域结果，而非消费同一解析结果，架构上易与上述「风险」条款共振。

- [指控]: **`findUnmarkedStoneObstacleCoveringCell`（59–68 行）仅用 `entity.occupiedCells.some(...)`**，而同文件其它查找函数对 `occupiedCells` 使用「非空用占格、否则回退 `cell`」模式（如 39–40、52–53 行）。与 `apply-domain-command.ts` 66–78 行一致但**双方均未与树/资源查找的占格回退策略统一**，存在隐性不一致风险。
- [依据]: `oh-code-design/实体系统.yaml` 对实体占格、标记字段的语义要求；占格解析应在单一模块内统一，避免同类实体不同工具分支各写一套。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0282]: 抽取共享的 `resolveToolbarTaskTargetCellKeys(world, toolId, inputShape, cellKeys)`（或按动词/工具拆分的纯函数组），由 `filterCellKeysForToolbarTaskMarkers` 与 `applyDomainCommandToWorldCore` 内对应分支**共用同一套阻挡格、实体命中与工单冲突判定**，消除 lumber/haul/mine/demolish 的预览与登记漂移。
- [行动点 #0283]: 为「阻挡格 + 树/物资」「石料 + deconstruct 互斥」「石料 + mine-stone 与 demolish」等组合补充**对照单测**（可放在现有 `tests/domain/task-marker-target-cells.test.ts` 延伸），锁定与领域层行为表一致。
- [行动点 #0284]（已核对）: 原指控针对 `task-marker-target-cells.ts` 内联实现；现 lumber/haul/mine/demolish 经 `resolveToolbarTaskTargetCellKeys` → `toolbar-task-target-resolution.ts` 中 `findUnmarkedStoneObstacleCoveringCell` 已与 `findObstacleCoveringCell` / 树 / 资源共用「`occupiedCells.length > 0 ? occupiedCells : [entity.cell]`」回退。补充 `tests/domain/task-marker-target-cells.test.ts` 中石料 `occupiedCells` 为空与单锚格的两条用例，锁定与领域登记口径一致。