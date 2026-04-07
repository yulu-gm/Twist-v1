# 审计报告: src/game/behavior/wander-planning.ts

## 1. 漏做需求 (Missing Requirements)

- **[结论]** 与 `oh-gen-doc/行为系统.yaml` 中「漫无目的散步」的显性条文对照：本文件通过 `legalWanderNeighbors`（正交邻格 + `isWalkableCell`）与 `pickWanderTarget`（均匀随机选一格、无候选则 `wait`）实现了「随机选择相邻地图格移动」与「散步范围可在地图可行走区域内」的描述，**未发现**与上述策划条文直接冲突的缺失实现。
- **[说明]** 「移动频率: 待配置」属于仿真节拍与上层状态机职责，不在本纯规划函数文件范围内，**不记为本文件漏做**。
- **[潜在缺口（依赖全局架构取舍）]** `oh-code-design/地图系统.yaml` 关键流程「移动查询」写明：地图网格与**占用管理器联合**返回可达候选。本模块的 `legalWanderNeighbors` 接收 `logicalCellsByPawnId` 却未参与过滤，仅从地形可走性筛选；若产品最终认定「游荡选格也必须与占用管理器一致」，则占用逻辑应在**本函数或统一地图查询 API** 中落地。当前 `tests/domain/wander-planning.test.ts` 中「keeps occupied neighbor cells legal for wandering」将**不排除他小人所在邻格**固化为预期，与严格按「占用联合」排除冲突格存在张力，需产品/策划与地图子系统边界一并裁定，**不宜单独记为本文件相对 oh-gen-doc 的硬漏做**。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现 `mock`、`temp`、`// TODO` 或明显死分支、废弃入口专用兼容代码。
- **[接口债务]** `_logicalCellsByPawnId` 形参未被函数体使用，与 `goal-driven-planning.ts` 传入的 `logicalCellsByPawnId` 形成「签名暗示会考虑多小人占用、实现未消费」的落差，易误导阅读者；更接近未完成的 API 面或历史预留，而非典型 Mock。
- **[代码冗余]** `legalWanderNeighbors` 内 `filter` 回调在 `isWalkableCell` 为真时仅 `return true`，可合并为单行返回表达式；属可读性/简洁性问题，**不归类为无用兼容**。

## 3. 架构违规 (Architecture Violations)

- **[分层一致性（轻微）]** 本文件仅依赖 `../map/world-grid` 与 `PawnState` 类型，不触碰 UI、不写全局可变状态，符合 `oh-code-design/行为系统.yaml` 中「保持行为选择可解释、可重放、可测试」的方向；`WanderRng` 可注入亦支持可重放测试。
- **[与地图子系统叙述的张力]** 同上节：`oh-code-design/地图系统.yaml`「移动查询」强调行为侧邻接候选应由**网格与占用管理器联合**产出，而本函数在行为包内直接用网格可走性完成邻格过滤，且忽略已传入的占用映射。若架构上占用必须由「占用管理器」单一事实源提供，则当前实现属于**职责下沉不完整**；若架构上允许「地形可走性」在行为子模块内查询、占用由执行/仿真层另判，则需在体系文档中显式分工以消除歧义。**未发现**「表现层改写核心数据」类越权。

## 4. 修复建议 (Refactor Suggestions)

- **[行动点 #0051]** 与策划、地图子系统设计对齐后，择一：**(a)** 在 `legalWanderNeighbors` 内根据 `logicalCellsByPawnId`（或未来占用管理器接口）过滤不可踏入的邻格，并同步修订测试与调用约定；或 **(b)** 从签名中移除该参数，改为由上层或地图模块提供已合并占用后的候选列表，避免虚假参数。
- **[行动点 #0052]** 若保留「允许走向已被他小人占据的邻格」为刻意规则，建议在函数注释或 `oh-gen-doc`/`oh-code-design` 接口边界中**写明**与「占用管理器联合查询」的差异及理由，减少审计与后续开发者误判。
- **[行动点 #0053]** 简化 `legalWanderNeighbors` 的 `filter` 为直接返回 `isWalkableCell(grid, cell)`，减少无分支冗余。
- **[行动点 #0054]** 若项目统一由 `chooseWanderPath`（`goal-driven-planning.ts`）承担主循环闲逛而本模块仅服务「一步邻格」场景，可在模块头注释中说明与长路径游荡策略的关系，便于与 `oh-gen-doc`「相邻移动」条文及另一文件的实现策略对照（该文件差异已在同目录 `goal-driven-planning.md` 中讨论）。
