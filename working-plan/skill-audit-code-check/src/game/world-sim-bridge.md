# 审计报告: src/game/world-sim-bridge.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 当 `grid.blockedCellKeys` 为假值（例如未初始化）或非 `Set` 实例时，`syncWorldGridForSimulation` 不会创建或回填障碍集合，`blockedChanged` 保持为 `false`，世界中的障碍/墙/树/蓝图占格无法反映到模拟用网格。
- [依据]: `oh-code-design/地图系统.yaml` 中「地图网格」职责包含维护地图格基础属性与可通行相关语义；「移动查询」流程要求「地图网格与占用管理器联合返回可达候选」。若调用方未按 headless/场景约定预先提供可变 `Set`，则该流程在数据面上未闭环。

- [指控]: `simulationImpassableCellKeys` 将 `blueprint` 占格一律视为不可走；与策划文档对蓝图阶段「无碰撞体积」的主述存在张力，若最终定稿为蓝图不阻挡通行，则当前实现与已定需求相反。
- [依据]: `oh-gen-doc/建筑系统.yaml`「建造流程 / 蓝图阶段 / 特性」写明「蓝图本身没有碰撞体积（待确认风险：是否阻挡通行）」；`oh-code-design/地图系统.yaml`「待确认问题」亦列出「蓝图阶段是否占用地图格通行」。设计层尚未关闭该决策时，代码已固定为「阻挡」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `templateBedPrototype` 与 `templateFoodPrototype` 在模板中找不到对应 `kind` 时，返回固定 `id`、格心 `(0,0)` 及硬编码 `useDurationSec`、`needDelta` 的兜底对象。
- [影响]: 易掩盖关卡或 `interactionTemplate` 配置缺失，使寻路/需求 AI 在地图原点出现幽灵交互目标；属于隐性 Mock 式兜底而非显式失败或数据校验。

- [指控]: `syncWorldGridForSimulation` 通过 `prev?.interactionPointIds` 序列比较判断交互点是否变化，依赖「同序同 id」的稳定生成；若未来遍历顺序或 id 策略变化，可能产生不必要的全量更新或反之漏检（当前实现下为合理优化，但属于脆弱契约）。
- [影响]: 非典型 mock，但属于与「集合语义」相比更偏实现细节的兼容/节流假设，扩展实体类型时需同步维护生成顺序约定。

## 3. 架构违规 (Architecture Violations)

- [指控]: `WorldGridConfig` 在 `world-grid.ts` 中带 `Readonly<>` 包装，本文件却通过类型断言 `(grid as WorldGridConfig & { interactionPoints: InteractionPoint[] })` 就地改写 `interactionPoints`，并对 `blockedCellKeys` 执行 `clear`/`add` 变异。
- [依据]: 与 `oh-code-design/地图系统.yaml` 中「空间模型层 / 空间索引层」通过清晰结构维护网格状态的意图不一致；类型上宣称只读、运行时可变，削弱「地图网格作为共享空间基础」的边界可推理性。

- [指控]: 障碍格与交互点列表的推导集中在 `world-sim-bridge`，而非收敛到设计中的「占用管理器」或独立地图子模块对外暴露的只读查询后再由单一入口写回网格。
- [依据]: `oh-code-design/地图系统.yaml`「占用管理器」职责写明「记录每个格上的实体占用、建筑阻挡、临时保留」；本文件将多类实体规则硬编码在 game 桥接层，地图子系统分层在代码结构上未充分体现。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0206]: 在 `syncWorldGridForSimulation` 内或网格初始化路径中，当 `blockedCellKeys` 缺失时创建新的 `Set` 并挂回配置（或把 `blockedCellKeys` 改为必填可变 `Set` 并在类型上表达），避免静默跳过同步；与 `src/headless/headless-sim.ts` 已有注释约定对齐为单一事实来源。
- [行动点 #0207]: 与策划确认蓝图是否阻挡通行后，将结论写入 `oh-gen-doc`/`oh-code-design` 并据此统一 `blueprint` 分支；若最终为不阻挡，应从 `simulationImpassableCellKeys` 移除蓝图占格或改为仅影响建造邻接逻辑。
- [行动点 #0208]: 去除或收紧 `(0,0)` 模板兜底：模板缺床/缺食物时在开发期断言失败、日志告警或从关卡 schema 强制校验，避免静默生成无效 `InteractionPoint`。
- [行动点 #0209]: 将 `WorldGridConfig` 拆分为「只读布局快照」与「模拟可变覆写（blocked、interaction 派生）」的显式类型，或把同步逻辑迁入地图/占用模块并对外暴露 `syncFromWorldCore`，减少 game 层对网格结构的断言写入。