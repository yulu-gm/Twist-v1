# 审计报告: src/headless/scenario-helpers.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题：`oh-code-design` 与 `oh-gen-doc` 未单独定义「Headless 场景辅助模块」的条目；本文件提供的 `runUntil` 谓词、`AssertionResult` 断言与 `spawnDefaultColony` 等与现有 `WorldCore` 工单快照、世界时间、`PawnState` 字段的用法一致，不构成对已写明策划规则的直接缺项。
- [弱相关说明] `assertNoPawnStarved` 将「饿死」固定为 `satiety <= 0`。若策划在 `oh-gen-doc/需求系统.yaml` 中将「饥饿阈值」定为非零常数，则断言语义与数值设计可能不一致；需以全局平衡配置为单一事实来源核对，本文件未暴露可配置阈值。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控] `invalidateScenarioEntity` 注释写明为 Scenario-only 的「外部失效」模拟，属于测试注入捷径；当前在 `src/` 内无引用，属于预留 API，存在「写了但未接入任何场景」的闲置面。
- [指控] `isResourceContainerKind`（约第 76–78 行）手写字符串联合，与 `ResourceContainerKind` 类型定义重复；若 `entity-types` 扩展容器种类，此处易漏改，形成隐性维护债，而非运行时 Mock。
- [指控] 第 242–249 行连续两段 JSDoc：中文段描述的是「在网格上生成若干默认小人」，紧邻的导出却是 `invalidateScenarioEntity`，易造成 IDE 文档挂错符号；`spawnDefaultColony` 反而缺少对应中文说明块。

## 3. 架构违规 (Architecture Violations)

- [指控] 通过 `../game/world-internal` 的 `cloneWorld`、`removeEntityMutable` 直接改写字典后 `sim.getWorldPort().setWorld(next)`，跳过了 `oh-code-design/实体系统.yaml` 中为「应用编排层」「生命周期规则」所描述的、经编排与领域规则协调的删除与一致性路径。
- [依据] 同文件「工作结算层 / 工作结算器」职责写明需「根据行为执行结果更新工作状态」并「处理目标消失、目标被占用等异常」（见 `oh-code-design/工作系统.yaml` 第 26–29、47–50 行）。本助手仅移除实体，不保证触发与主循环相同的工单结算、小人 `activeWorkItemId` 等连锁更新，测试通过时仍可能与真实「目标消失」因果链不一致。
- [说明] `setWorld` 本身与编排器用法一致，风险主要来自**变更世界的实现路径**是否复用与 `game-orchestrator` 相同的清理与结算步骤，而非端口方法名。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0220] 整理 JSDoc：将「生成默认殖民地」说明移到 `spawnDefaultColony` 正上方，仅保留 `invalidateScenarioEntity` 的英文（或中文）场景说明在其导出之上，避免符号文档串台。
- [行动点 #0221] 删除或收窄手写 `isResourceContainerKind`：改为使用 `entity-types` 导出的类型/常量表驱动校验，降低与领域模型漂移。
- [行动点 #0222] 为场景提供与运行时一致的「移除实体」入口（例如经 `WorldCoreWorldPort` 或编排器暴露的测试/管理 API），在移除后调用与主循环相同的工单失效、占用格清理等逻辑，使 `invalidateScenarioEntity` 与 `oh-code-design/工作系统.yaml` 中目标消失处理对齐。
- [行动点 #0223] 若短期内无场景使用 `invalidateScenarioEntity`，可删除或在首个使用该能力的场景测试中引用，避免长期悬空 API。
