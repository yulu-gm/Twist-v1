# 建筑系统代码审计汇总报告 (Building System Audit Summary)

## 1. 现状总结 (Current Status Summary)

通过对 `oh-code-design/建筑系统.yaml` 的比对以及对 `src/game/building/` 目录下各模块的审计，当前建筑系统的实现现状如下：

1. **规格驱动未彻底落实（数据与逻辑割裂）**：
   - **建成结算硬编码**：虽然 `BuildingSpec` 规格目录中定义了交互能力（`interactionCapabilities`）和建成附加规则（`onCompleteRules`），但实际建成结算逻辑（如 `work-operations.ts`）大量依赖 `blueprintKind === "bed"` 等硬编码分支，完全旁路了规格数据。
   - **占格计算未走规格**：在放置蓝图（`blueprint-placement.ts`）时，未读取规格中的 `cellOffsetsFromAnchor` 来计算实际占格，目前仅按单格处理。一旦引入多格建筑，将直接导致占格逻辑崩溃。
   - **缺失关键字段**：规格中缺少设计文档明确要求的“是否可归属”字段，且未预留材料消耗与校验的扩展点。

2. **蓝图与工单的生命周期脱节（双向关联断链）**：
   - **创建路径双轨制**：目前存在 `blueprint-manager.ts` 和 `blueprint-placement.ts` 两条创建蓝图的路径。
   - **工单联动缺失**：`blueprint-manager.ts` 在创建蓝图时未同步关联建造工单（`relatedWorkItemIds` 始终为空），在取消蓝图时也未联动撤销关联工单。这导致蓝图与建造任务的因果一致性存在严重缺口。
   - **职责揉杂**：`blueprint-placement.ts` 虽关联了工单，但将蓝图实体生成与工作登记直接揉杂在一起，侵入了“工作生成器”的职责边界。

3. **架构模块缺失与职责模糊**：
   - 设计文档中规划的“建造校验器”、“建成结算器”和“归属规则器”在当前代码中均未形成独立的模块抽象。
   - 放置合法性强依赖底层的越界与占用冲突检测，缺乏对“连续墙体”与“单点家具”放置差异的校验层。

4. **类型安全与噪声问题**：
   - `BUILDING_SPECS` 的键类型放宽为 `Record<string, BuildingSpec>`，未与闭合的 `BuildingKind` 联合类型强绑定，存在类型安全隐患。
   - 规格中存在未实现的占位规则 ID（如 `refresh-pathfinding-cache`），对维护者造成了信号噪声。

---

## 2. 修改建议 (Modification Suggestions)

为了对齐 `oh-code-design` 的理想架构，建议按以下步骤进行重构和修复：

### 行动点 1：全面落实规格驱动（消除硬编码）
- **重构建成结算**：在建成唯一入口（如 `completeBlueprintWork`）强制读取 `getBuildingSpec`。根据规格的 `interactionCapabilities` 填充实体的交互字段，并按 `onCompleteRules` 动态分发后续逻辑（如床铺归属），彻底删除 `blueprintKind === "bed"` 的硬编码分支。
- **修复占格计算**：在 `safePlaceBlueprint` 中，强制读取规格的 `cellOffsetsFromAnchor` 与锚点结合计算占格集合，确保多格建筑的兼容性。
- **完善规格数据**：在 `BuildingSpec` 中补充“是否可归属”布尔字段，并预留可选的材料消耗/校验字段（如 `materialCost`）。

### 行动点 2：收敛蓝图生命周期与工单联动
- **统一入口**：明确全项目唯一的蓝图创建入口，消除 `WorldCore` 和 `EntityRegistry` 的双轨创建漂移。
- **强化双向关联**：在蓝图创建和取消的编排层，必须严格联动工作系统。创建蓝图时确保将工单 ID 写入 `relatedWorkItemIds`；取消蓝图时必须同步撤销对应的建造工单。
- **解耦工作生成**：将 `blueprint-placement.ts` 中的工作单生成逻辑委托给工作子系统的专门入口，使放置模块变薄，回归“编排”本质。

### 行动点 3：补齐缺失的架构模块
- **抽离建造校验器**：将放置校验逻辑抽离为独立的校验函数或模块（建造校验器），统一处理地形校验、占用冲突，并为墙体和家具提供差异化的放置规则抽象。

### 行动点 4：强化类型安全与清理噪声
- **收窄类型**：将 `BUILDING_SPECS` 的类型收窄为 `Record<BuildingKind, BuildingSpec>`，并将 `getBuildingSpec` 的参数类型改为 `BuildingKind`。
- **清理噪声**：移除 `OnCompleteRuleId` 中未实现且短期无计划的预留 ID（如寻路缓存），保持代码与实际数据的一致性。
