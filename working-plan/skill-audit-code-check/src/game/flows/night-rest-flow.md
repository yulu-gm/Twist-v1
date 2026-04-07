# 审计报告: src/game/flows/night-rest-flow.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `setupNightRestFlow` / `applyNightRestTimeEvent` 在 `src/` 生产代码中无任何引用（仅本文件定义与 `tests/domain/night-rest-flow.test.ts` 使用），主循环未订阅时间总线以驱动夜间归宿，行为系统实际上收不到本模块实现的昼夜切换响应。
- [依据]: `oh-code-design/时间系统.yaml`「接口边界·输出」提供给行为系统的昼夜切换事件；`oh-code-design/行为系统.yaml`「接口边界·输入」来自时间系统的时段事件；`oh-gen-doc/时间系统.yaml`「时间与行为的关联·小人状态变化」夜晚睡觉。

- [指控]: `handleNightStart` 仅以 `bedBuildingId !== undefined` 为条件，在 `night-start` 时直接 `transition(…, "resting")`，未体现策划要求的「重新评估疲劳」与「先前往床铺再进入休息」流程。
- [依据]: `oh-code-design/行为系统.yaml`「关键流程·夜晚休息」步骤含「行为系统重新评估疲劳与床铺可用性」「小人前往自己的床并进入休息状态」；`oh-gen-doc/需求系统.yaml`「休息行为」执行流程含「寻找属于自己的床铺」「移动到床铺位置」「躺下休息」；`oh-gen-doc/时间系统.yaml`「游戏日·夜晚·特点」精力降至阈值以下触发寻床（本实现按钟点一刀切，与疲劳阈值叙事不一致）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 模块级 `moduleFsmByPawn` 与 `registerNightRestFsm` / `unregisterNightRestFsm` / `clearNightRestFsmRegistry` 在仓库内无任意调用方（测试亦始终通过 `getFsm` 注入），属于未接线的登记 API 与备用解析路径。
- [影响]: 增加维护面与误用风险；若未来接入方只调用 `registerNightRestFsm` 而忘记订阅 `setupNightRestFlow`，仍无法响应时间事件；当前状态下面向 Map 的代码路径实质为死代码。

- [指控]: 未发现 `mock` / `temp` / 敷衍式 `TODO` 等临时实现标记。

## 3. 架构违规 (Architecture Violations)

- [指控]: 未发现明显问题。本文件仅依赖 `EntityRegistry`、`TimeEventBus`、`behavior-state-machine.transition`，未越权修改 UI/渲染或绕过已声明的领域边界。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0095]: 在编排层（持有 `TimeEventBus` 与小人 FSM 解析能力的模块）显式调用 `setupNightRestFlow`，或等价地在统一的时间事件分发处调用 `applyNightRestTimeEvent`，使生产路径与 `oh-code-design` 中「时间事件 → 行为系统」闭环一致。
- [行动点 #0096]: 若保留「夜间边界强制归宿」语义，应在 `oh-gen-doc` / `oh-code-design` 中明确其与「疲劳阈值驱动寻床」是替代关系还是叠加关系，并使实现与文档一致（例如补充疲劳判定、或改为驱动 `moving`+床位目标而非直接 `resting`）。
- [行动点 #0097]: 删除或实际接入 `moduleFsmByPawn` 登记 API；若生产仅采用 `getFsm` 注入，应收敛为单一 FSM 来源并在注释或模块导出上避免暗示未使用的双轨。