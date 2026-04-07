# 工作系统 (Work System) 代码审计汇总报告

## 1. 现状总结 (Current Status Summary)

经过对 `src/game/work/` 目录及相关文件的全面审计，当前工作系统的实现与 `oh-code-design/工作系统.yaml` 的理想架构存在以下核心偏差与问题：

- **核心架构违规：双轨制工作模型并存**
  系统内同时存在遗留的 `WorkItemSnapshot`（命令式、状态机驱动）与新的 `WorkOrder`/`WorkStep`（声明式、步骤驱动）两套模型。这导致了工作目录（`WorldCore.workItems` vs `WorkRegistry.orders`）、结算逻辑（`work-operations.ts` vs `work-settler.ts`）和调度逻辑的分裂，极易引发状态不同步和重复执行。
- **工作生成层：关联断裂与标识冲突**
  `work-generator` 仅生成纯数据，未履行“建立工作与目标实体的双向关联”的职责（未回写实体字段）。此外，搬运工作（Haul）的 `workId` 生成未包含卸货格（`dropCell`），导致同一物资多目的地搬运时发生静默覆盖；去重与合并逻辑也处于缺位状态。
- **工作结算层：链路不完整与状态异常**
  - **建造链路**：蓝图完成时直接替换为建筑实体，未校验策划要求的“建造进度”。
  - **伐木链路**：伐木完成后仅派生了拾取工作，遗漏了设计文档要求的后续“搬运工作”。
  - **异常处理**：结算失败时（如目标消失、前置不成立），往往仅返回失败结果而未将工单状态更新为“失败”或“重开”，导致工单长期卡在 `claimed`（已认领）状态。
- **工作调度与目录层：能力缺失**
  - `WorkRegistry` 缺少设计要求的“按位置（`targetCell`）查询”能力。
  - `work-scheduler` 的分配接口静默忽略了 `_pawnId` 参数，未实现基于小人资格（技能、区域等）的过滤。
  - `world-work-tick` 中的自动认领逻辑未实现按“优先级”排序分配。
- **类型与配置遗漏**
  实现中包含了 `deconstruct-obstacle`（拆除）和 `mine-stone`（采矿），但未在策划文档中声明。同时，`deconstruct-obstacle` 缺少读条时长配置，导致该类工作被认领后无法通过锚格读条完成，形成死锁。

## 2. 修改建议 (Modification Suggestions)

为使代码实现重新对齐 `oh-code-design` 的架构目标，建议按以下优先级推进重构：

### 阶段一：修复阻断性 Bug 与逻辑断层（高优）
1. **修复工单卡死与标识冲突**：
   - 为 `deconstruct-obstacle` 补齐锚格读条时长配置，确保其能正常走完“认领-读条-结算”闭环。
   - 修改 `generateHaulWork` 的 `workId` 生成规则，将 `dropCell` 纳入哈希键，防止工单互相覆盖。
2. **补全结算派生链路**：
   - 在伐木（`chop`）成功结算分支中，补齐生成“搬运工作”或登记搬运意图的逻辑。
   - 确保所有失败的结算分支（如 `settleWorkSuccess` 返回非 ok 时）显式将工单状态置为 `failed` 或重置为 `open` 并增加失败计数。

### 阶段二：收敛双轨制与对齐核心架构（中优）
1. **统一工作模型与目录**：
   - 制定迁移计划，全面废弃遗留的 `WorkItemSnapshot`，统一收敛至基于 `WorkOrder` 和 `WorkStep` 的声明式模型。
   - 消除 `WorldCore.workItems` 与 `WorkRegistry.orders` 的双重真相源，确立单一的、具备不可变更新语义的工作目录。
2. **完善工作生成与关联闭环**：
   - 在工作生成或添加（`addWork`）的统一入口处，强制执行工单与目标实体的双向关联（写入 `relatedWorkItemIds`）。
   - 在生成层补充基于 `kind + target + cell` 的去重与合并策略。
3. **严格落实建造进度**：
   - 修改 `completeBlueprintWork`，必须在蓝图实体的“建造进度”达到 100% 后才允许转换为建筑实体。

### 阶段三：补齐调度能力与清理技术债（低优）
1. **增强调度与查询 API**：
   - 在 `WorkRegistry` 中补充按精确位置或空间范围查询工单的能力。
   - 修复 `work-scheduler`，使其真正利用 `pawnId` 进行技能、区域等前置条件过滤，并在所有分配入口严格落实“优先级最高者优先”规则。
2. **清理无用兼容与对齐文档**：
   - 清理区域存储过滤中的冗余字段（统一使用 `acceptedMaterialKinds` 或设计指定的单一字段）。
   - 将 `deconstruct-obstacle` 和 `mine-stone` 补充至 `oh-gen-doc` 和 `oh-code-design`，消除代码超前于文档的现象。
   - 将分散的读条时长硬编码迁移至统一的时间系统配置中。