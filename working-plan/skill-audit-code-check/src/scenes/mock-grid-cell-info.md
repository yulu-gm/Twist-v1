# 审计报告: src/scenes/mock-grid-cell-info.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题（文件仅为转发，功能由 `src/data/grid-cell-info.ts` 承担）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 全文为 `@deprecated` 兼容转发（1–2 行），将 `formatGridCellHoverText` 重导出为 `formatMockGridCellHoverText`；符合 skill 所述「旧 Mock 路径未删尽」形态。
- [影响]: 增加导入路径噪音；若已无引用应删除整文件（需全仓 grep 确认）。

## 3. 架构违规 (Architecture Violations)

- [指控]: 违背 `oh-code-design/UI系统.yaml`「单一数据驱动配置」倾向：同一能力存在 `scenes/mock-*` 与 `data/*` 双入口，破坏模块边界清晰度。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0322]: 全项目改为自 `../data/grid-cell-info` 引用后删除本文件。
- [行动点 #0323]: 若短期保留，在 deprecation 注释中写明计划移除版本或任务编号。