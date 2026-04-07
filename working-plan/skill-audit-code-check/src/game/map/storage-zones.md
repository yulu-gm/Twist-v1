# 审计报告: src/game/map/storage-zones.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `StorageGroupSnapshot` 仅包含分组键、格子、`zoneIds`、展示名与过滤字段，未在快照结构中携带设计里存储区实体所描述的「当前存储物资集合」的显式聚合视图。
- [依据]: 见 `oh-code-design/地图系统.yaml` 核心数据「存储区」关键字段中的「当前存储物资集合」；本文件通过遍历 `world.entities` 在 `zoneResourcesAtCell` / `storageCellLockedMaterial` 中按需推导，未在 `listStorageGroups` 结果中体现该集合字段。若调用方依赖「分组即带物资清单」的单一快照，则存在缺口。

- [指控]: 多存储区实体在正交相邻时会被合并为同一连通分组，但组级 `filterMode` 与 `allowedMaterialKinds` 的合并规则（首个有 `storageFilterMode` 的区、以及允许种类的并集）在 `oh-gen-doc` / `oh-code-design` 中未定义；与「一个逻辑分组、多个源区域」相关的过滤语义属于文档未闭合项下的实现自行取舍，易与策划对「存储区」边界的理解不一致。
- [依据]: 见 `oh-code-design/地图系统.yaml` 待确认问题「存储区是否允许非连续格集合」及扩展点「区域系统可扩展优先级、过滤规则与多种区域类型」；见 `oh-gen-doc/地图系统.yaml` 区域系统·存储区属性（名称、包含地图格、存储的物资）—未规定相邻多区合并后的过滤策略。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `ZoneLike` 与 `zoneAllowsMaterial`、`groupAllowedKinds` 中同时读取 `allowedMaterialKinds` 与 `acceptedMaterialKinds`（如第 130、157 行），与 `world-core-types`、`entity-types`、`zone-manager` 等处的双字段并存一致，属于字段更名/迁移未收口的重复语义路径。
- [影响]: 新代码若只维护其一，另一字段仍可能被旧数据或旧路径写入，导致过滤行为依赖「谁先非空」，增加排错成本；与 `src/game/work/work-operations.ts` 中的同类分支重复，属于全仓级技术债在本文件的投射。

- [指控]: `findAvailableStorageCell` 内对 `resource.materialKind ?? "generic"` 的默认值（第 278、289 行）在类型上掩盖「物资无材质」的异常数据；若设计上物资类型必填，则属于对坏数据的静默吞没而非业务分支。
- [影响]: 可能把本不该入库的实体当作 `generic` 参与存储筛选，与设计对物资类型的枚举约束（见 `oh-gen-doc/实体系统.yaml` 物资·类型）在严谨性上不一致。

未发现名为 mock/temp/TODO 的临时桩代码。

## 3. 架构违规 (Architecture Violations)

- [指控]: 本模块在 `storageZonesFrom`、`listStorageGroups`、`findAvailableStorageCell`、`zoneResourcesAtCell` 等路径上对 `world.entities` 做线性全量扫描，未通过按坐标或区域建立的索引结构访问，与「空间索引层」支持高频读取的职责表述存在张力。
- [依据]: 见 `oh-code-design/地图系统.yaml` 分层中「空间索引层」职责：「按坐标索引实体、区域、蓝图、建筑」「支持高频读取」。当前实现功能正确性可接受，但放大调用次数时易成热点。

- [指控]: `resolveStorageGroupAtCell` 每次调用完整执行 `listStorageGroups(world)`（第 229 行），在频繁按格解析分组时重复计算连通分量与排序，加剧上述「无空间索引 + 全量扫描」的开销，与分层意图下的可扩展性不符。
- [依据]: 同上，`oh-code-design/地图系统.yaml` 空间索引层与空间模型层分工—查询应可增量或缓存，而非每次 O(全实体 + 全区格子图)。

本文件为纯函数式只读查询，未发现直接修改核心世界状态或 UI 越权写模型；与 `oh-code-design/实体系统.yaml` 读取投影层「为 UI、工作提供只读投影」的方向基本一致。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0120]: 全仓统一存储区材质字段：择一保留 `allowedMaterialKinds` 或 `acceptedMaterialKinds`，迁移数据与序列化后删除本文件与 `work-operations` 等处对旧字段的回退读取。
- [行动点 #0121]: 在策划文档中明确「正交相邻多存储区实体合并为同一 UI/逻辑分组时」的 `filterMode` 与允许种类语义（交/并、是否按格回退到单区规则），再据此收敛 `groupFilterMode` / `groupAllowedKinds` 的实现。
- [行动点 #0122]: 若需对齐空间索引层设计，为存储区格子与格上资源建立坐标映射（或复用占用/区域管理器已有索引），并让 `findAvailableStorageCell`、`resolveStorageGroupAtCell` 避免每次全表扫描与重复 `listStorageGroups`。
- [行动点 #0123]: 对 `materialKind` 缺失的物资在入口断言或记录诊断日志，避免静默使用 `"generic"`；或与实体原型校验合并，保证与设计枚举一致。