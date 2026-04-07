# 审计报告: src/game/entity/entity-types.ts

## 1. 漏做需求 (Missing Requirements)

- **[指控]**: 树木实体在类型层未完整对齐策划文档中的「伐木状态」三态枚举。
- **[依据]**: 见 `oh-gen-doc/实体系统.yaml` 中「树木」属性「伐木状态」的可选值：`正常`、`已标记伐木`、`伐木中`。当前 `TreeEntity` 仅用 `loggingMarked: boolean` 与 `occupied: boolean` 表达，未在类型上区分「正常 vs 已标记」之外的独立「伐木中」状态（若完全依赖 `occupied` 推断，则与文档枚举仍非一一对应，且可读性依赖约定）。
- **[指控]（粒度差异）**: 物资「类型」在策划文档中为 `初始物资`、`木头`、`包装食品`；代码中 `ResourceMaterialKind` 为 `wood` | `food` | `stone` | `generic`。`stone`/`generic` 可视为对地图/采矿等需求的扩展，但「初始物资」无独立字面量，若策划验收以文档枚举为准，需在类型或映射层显式对齐或更新文档。
- **[说明]**: `PawnEntity` 将行为拆为 `behavior` 与 `currentGoal` 且允许 `undefined`，与 `oh-gen-doc` 中单字段「状态」的表述不同；若 `../pawn-state` 中已完整覆盖三态并与 UI/规则一致，则属表达拆分而非本文件单独漏做，本报告仅标出与文档字面结构的差异。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现 `mock`、`temp`、`// TODO` 或明显临时代码分支。
- **[轻微关注]**: `AssignmentReason` 当前仅有字面量 `"unassigned"`，更像预留扩展的极简枚举而非 Mock；若长期无第二取值，需确认是否应为联合类型扩展或合并进 `EntityOwnership` 的文档说明，避免被误读为未完成占位。

## 3. 架构违规 (Architecture Violations)

- 本文件为纯类型定义，无跨层调用或越权修改数据，**未发现**违反 `oh-code-design/实体系统.yaml` 中「领域模型层 / 读取投影层」职责边界的实现行为。
- **[设计对齐说明]**: `WorldEntityKind` 含 `obstacle`，而 `oh-code-design/实体系统.yaml` 核心数据列举的实体原型为小人、物资、树木、蓝图、建筑、区域（未列障碍物）。文件注释已标明与 world-core 序列化视图一致，属**世界视图扩展**；建议在后续修订 `oh-code-design` 时补充「世界占用/障碍与领域实体 kind 的边界」条款，避免调用方混淆 `EntityKind` 与 `WorldEntityKind` 的适用场景（本条为文档缺口提示，不构成本文件代码层面的分层违规）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0074]: 评估将树木伐木相关状态提升为与 `oh-gen-doc` 一致的三态联合类型（或在与策划对齐的前提下更新 `oh-gen-doc`/`oh-code-design` 以采纳 boolean + `occupied` 的约定），并在验收文档中写明映射规则。
- [行动点 #0075]: 为 `ResourceMaterialKind` 与策划物资类型建立显式对照表（常量映射或注释引用 YAML 条款），或在文档中承认 `stone`/`generic` 为系统扩展并同步 `oh-gen-doc`。
- [行动点 #0076]: 在 `oh-code-design/实体系统.yaml` 的「实体原型定义」或「接口边界」中补充 `WorldEntityKind`（含 obstacle）与领域侧 `GameEntity` 六原型的关系说明，便于审计与新人理解双轨枚举。
- [行动点 #0077]: 若 `AssignmentReason` 确为长期单值，可考虑合并或文档化；若将扩展为多种归属/分配原因，则补齐联合类型与注释依据。