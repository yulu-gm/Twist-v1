# 审计报告: src/game/entity/lifecycle-rules.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `transformBlueprintToBuilding` 在移除蓝图并创建建筑前，**未校验**蓝图的 `buildState` / `buildProgress01` 是否已达「可落成建筑」条件；任意调用方若绕过工单编排，可能将未完成蓝图直接转为建筑。
- [依据]: 见 `oh-code-design/实体系统.yaml` 关键流程「蓝图转建筑」步骤：「建造进度达到完成条件」→「生命周期规则移除蓝图实体」→「创建对应建筑实体」。

- [指控]: `transformTreeToResource` **未校验**树木是否处于策划定义的伐木前置语义（如 `TreeEntity.loggingMarked`、占用状态等），仅校验种类与格上是否已有地面物资阻挡。
- [依据]: 见 `oh-gen-doc/实体系统.yaml` 树木「伐木完成」效果描述（树木消失、生成木头）；`oh-code-design/实体系统.yaml` 关键流程「树木转木头」以「伐木工作完成」为前置。当前规则层不守门时，错误调用可能消除未标记树木。

- [指控]: `dropResource` 仅支持将物资写回**地图格**并将 `containerKind` 固定为 `"ground"`，**未实现**「写回目标区域（存储区等）」或 `containerKind: "zone"` / `containerEntityId` 等路径；与物资可入存储区的策划模型未在本文件中闭环。
- [依据]: 见 `oh-code-design/实体系统.yaml` 关键流程「携带与放下」：「放下时写回目标格或**目标区域**」；`oh-gen-doc/实体系统.yaml` 物资属性含「所属存储区」及散落/存储/携带状态。

- [指控]: `blocksBlueprintResolution` 对 `entity.kind === "zone"` 落入 `default` 并返回 `false`，即**区域覆盖格不视为**蓝图落地冲突；若策划要求蓝图/建筑与区域（如禁区、存储区）需统一占格冲突策略，则当前判定可能偏宽。
- [依据]: 见 `oh-code-design/实体系统.yaml` 风险条款：「若蓝图、建筑、区域都直接保存完整格集合，需要**统一冲突判定策略**」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：文件中无 `mock` / `temp` 占位、`// TODO` 或明显仅为兼容旧管线而存在的死分支；`buildingInteractionCaps` 对非床建筑返回空能力列表属于当前 `InteractionCapability` 仅有 `"rest"` 下的合理缺省，而非临时兼容层。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件定位为「确定性校验 + 在 `EntityRegistry` 上执行状态变更」，依赖方向为 `world-grid` 坐标工具、`entity-types` 与 `EntityRegistry` 类型，**未**直接依赖 UI、交互或工作编排，与 `oh-code-design/实体系统.yaml` 中「生命周期规则」职责及「领域规则层」校验/一致性维护的分工基本一致。

- [指控]（轻微重复）: `cellKeyMatches` 与 `entity-registry.ts` 内同名辅助函数语义重复，长期可能造成一处修改、另一处未跟进的维护风险；属模块内 DRY 问题，尚不构成对分层宪法的直接违反。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0078]: 在 `transformBlueprintToBuilding` 入口增加对 `buildState === "completed"`（及/或 `buildProgress01` 达阈值）的显式校验，失败时返回独立 outcome，使生命周期规则自身满足「完成条件后再转化」的设计表述。
- [行动点 #0079]: 在 `transformTreeToResource` 中按产品确认结果，增加对 `loggingMarked` / `occupied` 等字段的校验（或文档明确：此前置**仅**由工作系统保证，规则层刻意不重复校验），避免与设计叙事冲突。
- [行动点 #0080]: 扩展「放下」规则：支持落到存储区/区域实体（`containerKind: "zone"`、`containerEntityId`、与 `ZoneEntity` 覆盖格及接受物资规则对齐），或在工作编排层明确「落地到格」即等价于策划中的存储归属，并在设计文档中收窄「目标区域」含义。
- [行动点 #0081]: 与策划确认蓝图/建筑与 `zone` 的占格冲突策略；若区域应阻挡蓝图解析，在 `blocksBlueprintResolution` 中为 `"zone"` 增加与覆盖格相交的判定逻辑。
- [行动点 #0082]: 将 `cellKeyMatches` 抽到共享小工具模块或由注册表导出，消除与 `entity-registry` 的重复实现。