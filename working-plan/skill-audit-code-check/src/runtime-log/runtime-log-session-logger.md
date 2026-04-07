# 审计报告: src/runtime-log/runtime-log-session-logger.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现可逐项引证的漏做：`oh-code-design/` 与 `oh-gen-doc/` 中未检索到针对「运行时会话日志、双通道 sink、定时/按量刷批」的专项模块定义；无法将 `flushIntervalMs` / `flushSize` / `writeBatch` 等行为与 YAML 条款一一对照。
- [补充观察]（无 YAML 强制要求，仅供改进）：当 `asyncBatchSink.writeBatch` 某次拒绝时，`writeChain` 会进入拒绝态，后续 `writeChain.then(...)` 中的刷批逻辑可能不再执行，存在**开发期日志在首次失败后静默中断**的风险；设计文档未要求「日志投递故障恢复」，故不升格为正式「漏做」，仅作工程可靠性缺口记录。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：文件中无 `mock` / `temp` / `TODO` 等临时桩；`enabled` 与 `asyncBatchSink` 在现有调用方（如 `runtime-log-session.ts`）中与 `__TWIST_RUNTIME_LOG_DEV_SERVER__` 成组使用，未见为兼容旧接口而遗留的死分支。

## 3. 架构违规 (Architecture Violations)

- [指控]：`runtime-log-session-logger.ts` 第 2 行通过 `import type { RuntimeDebugLogStore } from "../ui/runtime-debug-log-store"` 使 `src/runtime-log` 依赖 `src/ui` 中的具体模块边界。
- [依据]：`oh-code-design/UI系统.yaml` 中「界面状态层」职责写明「订阅领域系统只读数据并转成界面态」，接口边界亦表述为各系统向 UI 提供输入；预期数据流以**领域/应用 → UI** 为主。本会话 logger 属于运行期基础设施侧，却反向引用 UI 目录中的 store 类型，与上述分层意图不一致，构成**依赖方向上的分层异味**（类型-only import 仍固化目录耦合）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0299]：将 `RuntimeDebugLogStore`（或更窄的 `append(event)` 能力接口）抽到与 UI 解耦的公共类型位置（例如 `runtime-log` 内局部接口、`src/shared` 等），由 `runtime-debug-log-store` 实现该接口；logger 文件仅依赖抽象，不再 `import` `../ui/...`。
- [行动点 #0300]：为 `writeChain` 增加失败处理（如 `.catch` 内记录错误并 `writeChain = Promise.resolve()` 重置，或明确向上抛出并由上层策略重试），避免单次 `writeBatch` 失败导致后续批永久跳过。
  - **核对（已修复）**：`writeBatch` 在链上追加 `.catch`：`console.error` 记录后 `return undefined`，使链恢复为已决成功，后续批不再被永久跳过。
- [行动点 #0301]：`flush` 与 `dispose` 中「`writeBatch(drainBatch())` + `asyncBatchSink?.flush?.()`」重复，可提取为单一内部异步过程，降低分叉维护成本。
  - **核对（已修复）**：抽取内部 `flushBufferedToSink`，`flush` 直接引用该函数，`dispose` 在 `clearFlushTimer` 后 `await flushBufferedToSink()`。