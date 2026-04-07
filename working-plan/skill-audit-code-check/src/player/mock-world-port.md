# 审计报告: src/player/mock-world-port.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `submit` 仅追加命令日志与合成 `MockWorldSubmitResult`，不调用 `applyDomainCommandToWorldCore` 或任何地图/实体/建筑子系统，无法验证命令在真实世界中的可接受性、副作用与时间戳语义是否与策划一致。
- [依据]: 见 `oh-code-design/交互系统.yaml` 中模块「交互意图层」职责「把输入结果转为领域命令」「在提交前执行基础校验与过滤」，以及「接口边界」输出侧「向地图系统提交选区创建请求」「向实体系统提交标记请求」「向建筑系统提交蓝图放置请求」。本文件为线间 Mock，上述端到端行为**有意省略**，但若验收场景误以为「接受即等价于领域已更新」，会产生漏测。

- [指控]: `filterTaskMarkerTargetCells` 对入参格集合原样返回，与真实网关在 `commitPlayerSelectionToWorld` 内对 `OrchestratorWorldBridge` 分支使用的 `filterCellKeysForToolbarTaskMarkers` 行为不一致；纯 Mock 路径无法在自动化中覆盖「按领域可接单格过滤」后的标记结果。
- [依据]: 见同仓库 `src/player/world-port-types.ts` 对 `filterTaskMarkerTargetCells` 的注释（Mock 整包返回、WorldCore 按领域过滤）；对齐 `oh-code-design/交互系统.yaml`「交互意图层」中提交前校验与过滤的职责表述。

- [指控]: `mergeTaskMarkerOverlayWithWorld` 对叠加层做恒等拷贝，不与世界快照对齐，无法发现「标记层与实体/工单状态不一致」类缺陷。
- [依据]: 同上 `world-port-types.ts` 注释（Mock 恒等、A 线实现读 WorldCore）；`oh-gen-doc/交互系统.yaml` 中各模式「结果」均指向世界侧真实状态变化，Mock 侧无对应快照校验链。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [说明]: 本文件**整文件**即为注释所声明的「线间 mock 网关」，仓库内仅 `tests/domain/mock-world-port.test.ts` 实例化 `MockWorldPort`，主流程通过 `WorldCoreWorldPort` 接入，不属于「第二批接入后未删除的死 Mock」类技术债。

- [指控]: `getSubmitResults()` 为公开方法但**未**列入 `PlayerWorldPort` 接口（`world-port-types.ts`），测试与调用方若依赖具体类型而非接口，会削弱端口抽象的一致性。
- [影响]: 长期可能形成对 `MockWorldPort` / `WorldCoreWorldPort` 具体类的隐式依赖，与「仅通过 `PlayerWorldPort` 编程」的边界意图不完全一致。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本类实现 `PlayerWorldPort`，不直接操作 Phaser/UI，不绕过 orchestrator 写入 `WorldCore`；Mock 与真实实现通过同一接口注入，符合 `GameOrchestrator` 对 `worldPort: OrchestratorWorldBridge` 的编排方式（运行时实际为 `WorldCoreWorldPort`），未出现设计文档所警示的「UI 层直接修改核心数据」类越权。

- [补充]: `PlayerWorldPort` 上挂载 `applyMockConfig`、`resetSession`、`replayAll` 等**验收/回放控制面**，与 `oh-code-design/交互系统.yaml` 中按层的「交互意图层 / 反馈协调层」划分并非一一对应，属于工程上的测试友好 API 外溢至生产接口面；若严格按「领域端口仅暴露领域操作」解读，存在轻微概念混杂，但不构成对 `oh-code-design` 已写明模块边界的直接违反。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0268]: 在 `oh-code-design` 或 `oh-gen-doc` 中增加简短「B 线 / Mock 世界网关」条目，显式列出与 A 线 `WorldCoreWorldPort` 的能力差距清单（无领域应用、恒等 merge、不过滤任务格等），避免策划或验收将 Mock 接受结果误读为完整领域语义。
- [行动点 #0269]: 若需要 Mock 更接近真实交互意图层行为，可为 `MockWorldPort` 构造注入可选的 `filterTaskMarkerTargetCells` / `mergeTaskMarkerOverlayWithWorld` 委托（默认保持恒等），使 headless 测试能复用与 `WorldCore` 相同的过滤规则而不启动完整模拟。
- [行动点 #0270]: 将 `getSubmitResults` 纳入 `PlayerWorldPort`（或拆出 `PlayerWorldPortForTesting` 扩展接口），消除具体类专有 API 与统一端口类型之间的不一致。
- [行动点 #0271]: 保持主游戏路径持续使用 `WorldCoreWorldPort`（或等价真实网关），不在可玩构建中以 `MockWorldPort` 作为唯一 `worldPort` 注入；若新增入口，在代码评审中对照 `oh-code-design/交互系统.yaml` 输出边界做检查。

## 5. 行动点落地记录（Worker 核对）

- **AP-0270（已核对，契约已满足）**：`getSubmitResults()` 已列于 `PlayerWorldCommandPort`；`PlayerWorldPort extends PlayerWorldCommandPort`，故完整端口类型已包含该方法，与审计建议的「拆出扩展接口」一致。`MockWorldPort` / `WorldCoreWorldPort` 实现 `PlayerWorldPort` 时不再存在「仅具体类可见」的专有 API。
- **AP-0271（已核对）**：`main.ts` → `GameScene` → `new WorldCoreWorldPort(worldCore)` 仍为可玩路径；`bootstrapWorldForScene` 仅返回 `worldCore`，未注入 `MockWorldPort`。在 `mock-world-port.ts` 模块注释中补充装配约束与 `oh-code-design/交互系统.yaml` 引用，便于评审时对照。