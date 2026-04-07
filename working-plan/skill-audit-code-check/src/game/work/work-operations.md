# 审计报告: src/game/work/work-operations.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `completeBlueprintWork` 在结算时直接移除蓝图实体并创建建筑实体，未校验或推进蓝图上的「建造进度」，与「读条/进度达到完成条件后再转建筑」的策划与架构描述不一致。
- [依据]: `oh-code-design/实体系统.yaml` 关键流程「蓝图转建筑」步骤写明「建造进度达到完成条件」后移除蓝图并创建建筑；`oh-code-design/建筑系统.yaml` 建筑施工层职责含「管理建造进度」，核心数据「蓝图记录」含「当前进度」；`oh-gen-doc/工作系统.yaml` 建造类工作完成条件为「蓝图建造进度达到 100%」。

- [指控]: `oh-code-design/工作系统.yaml` 需求覆盖结论写「拾取、搬运、伐木、建造四类工作」；本文件另实现 `deconstruct-obstacle`、`mine-stone` 的领取/失败/完成全链路。若以该 YAML 为范围基准，策划覆盖声明未显式包含拆除障碍与采矿，易造成验收与文档漂移（实现超前或文档漏写，需产品侧对齐）。
- [依据]: `oh-code-design/工作系统.yaml` 需求覆盖与 `oh-gen-doc/工作系统.yaml` 工作类型枚举（未列采矿/拆除类工单）。

- [指控]: `oh-gen-doc/工作系统.yaml` 以「失败」描述工作终态语义之一；当前 `WorkItemSnapshot.status` 仅有 `open` | `claimed` | `completed`，`failWorkItem` 将工单打回 `open` 并累加 `failureCount`，与文档中独立的「失败」状态命名及 UI/验收口径可能不一致（属模型层缺口在本文件结算行为上的体现）。
- [依据]: `oh-gen-doc/工作系统.yaml`「工作状态」小节。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `zoneAllowsResource`（约第 439–445 行）同时读取 `zone.allowedMaterialKinds` 与 `zone.acceptedMaterialKinds`，用空值合并兼容两套字段名。
- [影响]: 区域存储过滤在类型与数据上存在「同义双字段」，增加持久化与序列化一致性问题，与 `oh-code-design/实体系统.yaml` 区域实体「接受物资类型规则」单一概念并存多套命名。

- [指控]: 本文件实现的 `WorkItemSnapshot` 纯函数结算（`claimWorkItem` / `completeWorkItem` / `failWorkItem` 等）与同目录下基于 `WorkOrder` 的 `work-settler.ts` 结算并存；`world-work-tick.ts`、`scenario-loader` 等仍走本路径，而 `chop-flow.ts`、`build-flow.ts` 等走 `settleWorkSuccess`，形成双栈工作结算。
- [影响]: 新行为若只接其中一条链路，易出现「一侧已结算、另一侧仍见旧工单」或重复维护两套派生工作逻辑，贴近 code-audit 所强调的「新系统与旧入口并存」技术债形态。`work-types.ts` 注释已承认两模型并存。

- [指控]: `completeBlueprintWork` 中建筑 `label` 由 `blueprint.label?.replace("-blueprint", "")` 推导（约第 182 行），依赖字符串后缀约定而非规格数据。
- [影响]: 命名约定变更会导致展示标签静默错误，属于脆弱兼容而非声明式规格驱动。

- 未发现 `mock`、`temp`、`// TODO` 等典型临时标记。

## 3. 架构违规 (Architecture Violations)

- [指控]: `reopenHaulWorkAtDropCell` / `reopenHaulWork` 在将搬运工单重置为 `open`、递增 `failureCount` 并清空认领时，对外返回的 `CompleteOutcome` 仍为 `{ kind: "completed" }`（约第 523–526、587–592 行），与工单实际「重开待领取」语义相反，易误导调用方把结果当作「搬运已成功完成」。
- [依据]: `oh-code-design/工作系统.yaml` 工作结算层职责要求「根据执行结果完成、失败或重开工作」；返回值应能区分成功完成与失败重开，当前类型未承载该区分。

- [指控]: 工作结算与 `world-internal` 中的 `cloneWorld`、`removeEntityMutable`、`upsertEntityMutable` 等紧耦合，同一业务域内存在 `WorkOrder` 声明式步骤模型与本文件命令式按 `kind` 分支两套抽象，与 `oh-code-design/工作系统.yaml` 扩展点「工作类型可通过声明式步骤模板扩展」方向不一致，长期会阻碍统一编排。
- [依据]: `oh-code-design/工作系统.yaml` 工作模型层、扩展点；模块「工作编排器」职责含「拆出后续工作而不是把整条链路塞进单一步骤」——本文件在 `completeChopWork` 等内联派生工单是合理编排，但整体与 `WorkOrder`/`WorkStep` 路径未收敛。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0172]: 在蓝图实体上实现并校验「建造进度」后再调用与 `completeBlueprintWork` 等价的转换，或在工作完成前由行为/读条系统写满进度字段，使结算与 `oh-code-design/实体系统.yaml`、`oh-gen-doc/工作系统.yaml` 一致。
- [行动点 #0173]: 将 `reopenHaulWork*` 的返回类型从与「成功完成」共用的 `CompleteOutcome` 中拆出（例如 `reopened` / `retry`），或让 `completeHaulWork` 在重开路径返回明确失败语义，避免 `kind: "completed"` 与 `status: "open"` 矛盾。
- [行动点 #0174]: 收敛区域过滤字段：在实体模型与文档中只保留 `oh-code-design/实体系统.yaml` 所描述的单一规则字段，删除 `allowedMaterialKinds` 与 `acceptedMaterialKinds` 双轨读法。
- [行动点 #0175]: 制定迁移计划，使 `world-work-tick` / 场景加载与 flow 共用同一套工作结算入口（`WorkOrder` + settler 或抽取共享内核），减少 `WorkItemSnapshot` 与 `WorkOrder` 并行实现。
- [行动点 #0176]: 用 `blueprintKind` 或建筑规格表生成成品 `label`，去掉对 `"-blueprint"` 后缀字符串的依赖。
- [行动点 #0177]: 在 `oh-code-design` / `oh-gen-doc` 中补充采矿、拆除类工单的类型与流程描述，或从代码中移除未纳入范围的工作类型，使「需求覆盖结论」与实现一致。