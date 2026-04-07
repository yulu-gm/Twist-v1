# 审计报告: src/headless/sim-reporter.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `PawnSummary` 将 `PawnGoalState` / `PawnActionState` 压缩为 `currentGoalKind` / `currentActionKind` 字符串，丢弃了领域状态中已有的 `reason`、`targetId` 等结构化信息，不利于在 headless 报告中还原「当前目标是谁、为何如此」。
- [依据]: `oh-code-design/行为系统.yaml` 在目标中要求「保持行为选择**可解释**、可重放、可测试」，且在核心数据「行为快照」中列出「当前目标」等字段；当前摘要形态与「可解释快照」相比信息偏薄。

- [指控]: `PawnSummary` 未包含 `PawnState` 中与工单执行直接相关的只读字段（如 `workTimerSec`、`activeWorkItemId`、`reservedTargetId` 等），对「执行工作 / 读条 / 认领工单」类场景的验收报告需依赖 `sim-event-log` 事件流补全，报表本身未形成与 `oh-gen-doc/行为系统.yaml` 中工作状态描述（伐木、建造、拾取、放置等）一一对应的**单点可读投影**。
- [依据]: `oh-gen-doc/行为系统.yaml` 对工作子状态有明确枚举式描述；`oh-code-design/实体系统.yaml`「小人实体」关键字段亦列出「行为状态」等，报告层对「执行中」维度的呈现不完整。

- [指控]: `oh-code-design` / `oh-gen-doc` 中**未定义**名为 headless 报表或 `SimReport` 的专用契约条款；因此除上述交叉对照外，无法声称「已实现某条 YAML 中的报表字段清单」。若后续验收依赖结构化报表，宜在文档侧补齐最小字段表，再对照本文件迭代。
- [依据]: 全库检索上述目录无 `sim-reporter`、`HeadlessSim`、`generateReport` 等关键词；审计仅能基于实体/行为/投影等相邻条款推断缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `generateReport` 第二参数 `assertions` 及 `SimAssertion` / `evaluateAssertion` 分支在 `src/` 内**无任何调用**（仅 `scenario-runner` 调用无参 `generateReport(sim)`，断言结果由 `runAllExpectations` 另行写入 `assertionResults`）。对外 API 与真实跑批路径不一致，易误导维护者以为场景测试会走内置断言管道。
- [影响]: 双轨断言模型增加认知负担；若长期不接线，属于实质上的未使用导出路径。

- [说明]: `predicate` 的 `try/catch` 将异常转为失败结果，属于测试鲁棒性设计，**不**视为 Mock 或临时兼容。

## 3. 架构违规 (Architecture Violations)

- [指控]: `SimAssertion.predicate` 与 `generateReport` 形参类型绑定 `HeadlessSim`（`headless-sim` 模块的具体只读对象形态），而非仅依赖「tick / 世界时间 / pawns / 事件汇总」等最小只读接口；若未来存在另一套无 Phaser 驱动或测试替身，需改类型或编写适配层。
- [依据]: `oh-code-design/实体系统.yaml` 强调分层与「与实现无关」的实体快照思想；本文件虽未越权写状态（注释与实现一致：只读 getter），但在**类型边界**上仍与具体 headless 装配体耦合，与理想「可替换实现」略有张力。仓库内尚无 YAML 明文禁止此写法，故定性为**轻微可测试性/开闭问题**，而非明确分层击穿。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0246]: 在 `PawnSummary` 中按需扩展为嵌套只读结构（例如保留 `currentGoal` / `currentAction` 的 `kind` + `reason` + `targetId`，或增加 `workProgress` 摘要），使 headless 报告与行为/工单验收更可读，并与 `oh-code-design/行为系统.yaml`「行为快照」语义对齐。
- [行动点 #0247]: 统一断言出口：要么让 `runScenarioHeadless` 使用 `generateReport(sim, assertions)` 单一路径，要么删除/收敛未使用的 `assertions` 参数并在 `index` 导出中注明，避免双轨 API。
- [行动点 #0248]: 将 `generateReport` 首参改为显式只读接口类型（从 `HeadlessSim` 抽出 `getTickCount`、`getWorldTime`、`getPawns`、`getSimEventCollector` 等方法的交集），减少对 `headless-sim.ts` 具体类型的编译期绑定。
- [行动点 #0249]: 若产品确认需要「世界只读投影」进入 JSON 报告，在 `oh-code-design` 或 `oh-gen-doc` 增补 headless 报表最小字段约定后，再在报告对象上增加可选块（如实体/区域摘要），避免无文档依据的随意扩表。