# 审计报告: src/game/building/building-spec-catalog.ts

## 1. 漏做需求

- [指控]: `oh-code-design/建筑系统.yaml` 在「建筑规格目录」职责中要求维护「是否可归属」，与尺寸、通行性、可交互能力并列；当前 `BuildingSpec` 仅有 `onCompleteRules` 等字段，无显式的可归属标记，床的归属语义完全依赖业务代码对 `blueprintKind === "bed"` 的分支，而非目录数据。
- [依据]: `oh-code-design/建筑系统.yaml` 模块「建筑规格目录」职责条目（维护每类建筑的尺寸、通行性、可交互能力、是否可归属）。

- [指控]: 规格中已声明「完成后附加规则」（如 `assign-bed-ownership`），但全仓库无任何读取 `onCompleteRules` 或按规则 id 分发的实现；建成时的交互能力、归属初始状态与 `restSpots` 更新在 `work-operations.ts` 的 `completeBlueprintWork` 等处按 `blueprintKind` 硬编码，未走数据驱动的结算链路。
- [依据]: `oh-code-design/建筑系统.yaml` 核心数据「建筑规格」关键字段「完成后附加规则」；模块「建成结算器」职责（在施工完成时生成建筑实体、触发床铺分配等后续规则）。

- [指控]: `getBuildingSpec` 已导出，但除 `building/index.ts` 再导出外无调用方；与「通过统一目录按类型取规格」的用法不一致（调用方多直接使用 `BUILDING_SPECS.wall` / `.bed` 或根本不查表）。
- [依据]: `oh-code-design/建筑系统.yaml` 目标「统一管理建筑类型、放置规则、完成后效果与归属关系」。

- [指控]: 设计风险与待确认中要求「保留可选材料校验接口」；当前 `BuildingSpec` 未包含材料、消耗或校验钩子相关可选字段，扩展点仅停留在文档层。
- [依据]: `oh-code-design/建筑系统.yaml` 待确认问题「建造是否消耗材料目前未定，需保留可选材料校验接口」；扩展点「建筑规格可扩展材料、房间标签、功能半径等属性」（当前材料侧未建模）。

- [补充说明]: 蓝图占格与 `cellOffsetsFromAnchor` 的解析在 `blueprint-manager.ts` 中已通过传入的 `BuildingSpec` 落实，故「占格完全未走规格」不成立；问题集中在**建成阶段**能力与规则未消费本目录。

## 2. 无用兼容与 Mock

- [指控]: `OnCompleteRuleId` 的注释列举 `refresh-pathfinding-cache` 为「预留」，类型上允许任意 `string`，易与已落地的 `assign-bed-ownership` 混淆，形成「文档上有规则语义、运行时可无执行体」的信号噪声。
- [影响]: 维护者可能误以为寻路缓存已与规格挂钩，实际上数据中未出现该 id、也无消费者。

- [其他]: 未发现 `mock` / `temp` / `TODO` 等临时实现或专门兼容旧系统的死分支；`BUILDING_SPECS` 体量小且与当前 `BuildingKind` 一致，无明显孤岛 Mock 数据。

## 3. 架构违规

- [指控]: 「建筑定义层」在规格中声明了完成后规则 id，但「建筑结果层」建成路径未通过本模块消费这些 id，却在工单/实体模块内重复实现床与墙的语义，造成**单一事实来源被旁路**，与分层中定义层与结果层应对齐的意图不符。
- [依据]: `oh-code-design/建筑系统.yaml` 分层「建筑定义层」「建筑结果层」及模块「建成结算器」与「建筑规格目录」的职责划分。

- [指控]: `BUILDING_SPECS` 使用 `Record<string, BuildingSpec>`、`getBuildingSpec(type: string)` 放宽键类型，未与 `BuildingKind` 联合类型绑定，削弱「统一管理建筑类型」的类型约束，易出现非法键静默返回 `undefined` 的用法风险。
- [依据]: `oh-code-design/建筑系统.yaml` 核心数据「建筑规格」关键字段「建筑类型」；实体域 `BuildingKind` 已为闭集（见 `entity-types.ts`）。

- [关联]: `lifecycle-rules.ts` 中 `buildingInteractionCaps` 与 `work-operations.ts` 中建成逻辑对 `bed`/`rest` 的重复判断，与规格目录中的 `interactionCapabilities` / `onCompleteRules` **双轨并行**，属架构层面的数据流分裂（非本文件单独越权调用 UI/地图，但破坏目录作为配置边界的单一性）。

## 4. 修复建议

- [行动点 #0061]: 在建成唯一入口（如 `completeBlueprintWork` 或与 `lifecycle-rules` 对齐的结算路径）读取 `getBuildingSpec(blueprint.blueprintKind)`，用 `interactionCapabilities` 填充建筑实体交互字段，并按 `onCompleteRules` 分发（床铺归属、`restSpots` 登记等），删除与规格重复的 `blueprintKind === "bed"` 硬编码分支。
- [行动点 #0062]: 在 `BuildingSpec` 上增加与设计一致的「是否可归属」布尔或枚举字段（或明确文档约定：该语义仅由某条 `onCompleteRuleId` 表达），并令归属规则器/结算器只读目录字段，避免类型名散落判断。
- [行动点 #0063]: 将 `BUILDING_SPECS` 收窄为 `Record<BuildingKind, BuildingSpec>`（或 `satisfies` + 穷尽检查），`getBuildingSpec` 参数改为 `BuildingKind`，减少非法类型键。
- [行动点 #0064]: 若短期不实现路径缓存类规则，从 `OnCompleteRuleId` 注释中移除或标明「未纳入数据」的示例 id，避免假信号；待实现时再补枚举与消费方。
- [行动点 #0065]: 按设计扩展点增加可选字段（如 `materialCost?: ...` 或占位类型）或独立「材料校验」接口类型，使「可选材料校验」在数据模型上有挂载点，即使逻辑暂为空实现。