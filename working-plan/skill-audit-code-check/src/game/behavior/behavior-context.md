# 审计报告: src/game/behavior/behavior-context.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `aggregateBehaviorContext` 将 `behaviorState` 固定为 `"idle"`，未汇总小人真实的当前行为主状态。
- [依据]: `oh-code-design/行为系统.yaml` 中模块「行为上下文汇总器」职责写明需「读取小人自身状态、需求状态、工作候选、地图信息」并形成决策快照；核心数据「行为快照」含「当前主状态」。本文件提供的上下文在聚合路径上未反映状态机/实体上的真实状态，与「自身状态」汇总要求不一致。

- [指控]: 决策输入仅包含时间的标量切片（`currentPeriod`、`minuteOfDay`），未体现设计中的「时间事件」或时段边界语义（例如夜晚事件后再评估休息）。
- [依据]: 同文件「分层 / 决策输入层」要求汇总「时间事件」；`oh-code-design/行为系统.yaml`「接口边界 / 输入」列出「来自时间系统的时段事件」。当前类型与聚合结果更接近静态快照，未承载事件形态，若上层未另通道注入，则相对设计不完整。

- [指控]: `candidateWorks` 仅通过 `getByStatus(workRegistry, "open")` 拉取，未覆盖「已由当前小人领取、执行中」的工单，与策划上「在工作与需求之间协调」所需的完整候选语境可能不足。
- [依据]: `oh-code-design/工作系统.yaml`「工作调度层」职责包含「为小人提供候选工作列表」「管理领取、锁定」；行为侧若只看见 `open`，已认领工单的评分与打断场景需由调用方另构上下文（例如 `need-interrupt-flow.ts` 中单独构造 `scoringContext`），本汇总器未统一承担该职责。

- [指控]: 当 `mapQuery` 为格点谓词时，`resolveMapSnapshot` 将 `foodReachable`/`bedReachable`/`reachableCellCount` 置为保守默认值（不可达、计数 0），而 `action-scorer` 仅依据 `context.map` 判断吃/休紧急分，未使用 `mapCellQuery`。
- [依据]: `oh-code-design/行为系统.yaml`「接口边界 / 输入」要求「来自地图系统的可达位置与邻接关系」。在本文件内谓词形态下，摘要字段与评分消费路径脱节，易导致需求类行动分数被系统性压低，除非所有调用方保证传入已是对象形态的 `BehaviorMapSnapshot`。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `MapBehaviorQuery` 联合类型包含仅含 `foodReachable`/`bedReachable` 的旧形态（无 `reachableCellCount`），由 `resolveMapSnapshot` 补零，属于对旧调用约定的兼容分支。
- [影响]: 扩大 API 表面，调用方若长期依赖窄对象，与完整 `BehaviorMapSnapshot` 语义并存，增加「同一概念多种形状」的维护成本。

- [指控]: `behaviorState` 在 `BehaviorContext` 上为可选字段，但 `aggregateBehaviorContext` 始终写入字面量 `"idle"`；与真实状态分离，易让阅读者误以为上下文已含状态机真相。
- [影响]: 类型 Optional 与实际聚合常量组合，形成半占位 API；未发现 `mock`/`temp`/`TODO` 等典型临时标记，本项主要为兼容与占位形态问题。

## 3. 架构违规 (Architecture Violations)

- [指控]: 「行为上下文汇总器」在代码中由 `aggregateBehaviorContext` 承担时，将「小人自身状态」中的行为主状态写死为 `idle`，而非从行为状态机或实体视图读取，属于职责履行不完整，贴近「汇总层伪造输入」而非只读汇总。
- [依据]: `oh-code-design/行为系统.yaml` 模块「行为上下文汇总器」职责与「行为快照」字段定义；本文件未越权调用 UI 或直接修改领域实体，分层依赖（`work-registry`、`world-time` 类型）方向合理，主要问题在汇总语义与设计不一致，而非跨层乱调。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0031]: 为 `aggregateBehaviorContext` 增加参数（或注入接口），从当前 `BehaviorFSM`/实体视图传入真实 `BehaviorState`，删除硬编码 `"idle"`，使上下文与 `oh-code-design` 中「行为快照」的主状态一致。
- [行动点 #0032]: 明确 `MapBehaviorQuery` 为函数时的契约：要么在汇总阶段基于谓词计算 `foodReachable`/`bedReachable`/`reachableCellCount`，要么在 `oh-code-design` 与 `action-scorer` 侧约定评分必须结合 `mapCellQuery`，避免摘要与谓词双轨却只消费摘要。
- [行动点 #0033]: 按 `oh-code-design/工作系统.yaml` 调度语义，将「开放工单 + 当前小人已认领工单」等工作候选策略收敛到汇总器或文档化的单一工厂函数中，减少各 flow 手工拼装 `BehaviorContext` 的分裂。
- [行动点 #0034]: 若需保留窄对象兼容，可在类型上标记 deprecated 或集中适配层，逐步收敛为单一的 `BehaviorMapSnapshot` 构造入口，降低 `MapBehaviorQuery` 三种形态带来的分支风险。

---

## 行动点落地记录

### AP-0032（已核对 · 已修复）

- **实现**：在 `action-scorer.ts` 中增加 `needSiteReachable`：`context.map.foodReachable` / `bedReachable` 为真，或存在 `context.mapCellQuery`（`mapQuery` 为谓词时由 `aggregateBehaviorContext` 注入）时，吃/休紧急分方可非零；避免仅消费摘要且谓词形态下需求分被系统性压低。
- **用例**：`tests/domain/action-scorer.test.ts` 中「mapQuery 为格点谓词时…」覆盖该路径。

### AP-0034（已核对 · 已修复）

- **实现**：导出 `buildBehaviorMapSnapshot`（集中构造 `BehaviorMapSnapshot`，含可选 `reachableCellCount` / `foodTargetId` / `bedTargetId`）；将松散对象形态命名为 `MapBehaviorQueryObject`；两字段历史形态命名为 `LegacyNarrowMapBehaviorQuery` 并标注 `@deprecated`；`MapBehaviorQuery` 补充 JSDoc 说明推荐形态与谓词契约。
- **导出**：`src/game/behavior/index.ts` 同步导出上述符号。