# 审计报告: src/runtime-log/runtime-log.ts

## 1. 漏做需求 (Missing Requirements)

- [结论]: 在 `oh-code-design/` 九个 YAML（含 `UI系统.yaml`、`实体系统.yaml`、`行为系统.yaml` 等）与 `oh-gen-doc/` 同名策划文档中，**未出现**对「运行时日志事件结构、`RuntimeLogVerbosity` / `RuntimeLogCategory`、NDJSON、开发态 HTTP 批写」等契约的**逐字段**规定，因此无法按「某一条款 → 代码未实现」的方式认定本文件漏做。
- [间接对照]: `oh-code-design/UI系统.yaml` 要求界面以读模型驱动、状态展示聚合多系统只读字段（分层中「界面状态层」「状态展示模型」）；`oh-code-design/实体系统.yaml`「读取投影层」写明为 UI、交互反馈、**调试视图**提供只读投影。`runtime-log.ts` 提供的是可序列化、无领域副作用的**诊断事件模型与展示用 `RuntimeLogPanelEntry` 转换**，与「调试/可观测数据管道」方向相容，但设计文档**尚未**把该管道纳入上述模块的正式数据契约，属于**需求文档覆盖缺口**，不宜单独记为本 `.ts` 文件的实现遗漏。
- [代码侧观察（非设计条款）]: `buildSearchText` 仅拼接 `message`、`category`、`verbosity` 与可选 `searchTextParts`，**不包含** `detail` 的文本化内容；若策划未来要求「按详情全文检索」，当前实现需变更，但**现有文档未写该要求**，故不列为已证实的漏做。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：无 `mock` / `temp` / `TODO` 占位，无面向已废弃系统的兼容分支；类型上 `(string & {})` 用于放宽 `RuntimeLogCategory` 的字符串字面量联合，属常见 TypeScript 开放式分类扩展写法，不构成「无用兼容」证据。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件仅导出类型与纯函数（`createRuntimeLogEvent`、`formatRuntimeLogDetail`、`runtimeLogEventToPanelEntry`），无对领域状态或全局单例的写入，不违背 `oh-code-design/UI系统.yaml` 中「避免 UI 直接承担领域规则」所针对的**领域越权**问题（越权风险在调用方，不在本文件的 API 形状）。
- [说明]: `runtimeLogEventToPanelEntry` 将整事件 `JSON.stringify` 为 `detailText`，与 `formatRuntimeLogDetail` 对 `detail` 单独格式化并存；二者用途不同（面板调试原文 vs 摘要展示），**不构成**设计文档中的分层违反，仅属实现上可统一的细节。

## 4. 修复建议 (Refactor Suggestions)

- [文档]: 在 `oh-gen-doc` 或 `oh-code-design` 增补独立小节（或附录）「运行时诊断日志」：约定 `category` 命名空间与各子系统对应关系、`verbosity` 与玩家可见/仅开发态的边界、是否要求 `searchText` 覆盖 `detail`。
- [一致性（可选）]: 若希望面板 `detailText` 中 `detail` 字段与列表摘要完全一致，可约定统一经 `formatRuntimeLogDetail` 再嵌入 JSON（属实现优化，**非**当前设计文档中的硬性要求）。
- [验收]: 若有 `oh-acceptance` 中针对调试面板的场景，应引用上述新条款后再对 `createRuntimeLogEvent` / `searchText` 行为写 Given-When-Then，避免基础设施长期无文档锚点。
