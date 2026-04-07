# 审计报告: src/headless/scenario-runner.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `claimConstructBlueprintAsPawnName` 在找不到同名小人或没有 `construct-blueprint` 开放工单项时**完全静默跳过**，既不报错也不写入报告，场景可能误以为已认领成功。
- [依据]: `oh-code-design/工作系统.yaml` 强调工作分配与认领的可追踪性；`oh-gen-doc/工作系统.yaml` 将建造与工作任务作为可验证流程。测试装载器应能暴露「场景配置与当前世界状态不一致」的配置错误，而非吞掉。

- [指控]: `expectationSatisfied` 中 `work-item-exists` 在**未提供** `workKind` / `status` 时，只要存在任意一条工单即判真，期望语义过宽，容易让粗心的场景 YAML/TS **误过验收**。
- [依据]: `oh-acceptance/` 各子系统 YAML 以明确 Given-When-Then 约束行为；可观测断言应贴近「指定种类/状态」而非「任意工单存在」的弱条件（与策划可验证性目标不一致）。

- [指控]: Headless 路径仅通过 `playerSelectionAfterHydrate` + `commitPlayerSelection` 与 `domainCommandsAfterHydrate` 注入玩家侧行为，**无法覆盖** `oh-gen-doc/交互系统.yaml` 中「选区工具拖拽会话」「蓝图笔刷路径」等完整输入链；若验收要求验证**交互模式层 / 选区会话管理器**，本文件单独无法兑现。
- [依据]: `oh-gen-doc/交互系统.yaml`「玩家输入」「交互模式」；`oh-code-design/交互系统.yaml`「分层」中输入采集层、选区会话管理器、笔刷会话管理器职责。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `hydrateScenario` 在存在 `def.worldPortConfig` 时调用 `sim.getWorldPort().applyMockConfig(...)`，名称与语义均为 **WorldPort 测试桩配置**（如 `alwaysAccept`、按格拒绝），属于显式 Mock/测试专用分支。
- [影响]: 场景与真实 `WorldPort` 校验路径可能长期分叉；若生产路径仍依赖同类「一律接受」逻辑，易形成双轨实现（与 code-audit 4.6 所述「Mock 未拆除」风险同型）。

- [指控]: `type === "custom"` 且 `params.immediatePass === true` 时**无条件通过**断言，属于测试逃生口；若被滥用会架空结构化期望与 `oh-acceptance` 类验收。
- [影响]: 削弱 headless 报告作为客观回归依据的价值。

- [指控]: `isSimEventKind` 与 `sim-event-log.ts` 中的 `SimEventKind` **重复罗列**字面量联合，后续若在事件侧增删种类，易出现「日志已发事件、期望判定永远 false」的维护债务（双源同步）。
- [影响]: 与「可测试、可重放」目标（见 `oh-code-design/行为系统.yaml` 目标中的可测试表述）相比，同步成本偏高。

## 3. 架构违规 (Architecture Violations)

- [指控]: `applyScenarioTime` 通过 `getSimAccess().getTimeControlState()` 取得对象后**就地改写** `paused` / `speed`，并对 `world.timeConfig`、`world.time` 直接赋值；属于绕过「暂停与调速」应经统一时钟入口的**旁路写状态**。
- [依据]: `oh-code-design/时间系统.yaml`「分层」中时间推进层、游戏时钟职责（接收增量、处理暂停/调速）；「关键流程」(暂停与调速) 要求经指令更新时钟状态，而非外部随意篡改返回引用。

- [指控]: 对 `getTimeControlState()` 的返回值使用 `as { paused: boolean; speed: 1 | 2 | 3 }` **窄化断言**，掩盖与真实 `TimeControlState` 类型漂移的风险，且与「时间模型层」单一事实来源的意图相悖。
- [依据]: 同上，`oh-code-design/时间系统.yaml`「核心数据」时间快照/时间配置应由时间子系统边界维护。

- [指控]: `hydrateScenario` 在 `src/headless` 内直接编排 `spawnWorldEntity`、`placeBlueprint`、`claimWorkItem` 与多次 `setWorld`，体量上接近**应用编排**职责，与 `oh-code-design/实体系统.yaml`「应用编排层」应由领域边界统一接收变更请求的表述相比，headless  runner 成为**隐形编排入口**，增加「谁有权改世界」的模糊地带。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0227]: 为 `claimConstructBlueprintAsPawnName` 增加**显式失败模式**（例如在严格模式下找不到 pawn/work 时 `throw` 或向 `SimReport` 写入 warning），避免静默假阴性。
- [行动点 #0228]: 收紧 `work-item-exists`：在未指定 `workKind` 时要求调用方显式传参，或默认匹配「无工单为失败」；至少文档化当前「任意工单即过」的语义并在场景侧约束。
- [行动点 #0229]: 将时间初始化改为调用 **HeadlessSim / 时间子系统对外 API**（若缺失则新增薄封装），避免直接改 `getTimeControlState()` 返回体与 `world.time` 字段；去除不必要的类型断言。
- [行动点 #0230]: 将 `isSimEventKind` 与 `SimEventKind` **单源化**（例如从 `sim-event-log` 导入类型并复用守卫，或生成共享常量表），避免双处维护。
- [行动点 #0231]: 审计 `applyMockConfig` 的使用面：区分「仅 headless 场景」与「可能被主游戏误用」的路径；长期目标是将 `alwaysAccept` 等能力收敛为**可注入的策略接口**而非 Mock 命名 API，或限制为测试包可见。