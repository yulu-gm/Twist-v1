# 审计报告: src/game/entity/entity-projection.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `resource`、`tree` 投影为 `kind: "obstacle"` 时，仅设置 `label`（及占格），未把领域模型中已存在的策划关键信息同步到 `WorldEntitySnapshot` 上类型已预留的可选字段。例如 `ResourceEntity` 的容器、可拾取、占用者与堆叠等，以及 `TreeEntity` 的伐木标记、占用状态，在 `entity-types.ts` 的 `WorldEntitySnapshot` 中均有对应可选属性，但本函数未赋值。
- [依据]: 见 `oh-code-design/实体系统.yaml` 中「核心数据」对「物资实体」「树木实体」所列关键字段（位置、容器/拾取/占用等），以及「实体查询投影」职责说明：为工作分配、需求决策、地图显示提供稳定查询结果。若调用方仅通过本投影消费实体，则无法从快照结构恢复上述信息。

- [指控]: `zone` 分支仅将 `zoneKind` 与 `name` 编码进 `label`，未投影区域实体在领域模型中的覆盖格之外的规则字段（如 `acceptedMaterialKinds`、存储筛选相关字段）。依赖 `WorldEntitySnapshot` 单一路径的消费者无法获得与设计一致的「区域实体」完整只读视图。
- [依据]: 见 `oh-code-design/实体系统.yaml`「核心数据」中「区域实体」关键字段（区域类型、覆盖格集合、名称、接受物资类型规则等）。

- [指控]: `pawn` 投影结果仅含标识、位置与空的 `relatedWorkItemIds`，不包含设计文档中对小人实体列出的行为/目标/携带/需求类关键字段。虽可解释为 legacy 形状故意收窄，但若某模块误将本投影当作唯一对外查询结果，则与「统一实体视图」目标不一致。
- [依据]: 见 `oh-code-design/实体系统.yaml`「核心数据」中「小人实体」关键字段与目标中「让行为、工作、地图、建筑与 UI 基于统一实体视图协作」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现 `mock`、`temp`、`// TODO` 或未接入新系统的明显死代码；本文件为明确的 legacy 桥接，注释与模块头说明了用途。
- [指控]: `zone` 在 `coveredCells.length === 0` 时退化为固定格 `(0,0)`，属于为异常数据兜底的兼容占位；注释要求「调用方应避免此类数据进入模拟」，但未在投影层拒绝或显式标记非法，可能让错误数据在下游以合法占格形式存在。
- [影响]: 调试与数据校验成本上升，且可能与地图占用规则产生隐蔽不一致（取决于消费者是否信任该快照）。

## 3. 架构违规 (Architecture Violations)

- [指控]: 设计将「与实现无关的实体快照结构」放在领域模型层职责中，而将「只读投影」放在读取投影层；本模块把多种领域实体折叠进 world-core 历史枚举（`obstacle` 等），造成语义降级与字段丢失，与 `oh-code-design/实体系统.yaml` 中分层对快照/投影的表述存在张力。
- [依据]: 同文件「分层」中「领域模型层」—「提供与实现无关的实体快照结构」；「读取投影层」—「为 UI、交互反馈、调试视图提供只读投影」。本文件实质是「领域 → 旧序列化形状」的适配，长期存在会维护两套视图（与 `EntityRegistry.snapshot()` 使用的完整 `GameEntity` 克隆路径并存），增加违背「统一实体视图」协作目标的风险。

- [指控]: 空 `zone` 分支中 `cell` 与 `occupiedCells[0]` 复用同一 `fallback` 对象引用，而其余分支通过 `cloneCoord` 保证坐标对象独立。若下游对 `cell` 与 `occupiedCells` 做浅拷贝或意外可变写入，会出现与其他分支不一致的共享引用行为。
- [依据]: 虽非文档逐条明文，但与同文件内已采用的「逐格克隆」一致性原则相冲突，属于投影实现上的边界不一致。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0066]: 在仍必须保留 `WorldEntitySnapshot` 的前提下，为 `resource`、`tree`（及必要时 `zone`）补齐 `WorldEntitySnapshot` 已声明且领域侧已有的字段，或在工作流中强制禁止仅用本投影做工作分配/需求决策，并在模块注释中引用设计文档条款，明确能力边界。
- [行动点 #0067]: 对 `coveredCells` 为空的 `zone`，改为在上层校验失败、记录诊断，或返回显式可识别的非法/空快照约定，避免静默落在 `(0,0)`。
- [行动点 #0068]: 空 `zone` 的 `cell` 与 `occupiedCells` 使用两次 `cloneCoord`（或等价独立对象），与同函数其余分支保持一致。
- [行动点 #0069]: 在路线图层面收敛 world-core 消费方，优先统一使用 `ReadonlyEntitySnapshot`（`GameEntity`）路径，缩短本投影的生命周期，降低双轨维护成本。