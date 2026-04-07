# 审计报告: src/scenes/renderers/zone-overlay-renderer.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-gen-doc/UI系统.yaml`「地图界面」要求展示「存储区边界」等；本文件对全部 `kind==="zone"` 使用同一套半透明填充与描边（106–131 行），未按 `oh-code-design/UI系统.yaml`「地图叠加反馈层」中隐含的「反馈类型 / 显示样式」区分区域类别。若日后存在非存储类 zone，可能与「仅强调存储区边界可读性」的策划表述不一致，需产品确认是否要为不同 `zoneKind` 分色或分层。
- [指控]: `oh-code-design/地图系统.yaml` 待确认问题「存储区是否允许非连续格集合」与 `oh-gen-doc/地图系统.yaml`「连续或非连续」并存；本文件通过 `listStorageGroupLabels` + 本地连通分量呈现标签，非连续场景下依赖 `game/map/storage-zones` 的组定义。领域层已覆盖该语义时，呈现层无额外漏项；若策划对「每组标签锚点」有单独规则，需在文档中写清后对照实现。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（无 mock/temp/TODO 式残留）。

## 3. 架构违规 (Architecture Violations)

- [指控]: 本文件在 `collectStorageZoneLabelGroups` 内重复实现「存储格正交连通分量」与 `groupKey` 拼接（28–65 行、21–26 行、83–91 行），与 `oh-code-design/UI系统.yaml`「以读模型驱动展示，避免 UI 直接承担领域规则」的精神相比，属于**在呈现层二次推导领域已给出的分组**，易造成与 `src/game/map/storage-zones.ts` 中 `listStorageGroups` 行为漂移。
- [指控]: `storage-zones` 中 `groupKey` 为**按行列排序后的** `coordKey` 用 `|` 拼接（`sortCells` 后 `cells.map(coordKey).join("|")`，见该文件约 202–212 行）；本文件 `groupKey` 为对 `coordKey` **字符串做 `localeCompare` 排序**后再拼接（21–26 行）。当同一连通组内同时存在 `(col,9)` 与 `(col,10)` 等情形时，字符串序会把 `"0,10"` 排在 `"0,9"` 之前，与行优先几何序不一致，导致 `cellsByGroupKey.get(label.groupKey)` 失配并触发 `?? [anchor]` 静默回退（87–91 行）。这与领域层标签的 `groupKey` **不一致**，属于反馈与真实分组状态脱节的架构风险（亦违反 `oh-code-design/UI系统.yaml` 接口边界所述「若 UI 直接决定领域可行性，会造成反馈与真实规则不一致」的警示语境——此处为**展示侧与领域键不一致**）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0349]: 删除或收敛本地 `collectConnectedGroups` / `groupKey` 实现，改为直接使用 `listStorageGroups`（或从 `storage-zones` 导出与领域完全一致的 `groupKey` 构造方式），用 `label.groupKey` 映射到官方 `cells` 列表，避免双实现。
- [行动点 #0350]: 在过渡期内若保留映射表，应对 `get` 未命中做开发期断言或日志，而不是仅回退单格锚点，便于发现上述键不一致。
- [行动点 #0351]: 若产品确认仅存储区需要叠加，可将绘制循环限定为 `zoneKind==="storage"`，其余 zone 类型走独立样式或暂不绘制，与「存储区边界」文案对齐。