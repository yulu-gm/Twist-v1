# 审计报告: src/game/world-core-types.ts

## 1. 漏做需求

- **[说明]**：本文件仅导出类型别名与组合类型，不包含可执行逻辑；以下对照 `oh-code-design/` 与 `oh-gen-doc/` 中**对世界状态应携带哪些信息**的叙述，评估类型表面是否覆盖策划语义。

- **[总体]**：`WorldCore` 聚合了 `oh-code-design/地图系统.yaml` 中的地图网格配置（`grid`）、占用管理器类型（`occupancy`），`oh-code-design/时间系统.yaml` 中的时间快照与时间配置（`time` / `timeConfig`），`oh-code-design/实体系统.yaml` 语境下的实体集合（`entities`），`oh-code-design/工作系统.yaml` 语境下的工作单元（`workItems`），以及床位/休息点投影（`restSpots`，与实体系统中木床、行为休息目标等叙事衔接）。`WorldSnapshot` 提供面向序列化或只读视图的平行形态（实体列表、`occupancy` 的 `Record` 形式等），与「可序列化、可追踪」方向一致，**未发现策划已明确规定、而本文件完全未建模的核心世界字段**。

- **[粒度差异 / 潜在对齐点]**：`oh-code-design/地图系统.yaml` 在「地图格」核心数据中使用「占用对象集合」表述；本文件中 `WorldCore.occupancy` 引用 `OccupancyMap`（`Map<格键, 单一实体 id>`），`WorldSnapshot.occupancy` 为 `Readonly<Record<string, string>>`，与同目录 `map/occupancy-manager.ts` 中「一格对应单一占用人 id」的实现注释一致。若产品将来要求**在同一格并列索引多个占用对象**（且不仅通过 `entities` 反查），则类型层需扩展，当前属于**文档抽象与实现类型的粒度折中**，不宜单独判为本文件「已实现逻辑漏做」，但建议在架构说明中写清「占用表权威语义」以免与「集合」字面长期歧义。

- **[MarkerSnapshot]**：`kind` 仅为字面量 `"deconstruct-obstacle"`。`oh-gen-doc/工作系统.yaml` 正文列举的正式工作类型为拾取、搬运、伐木、建造四类，未单独列出「拆除障碍」；伐木/可拾取等信号在策划侧多落在**实体属性**（与 `EntityDraft` 中 `loggingMarked`、`pickupAllowed` 等字段方向一致），而非统一塞进地图标记联合类型。故该窄联合类型与**现有文档 + 代码双轨建模**相容，**不构成本文件对已定稿 YAML 条款的遗漏**；若策划将「拆除障碍」纳入正式工作类型表，应在 `oh-gen-doc` / `oh-code-design` 补条目后，再视需要扩展 `MarkerSnapshot` 或保持工单侧单一真源。

## 2. 无用兼容与 Mock

- 未发现 `mock`、`temp`、`TODO`、废弃分支或仅为兼容旧管线而存在的类型别名；本文件为纯 `import type` 与 `export type`，无运行时代码路径可残留「孤岛」兼容逻辑。

- **未发现明显问题**。

## 3. 架构违规

- 分层上仅依赖 `./entity/entity-types`、`./map/*`、`./time/*`、`./work/work-types` 等领域类型，**未**引用 UI、场景或 Phaser 层，符合 `oh-code-design/实体系统.yaml` 中领域模型层「提供与实现无关的实体快照结构」及多子系统通过统一世界视图协作的方向，**不构成**「UI 越权写核心数据」或跨层面条依赖。

- `WorldSnapshot` 与 `WorldCore` 对同一语义使用不同容器形态（如实体 `readonly[]` vs `Map`、`occupancy` 的 `Record` vs `OccupancyMap`）属于**运行时索引与可序列化快照的常见分工**，未在已读设计文档中看到禁止此类双表示的条款；若团队追求「单一结构贯穿」，属风格/文档化议题，**当前不认定为设计宪法层面的违规**。

- **未发现明显问题**。

## 4. 修复建议

- **[文档]**：在 `oh-code-design/地图系统.yaml` 或世界核配套说明中，用一两句明确「占用表为格键到**主占用人** id 的映射、多实体共格时以实体列表与规则层为准」，与当前类型定义对齐，消除「占用对象集合」字面与单值映射的歧义。

- **[演进]**：当策划将 `deconstruct-obstacle` 等扩展工单正式写入 `oh-gen-doc/工作系统.yaml` 时，同步检查 `MarkerSnapshot`、`WorkItemSnapshot`（`work-types.ts`）的联合类型是否一致，避免字符串契约漂移。

- **[维护]**：`EntityDraft` 字段较多且与 `entity-types` 强耦合；新增实体能力时优先在 `entity-types` 扩展再映射到本文件的 draft 形状，避免两处长期分叉。

- 本任务为只读审计：**不要求**也不应对 `src/game/world-core-types.ts` 做任何修改即可完成上述对齐（除团队主动采纳的文档与类型演进外）。
