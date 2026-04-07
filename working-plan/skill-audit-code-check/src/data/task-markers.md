# 审计报告: src/data/task-markers.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `worldDerivedTaskLabelForCell` 对未完成工作 `pick-up-resource` 使用 `issuedTaskLabelForToolId("haul")`，格上展示为工具栏「搬运」文案；策划文档将「拾取」与「搬运到存储区」描述为不同工作类型与流程。
- [依据]: 见 `oh-gen-doc/工作系统.yaml` 中「拾取物资」与「搬运物资到存储区」分节定义；见 `oh-code-design/工作系统.yaml`「关键流程 / 伐木链路」中「生成拾取工作与搬运工作」的步骤拆分。若产品期望地图格任务文案与上述类型严格一一对应，当前实现未为「纯拾取」工作单提供独立展示标签来源（`VILLAGER_TOOLS` 亦无单独拾取工具 id，仅有 `haul`），存在语义对齐缺口，需策划或 UI 规范补充「工作 kind → 格上文案」的显式规则后方可闭环验收。

- 其余能力（拆除障碍标记、蓝图占用、伐木/采矿工作锚格与快照合并、`idle`/`zone_create` 不参与格上任务文案等）与 `oh-code-design/UI系统.yaml`「地图叠加反馈层」及 `oh-code-design/工作系统.yaml`「根据地图标记、蓝图生成…自动创建工作」的方向一致，未发现文档已规定而本文件完全未覆盖的硬缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock`/`temp` 数据、无 `TODO` 占位，亦无明显仅为兼容已删除系统而保留的死分支；`domainBackedDisplayLabels` 模块级缓存属于性能优化，非遗留兼容层。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件仅提供纯函数，根据 `WorldSnapshot` 与 overlay 计算展示用 `Map`，不写入领域状态，与 `oh-code-design/UI系统.yaml` 目标「以读模型驱动展示，避免 UI 直接承担领域规则」相符。依赖 `WorldSnapshot`、`SelectionModifier` 与格键工具属于读侧合成所需，未体现「UI 层直接修改核心数据」类违规。
- [说明]: `oh-code-design` 未单独定义 `src/data` 与 `game` 的目录边界；若团队后续收紧分层，可将「任务标记叠加合成」与 `UI系统.yaml`「界面状态层 / 地图叠加反馈层」的物理归属对齐，属工程组织优化而非当前文档可证的硬性违反。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0011]: 与策划/UI 确认：`pick-up-resource` 格上文案是否必须显示为「拾取」或与 `物资拾取标记工具` 一致；若是，在配置或映射表中增加独立于 `haul` 的展示字符串（或扩展工具/工作元数据），再调整 `worldDerivedTaskLabelForCell` 中对应分支。
- [行动点 #0012]: 若未来为 `mow`/`farm`/`patrol` 等工具增加领域层可查询的占用或工作 kind，应在 `worldDerivedTaskLabelForCell` 与 `mergeTaskMarkerOverlayWithWorldSnapshot` 的 keys 收集逻辑中按 `oh-code-design/工作系统.yaml` 与交互文档同步扩展，避免仅有意图 overlay、无法与快照对齐。