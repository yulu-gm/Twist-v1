# 地图系统代码审计汇总报告

## 1. 现状总结 (Current State Summary)

整体来看，地图系统（`src/game/map/`）的基础骨架已具备，实现了网格坐标、基础占用、区域划分等核心能力，且没有明显的 UI 越权或严重的无用兼容代码残留。但与 `oh-code-design/地图系统.yaml` 的理想架构相比，当前实现在**职责内聚**、**数据模型对齐**以及**空间规则闭环**上存在明显差距：

1. **空间规则未在底层闭环**：
   - `zone-manager` 的区域创建（`createZone`）未强制绑定合法性校验（`validateZoneCells`），存在绕过规则直接创建重叠或非法区域的风险。
   - `occupancy-manager` 的批量写入（`writeEntityOccupancy`）在遇到冲突时会静默忽略，未能向上传递冲突结果。
   - `world-grid` 的线段生成（`gridLineCells`）缺乏越界裁剪，依赖调用方自行过滤。

2. **数据模型与设计文档存在偏差**：
   - 策划文档要求“地图格”能包含多个实体引用，并记录“建筑阻挡”与“临时保留”，但 `occupancy-manager` 目前仅支持单格单实体 ID，且阻挡与预约逻辑散落在网格配置与行为层中。
   - `zone-manager` 仅维护了覆盖格列表，未实现设计中要求的“边界范围”与“连通性信息”。
   - `storage-zones` 在快照中未显式聚合“当前存储物资集合”，且存在 `allowedMaterialKinds` 与 `acceptedMaterialKinds` 字段并存的技术债。

3. **职责边界模糊与性能隐患**：
   - `world-grid` 混入了业务级的 `interactionPoints` 和对 `pawn-state`（如 `NeedKind`）的依赖，破坏了其作为“纯粹共享空间基础”的定位。
   - `world-seed` 直接调用实体系统的 `spawnWorldEntity`，模糊了地图模块与实体生命周期编排层的边界。
   - `storage-zones` 的查询（如寻找可用存储格、解析存储组）高度依赖对全量世界实体的线性扫描，缺乏“空间索引层”应有的高频读取优化。

## 2. 修改建议 (Refactor Suggestions)

为了向 `oh-code-design/地图系统.yaml` 的理想架构靠拢，建议按以下方向进行重构：

### 2.1 强化空间规则与校验闭环
- **区域创建强校验**：在 `zone-manager.ts` 的 `createZone` 内部强制集成 `validateZoneCells`，校验失败时抛出错误或返回失败结果，确保区域数据的绝对合法。
- **占用冲突显式化**：修改 `occupancy-manager.ts` 的 `writeEntityOccupancy`，使其返回完整的冲突报告（`OccupyResult` 聚合），拒绝静默部分写入。
- **几何工具安全化**：为 `world-grid.ts` 的 `gridLineCells` 增加地图边界裁剪能力，或在选区解析链路上统一收口越界过滤。

### 2.2 对齐核心数据模型
- **升级占用模型**：若游戏机制允许同格多实体（如堆叠物资、可移动实体与阻挡建筑共存），需将 `OccupancyMap` 升级为集合或分层索引，并统一接管“建筑阻挡”与“临时保留”的查询。
- **补齐区域派生数据**：在地图域增加纯函数，基于 `coveredCells` 计算并缓存区域的“边界外包框”与“连通分量”，供 UI 投影和逻辑层使用。
- **清理字段技术债**：全仓统一存储区的材质过滤字段，废弃并清理 `allowedMaterialKinds` 或 `acceptedMaterialKinds` 中的一个。明确相邻存储区合并时的过滤规则。

### 2.3 净化模块职责与分层
- **剥离业务耦合**：将 `world-grid.ts` 中的默认交互点和需求增量（`needDelta`）移至关卡配置或世界种子中，移除对 `pawn-state` 的依赖。将 `isCellOccupiedByOthers` 移至 `occupancy-manager`。
- **上浮实体编排**：考虑将 `world-seed.ts` 中直接生成障碍实体的逻辑上浮至 `world-bootstrap` 等编排层，使地图目录更纯粹地负责空间解析。

### 2.4 建设空间索引层
- **优化存储区查询**：为存储区与地面物资建立基于坐标的空间索引。改造 `storage-zones.ts`，避免在 `findAvailableStorageCell` 和 `resolveStorageGroupAtCell` 中频繁全表扫描 `world.entities`，以支撑后期的性能扩展。