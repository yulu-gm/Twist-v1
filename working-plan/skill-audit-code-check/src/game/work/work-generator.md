# 审计报告: src/game/work/work-generator.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `generateHaulWork` 生成的 `workId` 为 `work:haul:${resourceEntityId}:${coordKey(fromCell)}:${toZoneId}`，未纳入 `dropCell`；当同一携带物、同一出发格、同一存储区 ID 下存在多个不同卸货格工单时，会与 `WorkRegistry.orders` 的 `Map<string, WorkOrder>` 键语义冲突，后写入覆盖先写入，违背「每条待执行工作应有稳定唯一标识」的隐含不变式。
- [依据]: 见 `oh-code-design/工作系统.yaml` 核心数据中「工作单」关键字段「工作标识」；结合本仓库 `src/game/work/work-registry.ts` 中 `addWork` 以 `order.workId` 为键直接 `set`、无去重或合并策略的实现，标识冲突即数据丢失。

- [指控]: 设计中的「工作生成器」职责包含「建立工作与目标实体的双向关联」；本文件四个 `generate*` 仅装配 `WorkOrder` 纯数据，不调用实体注册表或任何写入 `relatedWorkItemIds` 等字段的 API，关联完全依赖调用方（如 `build-flow`、`chop-flow`、`work-settler`）。若调用链遗漏回写，则无法满足该条款在实体侧的闭环（与同仓库 `blueprint-manager` 审计中已指出的工单—实体同步风险同构）。
- [依据]: 见 `oh-code-design/工作系统.yaml` 模块「工作生成器」职责中的「建立工作与目标实体的双向关联」。

- [指控]: `oh-code-design/工作系统.yaml` 在分层「工作生成层」中要求「去重并合并重复工作」；本文件既不生成唯一性约束以外的去重键，也不承担合并逻辑。若项目将「去重合并」仅寄托于上层，则本模块单独对照该层职责不完整（需在架构上明确由 `addWork`/扫描器承担，否则构成生成层缺口）。
- [依据]: 见 `oh-code-design/工作系统.yaml` 分层「工作生成层」职责「去重并合并重复工作」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock`、`temp`、敷衍式 `TODO` 或明显为兼容旧栈而存在的死分支。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。本文件以纯函数根据入参组装 `WorkOrder` 与 `WorkStep`，不直接修改实体、不触碰 UI，与 `oh-code-design/工作系统.yaml` 中「工作模型层」把任务拆为可执行步骤、由生成层产出工作单元的分层意图相容；与设计的偏差主要体现在「职责是否在本文件闭环」层面，已归入上一节漏做讨论，而非典型的跨层越权调用。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0166]: 修订 `generateHaulWork` 的 `workId` 生成策略，将 `coordKey(dropCell)`（或等价稳定片段）纳入字符串，保证在 `Map` 键语义下与 `haulDropCell` 字段一一对应，避免静默覆盖。
- [行动点 #0167]: 在编排入口（如各 `*-flow` 与 `addWork` 调用点）统一约定：创建工单后必须将 `workId` 写回目标实体 `relatedWorkItemIds`（或项目选定字段），或在 `work-generator` 同目录增加受注入的「登记关联」步骤，使行为与 `oh-code-design/工作系统.yaml`「双向关联」表述一致。
- [行动点 #0168]: 在 `addWork` 或专用「工作生成层」模块中实现与策划一致的去重/合并策略（例如按 `kind + targetEntityId + 关键格` 替换或合并），并在文档或代码注释中写明「去重」归属，避免设计层职责悬空。