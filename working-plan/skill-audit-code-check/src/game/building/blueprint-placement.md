# 审计报告: src/game/building/blueprint-placement.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 放置时未通过 `getBuildingSpec` / `cellOffsetsFromAnchor` 合成占格，仅用 `occupiedCells ?? [input.cell]`。当前 `wall`/`bed` 在规格目录中均为单格，故行为与现状一致；一旦规格扩展为多格建筑，本入口若仍由调用方不传 `occupiedCells`，将与「占用格模式由规格驱动」脱节。
- [依据]: 见 `oh-code-design/建筑系统.yaml`「核心数据 / 建筑规格」关键字段「占用格模式」；「建筑规划层」职责「校验覆盖格并创建蓝图」。同目录「模块 / 建筑规格目录」要求维护每类建筑的尺寸等属性。

- [指控]: 设计中的独立「建造校验器」（可放置规则、墙体连续与家具单点差异）在本文件中未以模块形式出现；合法性强依赖 `spawnWorldEntity` 内的越界与占用冲突检测。若策划要求地形/规则类校验在创建蓝图前统一执行，本函数未提供该抽象挂载点。
- [依据]: 见 `oh-code-design/建筑系统.yaml`「模块 / 建造校验器」职责；关键流程「绘制墙体蓝图」「放置木床蓝图」中「建造校验器筛选/校验」步骤。

- [指控]: 新建的 `WorkItemSnapshot` 仅含 `kind`、`anchorCell`、`targetEntityId`、`status`、`failureCount` 等，未填充 `oh-code-design` 工作单模型中的「优先级」「发起原因」等扩展字段（若后续调度/UI 依赖这些字段，此处为数据缺口）。
- [依据]: 见 `oh-code-design/工作系统.yaml`「核心数据 / 工作单」关键字段（工作类型、工作状态、目标实体、目标位置、发起原因、优先级等）；关键流程「建造链路」中由蓝图到工作的衔接。

- [补充-已覆盖]: `oh-gen-doc/建筑系统.yaml` 蓝图阶段「蓝图会生成对应的建造工作任务」——本文件在成功生成蓝图实体后创建 `construct-blueprint` 工作并 `attachWorkItemToEntityMutable`，与该条一致。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 未发现 `mock`、`temp`、`// TODO` 或明显仅为兼容旧接口的死分支；`findExistingWorkItem` 用于同一蓝图实体下去重工作单，与 `oh-code-design/工作系统.yaml`「工作生成层」中「去重并合并重复工作」的方向一致，属合理逻辑而非冗余兼容。

- [风险说明]: 同目录下存在基于 `EntityRegistry` 的 `blueprint-manager.createBlueprint` 与基于 `WorldCore` 的 `spawnWorldEntity` 两条创建蓝图路径，本文件走后一路径；若未来只维护其中一条的字段/规则，易出现「双轨」维护成本。这不等于本文件内存在 Mock，但属于仓库级重复实现风险。

## 3. 架构违规 (Architecture Violations)

- [指控]: `oh-code-design` 将「蓝图管理器」与「建造校验器」与「工作生成器」分层表述；本文件在 `building` 包内直接调用 `world-internal` 的 `spawnWorldEntity`、`cloneWorld`、`makeWorkItemId` 等，把实体生成与工作登记收拢在同一小模块中，与文档中「蓝图管理器创建蓝图」「工作生成器从蓝图信号生成工作」的模块边界不完全一致，属于职责合并而非严格分层。
- [依据]: `oh-code-design/建筑系统.yaml`「模块」中蓝图管理器、建造校验器；`oh-code-design/工作系统.yaml`「模块 / 工作生成器」职责（根据蓝图等信号生成工作、建立双向关联）。

- [说明]: 通过 `world-core` 再导出给 `apply-domain-command` 等入口，数据流仍停留在领域核心内，未发现 UI 越权写世界等更严重的分层破坏。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0058]: 在 `safePlaceBlueprint` 内对 `input.buildingKind` 调用 `getBuildingSpec`（`building-spec-catalog`），用 `cellOffsetsFromAnchor` 与锚点 `input.cell` 计算默认占格集合；若调用方显式传入 `occupiedCells`，可与规格结果比对或规定「规格优先」策略，避免多格建筑上线时 silent wrong。
- [行动点 #0059]: 将「校验覆盖格」抽成可注入或同包内的建造校验函数（即使初期仅包装现有越界/占用检测），与 `oh-code-design` 中的建造校验器命名对齐，便于后续接地图规则与墙体/家具模式分支。
- [行动点 #0060]: 中长期让 `WorldCore` 蓝图创建复用与 `blueprint-manager` 共享的「锚点 + 规格 → 蓝图实体形状」逻辑，工作创建则尽量委托工作子系统的生成/去重入口，使 `blueprint-placement.ts` 变薄为编排层。