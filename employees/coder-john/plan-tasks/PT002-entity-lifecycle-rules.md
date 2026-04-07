# 002-实体生命周期规则实现计划

## 1. 计划目标

根据 `oh-code-design/实体系统.yaml` 中模块 **「生命周期规则」** 的职责与 **关键流程**「树木转木头」「岩石转石头」「蓝图转建筑」「携带与放下」，将 `src/game/entity-system.ts` 内 `EntityLifecycle` 从占位实现为可执行的领域操作：在一次调用内完成登记簿上允许的删除、创建与字段更新，并与 `EntityRegistry` 的地面物资索引（`groundMaterialByCellKey`）保持一致。

本计划话题单一：**只实现生命周期规则与登记簿更新**，不实现工作结算管线、不实现完整行为状态机、不展开「关系一致性规则」模块（该模块可作为后续独立计划）。

## 2. 工作内容

1. **`fellingCompleteSpawnWood`**  
   - 校验目标为树木实体且格点一致（或与调用约定一致）。  
   - 从登记簿删除该树木；在同一 `GridCoord` 上创建木头类物资实体（物资具体类型名称与设计文档/现有数据命名一致，如「木头」「木柴」等以当前项目已有 `materialKind` 为准）。  
   - 创建物资时走 `registerMaterial`，若该格已有地面物资，需明确策略（合并数量、拒绝并抛错、或替换）——**以实现与 `EntityConsistencyRules.assertSingleGroundMaterialPerCell` 不矛盾为准**。

2. **`miningCompleteSpawnStone`**  
   - 与伐木对称：删除岩石，同格生成石头类物资实体。

3. **`blueprintCompleteSpawnBuilding`**  
   - 移除对应蓝图实体；根据蓝图类型创建建筑实体，`cellKeys` 与蓝图一致；`capabilities` / `ownerInfo` 等字段按蓝图类型可查表的 mock 映射或最小默认值填充（**仅满足当前无建筑系统的展示与查询需求，不实现完整建筑系统**）。

4. **`pawnPickupMaterial` / `pawnDropMaterial`**  
   - 拾取：将物资 `containerKind` 设为 `pawn`，`containerId` 为小人 id，**cell 建议同步为小人当前格**（与 `PawnEntity.cell` 一致），更新 `EntityRegistry` 中地面索引；更新对应 `PawnEntity.carriedMaterialId`（通过 `updatePawn` 或登记簿内部辅助方法）。  
   - 放下：将物资写回 `containerKind: "map"`，目标格为 `_at`，清除小人的 `carriedMaterialId`；维护地面索引。  
   - 对「同一份物资不得同时处于地图与携带」的强校验可调用或扩展 `EntityConsistencyRules` 的预留入口，**但若与本计划范围冲突则仅实现与当前登记簿一致的最小校验**。

5. **登记簿辅助（如需要）**  
   - 若「原地更新物资容器/格」会导致 `groundMaterialByCellKey` 不同步，在 `EntityRegistry` 内增加私有或公开的 `applyMaterialLocationChange` 类方法，避免复制粘贴索引维护逻辑。

## 3. 验收标准

- `EntityLifecycle` 上述五个入口均有实现，不再为空函数体；与 YAML 描述的四类流程在数据层面可对应（删除源实体、创建目标实体或更新携带关系）。  
- `npm run build` 编译通过。  
- 现有场景在无调用新入口时行为与改动前一致；若有单元测试或场景 mock 调用这些入口，结果符合登记簿查询（`getEntity`、`groundMaterialAtCell`、`listEntitiesAtCell` 等）预期。  
- 计划文件与 `001-entity-system-foundation.md` 无话题重叠：**001 已完成目录与原型；本计划仅补齐生命周期转化与携带/放下**。
