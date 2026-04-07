# PT012：基于实体的需求交互（上）—— 实体数据扩展与 AI 目标重构

## 需求依据（oh-gen-doc）

- `oh-gen-doc/实体系统.yaml`：实体系统应作为游戏内所有动态对象的唯一事实来源，包含建筑（如床、娱乐设施）和物资（如食物）。
- `oh-gen-doc/行为系统.yaml`：小人的需求（饥饿、精力、娱乐）应通过与具体的实体交互来满足，而不是依赖地图上的硬编码坐标点。

## 现状（代码）

- 目前小人满足需求（吃、睡、玩）的目标点是硬编码在 `src/game/world-grid.ts` 的 `WorldGridConfig.interactionPoints` 中，属于原型期的 Mock 数据。
- `src/game/goal-driven-planning.ts` 中的 AI 规划逻辑依赖 `interactionPointsByKind` 来寻找目标，导致“玩家建造的床，小人不去睡”的系统割裂。
- `BuildingEntity` 和 `MaterialEntity` 尚未完全对齐需求交互所需的属性（如食用恢复值、预占状态等）。

## 目标话题（单一）

**扩展实体系统的数据结构以支持需求交互，并重构 AI 目标规划逻辑，使其从 `EntityRegistry` 中寻找满足需求的实体，替代原有的 `InteractionPoint` 查找。**

## 实现要点

1. **实体数据与配置补全 (`src/game/entity-system.ts`)**
   - 为 `BuildingEntity` 补充 `reservedByPawnId?: EntityId` 字段（与 `MaterialEntity` 保持一致，用于统一预占逻辑）。
   - 为 `MaterialEntity` 或相关配置结构增加支持“可食用”属性的扩展空间（如配置表 `MATERIAL_DEFAULTS`，用于标识 `berry` 等物资的营养值）。
   - 为 `BuildingEntity` 或相关配置结构增加支持“恢复需求”属性的扩展空间（如在 `BUILDING_DEFAULTS` 中支持定义 `rest`、`recreation` 的恢复数值和耗时）。

2. **重构 AI 目标规划 (`src/game/goal-driven-planning.ts`)**
   - 废弃对 `grid.interactionPoints` 的查询。
   - **找食物**：遍历 `EntityRegistry.listMaterialsOnGround()`，过滤出可食用且未被其他人 `reserved` 的物资。
   - **找床/娱乐**：遍历 `EntityRegistry.listEntitiesByKind("building")`，过滤出 `capabilities` 包含对应能力（`"rest"` / `"recreation"`）且未被 `reserved` 的建筑。
   - 将规划出的目标 `targetId` 明确改为 `EntityId` 类型。

## 非范围

- 本计划**不包含**实际的交互执行逻辑（如扣减食物数量、恢复需求数值），也不包含旧系统（`InteractionPoint`）的彻底删除（由 PT013 处理）。
- 本计划**不包含**在地图上正式预生成床、食物、娱乐设施的模板与种子数据（由 PT014 处理）。为保证本计划测试通过，可临时手动生成一两个实体用于验证 AI 寻址。

## 验收标准

- `BuildingEntity` 拥有预占字段，AI 产生需求时，能够正确扫描 `EntityRegistry` 并将 `targetId` 指向合法的 `EntityId`，而非硬编码的 `InteractionPoint`。
