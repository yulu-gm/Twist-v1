# 审计报告: src/player/scenario-loader.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `ScenarioDefinition` 中的 `zones`、`resources` 在 `loadScenarioIntoGame` 中完全未处理；无头路径 `hydrateScenario`（`src/headless/scenario-runner.ts`）已对二者执行生成与校验。若在浏览器/实机通过 `loadScenarioIntoGame` 热载同一份场景 YAML/TS，存储区与地面资源不会出现，行为与单测分叉。
- [依据]: 类型契约见 `src/headless/scenario-types.ts` 中 `ScenarioDefinition` 的 `zones` / `resources` 字段；策划侧区域语义见 `oh-gen-doc/地图系统.yaml`「区域系统」与 `oh-code-design/地图系统.yaml`「区域管理器」职责（创建与维护存储区等）。

- [指控]: `timeConfig` 仅当 `startMinuteOfDay` 有值时才生效，且 `applyScenarioTime`（约 39–46 行）未写入 `paused` / `speed`；无头侧 `applyScenarioTime`（`scenario-runner.ts` 约 90–112 行）会同步 `timeConfig.paused` 与 `timeConfig.speed`。同一 `ScenarioDefinition` 在双端时间控制语义不一致。
- [依据]: `oh-code-design/时间系统.yaml`「核心数据」中「时间快照」含是否暂停、速度档位；`ScenarioDefinition["timeConfig"]` 在 `scenario-types.ts` 中声明了上述可选字段。

- [指控]: `playerSelectionAfterHydrate` 多条记录时，每次调用 `commitPlayerSelectionToWorld` 都传入 `currentMarkers: new Map()`（约 190 行）；无头侧在同循环内使用 `outcome.nextMarkers` 串联。依赖「前一步标记影响后一步」的场景在实机载入时会与 headless 行为不一致。
- [依据]: `oh-code-design/交互系统.yaml`「反馈状态仓」职责包含保存当前模式提示与高亮等反馈状态；多步选区/标记链路与该状态应一致（与 `hydrateScenario` 实现对照）。

- [说明]: 文件注释已声明忽略 `expectations`、`def.seed` 不写入 `WorldCore`（约 86、94 行）；`expectations` 由无头 `runAllExpectations` 等路径承担，属明确边界，不记为未声明的漏做。`tickScheduleAfterHydrate`、`worldPortConfig`、`uiObservation` 主要为无头/模拟端口能力，是否必须在实机载入器中实现，当前 `oh-code-design` 未单列「场景载入器」条款，故仅作风险备注：若未来要求「一份场景定义双端完全同构」，需补规格或对字段分层标注「仅 headless」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：未见 `mock`/`TODO` 占位分支；`PAWN_FILL_PALETTE` 为展示用调色板常量，属合理默认值而非临时桩。`removeWorldEntitiesOccupyingCells` 与网格一致性校验是有意为之的实机/热载策略，与无头路径差异来自产品需求而非死代码。

## 3. 架构违规 (Architecture Violations)

- [指控]: `listAvailableScenarios` 直接依赖仓库根目录 `../../scenarios` 的 `ALL_SCENARIOS`（约 27、220–221 行），使 `src/player` 与静态场景注册表硬耦合；`oh-code-design` 未定义「场景目录」归属，但从分层上更接近内容/数据注册，长期会阻碍按包拆分或按需加载场景。
- [依据]: 对比 `oh-code-design/交互系统.yaml` 分层（输入采集 → 交互模式 → 交互意图）；场景列表更像入口/内容供给，不宜与「写入 WorldCore 的载入器」绑在同一依赖扇出上。

- [轻微]: 同上，`playerSelectionAfterHydrate` 与实机「已有标记叠加」路径不一致（恒空 `currentMarkers`），属于载入特例但未在设计文档中显式备案，易造成「以为与无头一致」的误判。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0278]: 在 `loadScenarioIntoGame` 中补齐 `zones` / `resources` 生成逻辑，与 `hydrateScenario` 对齐（含越界校验、资源 `materialKind` 解析、区域 `validateZoneCells` 等），或抽取共享「场景实体落格」模块供双端调用，避免双实现漂移。
- [行动点 #0279]: 扩展 `applyScenarioTime`，在 `WorldCore` 可表达的前提下应用 `timeConfig.paused` / `timeConfig.speed`（或与 `GameScene` 侧时间 UI 控制器对接），与 `oh-code-design/时间系统.yaml` 中游戏时钟字段一致。
- [行动点 #0280]: 将 `playerSelectionAfterHydrate` 循环改为在无头同款的 `currentMarkers` 累传模式，保证多步选区与标记命令链一致。
- [行动点 #0281]: 将 `ALL_SCENARIOS` 改为由上层（如场景/bootstrap 或 DI）注入只读列表，或迁到明确的内容层，`scenario-loader` 仅保留 `loadScenarioIntoGame` 与类型依赖。