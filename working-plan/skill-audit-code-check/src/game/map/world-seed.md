# 审计报告: src/game/map/world-seed.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `spawnWorldEntity` 在 `outcome` 为 `out-of-bounds` 或 `conflict` 时，本函数不更新 `w` 且无任何反馈；若同一格已有占用者或坐标越界，表现层 `blockedKeys` 与 `WorldCore` 内障碍实体可能不一致，占用语义弱于「阻挡对象已落库」的预期。
- [依据]: `oh-code-design/地图系统.yaml` 中占用管理器职责（记录实体占用、建筑阻挡）及风险条目（实体位置与占用索引若不同步易出现异常占用/通行判断偏差）。

- [指控]: `parseCoordKey` 返回空时直接 `continue`，非法 key 被静默丢弃，与同一文档中空间规则层、选区解析器「校验/过滤」的严谨取向不完全一致（实现上选择了容错而非显式校验）。
- [依据]: `oh-code-design/地图系统.yaml` 空间规则层（通行与占用冲突判断）、选区解析器（过滤超界格与不可用格）的职责描述。

- [补充说明]: `oh-code-design/地图系统.yaml` 的「初始地图快照」关键字段仅列小人、物资、树木分布，未单列「地形阻挡格实体化」；当前实现用 `kind: "obstacle"` + `label: "stone"` 补齐与 `WorldGridConfig.blockedCellKeys` 的同步，**不构成**对上述条文的直接「未实现」，但策划文档若需验收该路径，宜在后续文档中显式收敛。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 未发现明显问题（无 mock/temp/TODO，逻辑单一）。

## 3. 架构违规 (Architecture Violations)

- [指控]: `src/game/map/world-seed.ts` 位于地图相关目录，却直接调用 `../world-core` 的 `spawnWorldEntity` 创建实体；而 `oh-code-design/地图系统.yaml` 接口边界将「来自实体系统的实体创建、删除、移动事件」列为地图侧**输入**。初始化阶段由地图种子反向驱动实体创建，属于项目已采用的编排方式（如 `world-bootstrap` / `GameScene` 调用），但在分层叙述上易造成「地图网格模块」与「实体生命周期入口」职责边界模糊；若设计将「仅编排层可发起创建」为硬约束，则理想归属是编排/bootstrap 专用模块而非纯几何/占用子模块。
- [依据]: `oh-code-design/地图系统.yaml` 接口边界（输入来自实体系统）；对照 `oh-code-design/实体系统.yaml` 应用编排层（协调多实体联动更新）的职责划分。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0132]: 对 `spawned.outcome.kind !== "created"` 的分支在开发/测试构建中记录告警或断言，避免「有 blocked key 却无对应障碍实体」长期静默存在。
- [行动点 #0133]: 对重复 key 或 `parseCoordKey` 失败，明确策略（去重、校验失败即失败）并写入模块注释或策划补充说明，与 `spawnWorldEntity` 的幂等/冲突语义对齐。
- [行动点 #0134]: 若团队采纳严格分层，可将「播种障碍实体」迁出 `map/` 仅保留坐标解析，由 `world-bootstrap` 或专用 `world-seed` 编排模块持有对 `spawnWorldEntity` 的依赖，使 `map/` 更贴近 `oh-code-design` 中地图子系统的输入输出描述。