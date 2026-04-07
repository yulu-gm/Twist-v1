# 审计报告: src/ui/runtime-debug-log-store.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-gen-doc/UI系统.yaml` 未单独定义「运行时调试日志面板」需求；本模块为工程能力。与策划文档对齐度低不构成「漏做策划功能」，但若产品要求正式版剥离调试 UI，则需在发布配置中关闭（超出本文件范围）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：类型别名 `RuntimeDebugLogEventInput` 等与 `runtime-log` 对齐，非 mock 数据层。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：纯内存 store + 过滤，符合横切调试设施与领域分离。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0360] **已落实**: `createRuntimeDebugLogStore` 内维护与 `events` 同步的 `panelEntries`；`getEntries` / `getVisibleEntries`（非空关键字时仅 `filter`）不再对同一批事件重复 `map(runtimeLogEventToPanelEntry)`。`selectRuntimeDebugLogEntries` 仍供外部对原始 `events` 单次转换（如 `GameScene`）。