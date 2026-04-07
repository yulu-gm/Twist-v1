# 审计报告: src/game/world-internal.ts

## 1. 漏做需求

- [指控]: 实体创建路径未承担设计文档中「领域规则层」所描述的合法性校验，仅按 `EntityDraft` 字段拼装 `WorldEntitySnapshot`，不校验 `kind` 与必填字段组合、状态机前置条件（例如蓝图是否必须具备覆盖格、多格建筑与 `cell` 主格是否一致等）。
- [依据]: `oh-code-design/实体系统.yaml` 分层中「领域规则层」职责：校验实体状态变化是否合法；维护实体之间的一致性约束。对照 `createEntity`（约 64–103 行）为纯映射与 `nextEntityId` 递增，无规则分支。

- [指控]: `findExistingWorkItem` 作为工作去重入口，判定维度仅包含 `kind`、`targetEntityId` 与非 `completed` 状态，未体现设计中对「重复工作」在位置、链路或发起上下文上的合并/去重策略。
- [依据]: `oh-code-design/工作系统.yaml` 模块「工作生成器」职责：去重并合并重复工作；建立工作与目标实体的双向关联。实现见约 149–164 行：遍历全表且未读取 `anchorCell`、`derivedFromWorkId` 等 `WorkItemSnapshot` 字段。

- [指控]: `attachWorkItemToEntityMutable` 在目标实体不存在时直接返回，不向调用方暴露失败原因，与「编排层协调更新应可追踪」相比，异常路径被吞掉，不利于发现错误调用或时序问题。
- [依据]: `oh-code-design/实体系统.yaml` 分层中「应用编排层」职责：协调多实体联动更新（隐含失败应可诊断）；同类精神亦见于 `oh-code-design/工作系统.yaml` 工作结算层对异常场景的处理要求。实现见约 166–170 行。

## 2. 无用兼容与 Mock

- 未发现明显问题：文件中无 `mock` / `temp` / `TODO` 等临时痕迹，亦无明显仅为兼容已删除路径的死分支。

## 3. 架构违规

- [指控]: 本模块同时导出并再导出地图子系统的占用 API（`findBlockingOccupant`、`writeEntityOccupancy`、`deleteEntityOccupancy`），使调用方可从「世界内部工具」间接依赖地图占用实现细节，弱化 `oh-code-design/地图系统.yaml` 中「占用管理器」作为独立模块的边界清晰度。
- [依据]: `oh-code-design/地图系统.yaml` 模块「占用管理器」职责：记录每格占用、为移动与建造提供冲突判断；接口边界写明输入来自实体创建、删除、移动等事件。再导出见约 38 行及对 `occupancy-manager` 的引用。

- [指控]: `removeEntityMutable`、`upsertEntityMutable`、`attachWorkItemToEntityMutable` 等对 `WorldCore` 的就地修改与 `spawnWorldEntity` 的「克隆后成功提交」模式并存，且被 `world-core.ts`、`work-operations.ts`、`headless/scenario-helpers.ts` 等多处直接调用，领域状态变更入口分散，与设计中「应用编排层集中接收变更请求」的模块划分不完全同构，增加了绕过统一编排、形成面条式改写的风险。
- [依据]: `oh-code-design/实体系统.yaml` 应用编排层职责；技能 4.6 背景中对「分层与数据流」的约束。交互侧理想路径见 `oh-code-design/交互系统.yaml` 接口边界（向实体/地图等提交命令），与本文件被广泛当作底层扳手使用形成张力。

- [说明]: `spawnWorldEntity` / `removeEntityMutable` / `upsertEntityMutable` 在同一路径内同步维护 `entities` 与 `occupancy`，与 `oh-code-design/地图系统.yaml` 风险条款「实体位置与地图占用索引分开更新易产生鬼影」的方向一致，属于合规实现，**不**记为违规。

## 4. 修复建议

- [行动点 #0201]: 在实体创建或 `spawnWorldEntity` 之前增加集中校验（或委托单一 `validateEntityDraft`），按 `oh-gen-doc/实体系统.yaml` 与各 `kind` 的必填属性表校验草稿，使 `oh-code-design/实体系统.yaml` 领域规则层在代码中有明确落点。
- [行动点 #0202]: 扩展或替换 `findExistingWorkItem` 的匹配键（例如纳入 `anchorCell`、 haul 相关字段或 `derivedFromWorkId`），并与工作生成调用方对齐「何为重复工单」，以贴近 `oh-code-design/工作系统.yaml` 工作生成器的去重/合并语义。
- [行动点 #0203]: 将 `attachWorkItemToEntityMutable` 改为返回 `boolean` 或 `Outcome` 联合类型，实体缺失时显式失败，便于编排层记录或断言。
- [行动点 #0204]: 取消对 `occupancy-manager` 符号的二次导出，或文档化「仅 `world-core` / `*-operations` 允许引用」；新代码优先 `import` 自 `./map/occupancy-manager`，以巩固地图子系统边界。
- [行动点 #0205]: 通过 ESLint `import/no-restricted-paths` 或内部约定，将 `*Mutable` API 限制在 `world-core`、`work-operations`、`building/*` 等少数模块，逐步收敛与 `oh-code-design/实体系统.yaml` 应用编排层一致的变更入口。